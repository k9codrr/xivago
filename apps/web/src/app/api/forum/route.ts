import { NextRequest, NextResponse } from "next/server";
import { prisma, isPro } from "@/lib/db";
import { getOptionalUser, requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError, apiValidationError } from "@/lib/api-response";
import { forumPostCreateSchema, forumFeedQuerySchema } from "@/lib/validation/forum";
import { isTextClean, moderateMedia, startAsyncVideoModeration } from "@/lib/moderation";
import { getReactionSummaries, getCommentCounts, getViewerPollVotes, getPostEngagement } from "@/lib/forum";
import { FORUM_POST_SELECT, shapeForumPost } from "@/lib/forum-post";
import { haversineKm, getBoundingBox } from "@/lib/geo";
import { notifyFollowersOfPost, notifyMentionedInPost } from "@/lib/notifications";

export async function GET(req: NextRequest) {
  const viewer = await getOptionalUser();

  const url = new URL(req.url);
  const parsed = forumFeedQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return apiValidationError(parsed.error);
  const { cursor, limit, authorId, communityId, scope: feedScope, sort, lat, lng, radiusKm } = parsed.data;

  // Feed scoping: an explicit communityId shows just that community; an
  // authorId (profile "Threads" tab) shows that author's posts everywhere;
  // neither means the forum feed: global posts plus posts from communities the
  // viewer has joined. Other communities' posts stay out of it.
  const joinedCommunityIds =
    !communityId && !authorId && viewer
      ? (
          await prisma.communityMember.findMany({ where: { userId: viewer.id }, select: { communityId: true } })
        ).map((m) => m.communityId)
      : [];
  const scope = communityId
    ? { communityId }
    : authorId
      ? { OR: [{ senderId: authorId }, { reposts: { some: { userId: authorId } } }] }
      : feedScope === "joined"
        ? { communityId: { in: joinedCommunityIds } }
        : joinedCommunityIds.length > 0
        ? { OR: [{ communityId: null }, { communityId: { in: joinedCommunityIds } }] }
        : { communityId: null };

  const isGeoFiltered = lat != null && lng != null;
  const bbox = isGeoFiltered ? getBoundingBox(lat, lng, radiusKm) : null;
  const geoWhere = bbox
    ? { lat: { gte: bbox.minLat, lte: bbox.maxLat }, lng: { gte: bbox.minLng, lte: bbox.maxLng } }
    : {};

  // "Hot" is a computed rank (recency-decayed engagement), not a DB column,
  // so it's scored over a candidate window in app code rather than paginated
  // by cursor -- an MVP tradeoff documented in the ratings/feed plan.
  if (sort === "hot") {
    const candidates = await prisma.forumMessage.findMany({
      where: { deletedAt: null, ...scope, ...geoWhere, createdAt: { gte: new Date(Date.now() - 7 * 86400000) } },
      select: FORUM_POST_SELECT,
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    const filtered = isGeoFiltered
      ? candidates.filter((p) => p.lat != null && p.lng != null && haversineKm(lat, lng, p.lat, p.lng) <= radiusKm)
      : candidates;

    const ids = filtered.map((p) => p.id);
    const [reactions, commentCounts, pollVotes, engagement] = await Promise.all([
      getReactionSummaries("MESSAGE", ids, viewer?.id ?? null),
      getCommentCounts(ids),
      getViewerPollVotes(filtered.filter((p) => p.poll).map((p) => p.poll!.id), viewer?.id ?? null),
      getPostEngagement(ids, viewer?.id ?? null),
    ]);

    const scored = filtered.map((p) => {
      const r = reactions.get(p.id);
      const c = commentCounts.get(p.id) ?? 0;
      const ageHours = (Date.now() - p.createdAt.getTime()) / 3600000;
      const e = engagement.get(p.id);
      const score =
        ((r?.total ?? 0) * 2 + c * 3 + (e?.repostCount ?? 0) * 3 + (e?.shareCount ?? 0) * 2) / Math.pow(ageHours + 2, 1.5);
      return { post: p, score };
    });
    scored.sort((a, b) => b.score - a.score);
    const page = scored.slice(0, limit).map((s) => shapeForumPost(s.post, viewer?.id ?? null, reactions, commentCounts, pollVotes, engagement));

    return NextResponse.json({ posts: page, nextCursor: null });
  }

  const posts = await prisma.forumMessage.findMany({
    where: { deletedAt: null, ...scope, ...geoWhere },
    select: FORUM_POST_SELECT,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: isGeoFiltered ? limit * 2 + 1 : limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  let filtered = posts;
  if (isGeoFiltered) {
    filtered = posts.filter((p) => p.lat != null && p.lng != null && haversineKm(lat, lng, p.lat, p.lng) <= radiusKm);
  }

  const hasMore = filtered.length > limit;
  const page = hasMore ? filtered.slice(0, limit) : filtered;
  const ids = page.map((p) => p.id);

  const [reactions, commentCounts, pollVotes, engagement] = await Promise.all([
    getReactionSummaries("MESSAGE", ids, viewer?.id ?? null),
    getCommentCounts(ids),
    getViewerPollVotes(page.filter((p) => p.poll).map((p) => p.poll!.id), viewer?.id ?? null),
    getPostEngagement(ids, viewer?.id ?? null),
  ]);

  const shaped = page.map((post) =>
    shapeForumPost(post, viewer?.id ?? null, reactions, commentCounts, pollVotes, engagement),
  );

  return NextResponse.json({ posts: shaped, nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null });
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
    }
    const parsed = forumPostCreateSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);
    const { text, attachments = [], communityId, lat, lng, poll } = parsed.data;

    if (communityId) {
      // Community post: gated on membership, not PRO -- see DECISIONS.md #54.
      const membership = await prisma.communityMember.findUnique({
        where: { communityId_userId: { communityId, userId: user.id } },
        select: { id: true },
      });
      if (!membership) {
        return apiError(403, "NOT_A_MEMBER", "Join this community to post in it.");
      }
    } else {
      // Global forum: PRO-gated, per section 3.9 / DECISIONS.md #44.
      const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { subscription: true } });
      if (!isPro(dbUser?.subscription)) {
        return apiError(403, "UPGRADE_REQUIRED", "Posting in the feed requires xivago PRO.");
      }
    }

    if (!isTextClean(text)) {
      return apiError(422, "TEXT_MODERATION_FAILED", "This message may violate our content guidelines.");
    }

    // Every item is moderated on its own (images and videos alike); one rejected item rejects the post.
    const moderated = await Promise.all(attachments.map((a) => moderateMedia(a.url, a.contentType)));
    const rejectedIndex = moderated.findIndex((m) => m.autoRejected);
    if (rejectedIndex !== -1) {
      const kind = attachments[rejectedIndex]!.contentType.startsWith("video/") ? "video" : "image";
      return apiError(422, "IMAGE_MODERATION_FAILED", `This ${kind} may violate our content guidelines.`);
    }

    const post = await prisma.forumMessage.create({
      data: {
        senderId: user.id,
        text,
        communityId: communityId ?? null,
        lat: lat ?? null,
        lng: lng ?? null,
        ...(attachments.length > 0
          ? {
              attachments: {
                create: attachments.map((a, i) => ({
                  url: a.url,
                  contentType: a.contentType,
                  status: moderated[i]!.autoApproved ? ("APPROVED" as const) : ("PENDING" as const),
                  moderationNote: moderated[i]!.reason,
                })),
              },
            }
          : {}),
        ...(poll
          ? {
              poll: {
                create: {
                  closesAt: poll.closesInHours ? new Date(Date.now() + poll.closesInHours * 3600000) : null,
                  options: { create: poll.options.map((text) => ({ text })) },
                },
              },
            }
          : {}),
      },
      select: FORUM_POST_SELECT,
    });

    // Long videos are checked in the background now that the attachment rows exist.
    attachments.forEach((a, i) => {
      if (!moderated[i]!.needsAsync) return;
      const row = post.attachments.find((r) => r.url === a.url);
      if (row) void startAsyncVideoModeration(row.id, row.url);
    });

    // Followers hear about it -- but not while an attachment awaits moderation,
    // and not for community posts (those are scoped to members).
    const pendingReview = moderated.some((m) => !m.autoApproved);
    if (!pendingReview && !communityId) void notifyFollowersOfPost(post.id);
    if (!pendingReview) void notifyMentionedInPost(post.id);

    return NextResponse.json(
      {
        post: shapeForumPost(post, user.id, new Map(), new Map(), new Map()),
        pendingReview,
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("forum POST: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not post to the feed.");
  }
}
