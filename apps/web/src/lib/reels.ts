import "server-only";
import { prisma } from "@/lib/db";
import { FORUM_POST_SELECT, getForumPost, shapeForumPosts } from "@/lib/forum-post";
import { getCommentCounts } from "@/lib/forum";
import { subIdsInText } from "@/lib/category-tags.server";
import type { ForumAttachment, ForumPost } from "@/components/forum/types";

/**
 * The reels feed: full-screen forum videos, ranked for the viewer.
 *
 * Score per candidate post (higher first):
 *   niche match    +4 per sub category shared with the viewer's onboarding
 *                  picks, +1.5 per shared main category — a post's topics are
 *                  its author's categories plus the ones its text names
 *   relationship   +3 follows the author, +0.6 per past reaction/bookmark on
 *                  that author's posts (capped), +1 community you joined
 *   popularity     log(1 + reactions + 2 × comments)
 *   freshness      +3 when new, halving about every week
 *   exploration    a little randomness so the feed isn't the same every time
 * Then authors are spread out: at most one video per author per batch.
 */

export interface ReelItem {
  key: string;
  attachment: ForumAttachment;
  post: ForumPost;
}

const CANDIDATE_POOL = 400;
const MAX_AGE_DAYS = 120;

const isVideoAttachment = (a: { contentType: string }) => a.contentType.startsWith("video/");
const parentOf = (subId: string) => subId.split(".")[0]!;
const subOf = (id: string) => id.split(".").slice(0, 2).join(".");

/** The viewer's niches: subs picked at onboarding, plus subs implied by provider picks. */
async function viewerInterests(viewerId: string) {
  const user = await prisma.user.findUnique({
    where: { id: viewerId },
    select: { categorySubIds: true, categoryProviderIds: true },
  });
  const subs = new Set([...(user?.categorySubIds ?? []), ...(user?.categoryProviderIds ?? []).map(subOf)]);
  return { subs, parents: new Set([...subs].map(parentOf)) };
}

/** Which authors the viewer engages with: follows, and past reactions/bookmarks per author. */
async function viewerAffinity(viewerId: string, authorIds: string[]) {
  const [follows, reactedPosts, bookmarkedPosts] = await Promise.all([
    prisma.follow.findMany({ where: { followerId: viewerId, followingId: { in: authorIds } }, select: { followingId: true } }),
    prisma.forumReaction.findMany({
      where: { userId: viewerId, targetType: "MESSAGE" },
      orderBy: { createdAt: "desc" },
      take: 300,
      select: { targetId: true },
    }),
    prisma.forumBookmark.findMany({
      where: { userId: viewerId },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { post: { select: { senderId: true } } },
    }),
  ]);
  const reactedAuthors = reactedPosts.length
    ? await prisma.forumMessage.findMany({
        where: { id: { in: reactedPosts.map((r) => r.targetId) } },
        select: { senderId: true },
      })
    : [];
  const engagement = new Map<string, number>();
  for (const { senderId } of [...reactedAuthors, ...bookmarkedPosts.map((b) => b.post)]) {
    engagement.set(senderId, (engagement.get(senderId) ?? 0) + 1);
  }
  return { follows: new Set(follows.map((f) => f.followingId)), engagement };
}

function firstVisibleVideo(post: ForumPost): ForumAttachment | null {
  return post.attachments.find(isVideoAttachment) ?? null;
}

/**
 * The opening reel (the video that was tapped), then ranked reels after it.
 * `exclude` = post ids already shown in this session.
 */
export async function getReels(opts: {
  viewerId: string;
  startPostId?: string;
  startIndex?: number;
  exclude?: string[];
  limit?: number;
}): Promise<ReelItem[]> {
  const { viewerId } = opts;
  const limit = Math.min(Math.max(opts.limit ?? 8, 1), 20);
  const exclude = new Set(opts.exclude ?? []);
  const items: ReelItem[] = [];

  // 1. The video that was tapped opens first.
  if (opts.startPostId && !exclude.has(opts.startPostId)) {
    const post = await getForumPost(opts.startPostId, viewerId);
    if (post) {
      const tapped = post.attachments[opts.startIndex ?? 0];
      const attachment = tapped && isVideoAttachment(tapped) ? tapped : firstVisibleVideo(post);
      if (attachment) items.push({ key: `${post.id}:${attachment.id}`, attachment, post });
    }
    exclude.add(opts.startPostId);
  }

  // 2. Candidates the viewer may see: global posts + communities they joined.
  const joined = (
    await prisma.communityMember.findMany({ where: { userId: viewerId }, select: { communityId: true } })
  ).map((m) => m.communityId);

  const candidates = await prisma.forumMessage.findMany({
    where: {
      deletedAt: null,
      id: { notIn: [...exclude] },
      createdAt: { gte: new Date(Date.now() - MAX_AGE_DAYS * 86_400_000) },
      OR: [{ communityId: null }, ...(joined.length ? [{ communityId: { in: joined } }] : [])],
      attachments: { some: { status: "APPROVED", contentType: { startsWith: "video/" } } },
    },
    orderBy: { createdAt: "desc" },
    take: CANDIDATE_POOL,
    select: { id: true, text: true, senderId: true, communityId: true, createdAt: true },
  });
  if (candidates.length === 0) return items;

  const ids = candidates.map((c) => c.id);
  const authorIds = [...new Set(candidates.map((c) => c.senderId))];
  const [interests, affinity, authors, reactionCounts, commentCounts] = await Promise.all([
    viewerInterests(viewerId),
    viewerAffinity(viewerId, authorIds),
    prisma.user.findMany({
      where: { id: { in: authorIds } },
      select: { id: true, categorySubIds: true, categoryProviderIds: true },
    }),
    prisma.forumReaction.groupBy({
      by: ["targetId"],
      where: { targetType: "MESSAGE", targetId: { in: ids } },
      _count: { _all: true },
    }),
    getCommentCounts(ids),
  ]);
  const authorSubs = new Map(
    authors.map((a) => [a.id, new Set([...a.categorySubIds, ...a.categoryProviderIds.map(subOf)])]),
  );
  const reactions = new Map(reactionCounts.map((r) => [r.targetId, r._count._all]));
  const joinedSet = new Set(joined);
  const now = Date.now();

  const scored = candidates.map((c) => {
    const topics = new Set([...(authorSubs.get(c.senderId) ?? []), ...subIdsInText(c.text)]);
    let score = 0;
    for (const sub of topics) {
      if (interests.subs.has(sub)) score += 4;
      else if (interests.parents.has(parentOf(sub))) score += 1.5;
    }
    if (affinity.follows.has(c.senderId)) score += 3;
    score += Math.min(affinity.engagement.get(c.senderId) ?? 0, 5) * 0.6;
    if (c.communityId && joinedSet.has(c.communityId)) score += 1;
    score += Math.log1p((reactions.get(c.id) ?? 0) + 2 * (commentCounts.get(c.id) ?? 0));
    const ageDays = (now - c.createdAt.getTime()) / 86_400_000;
    score += 3 * Math.pow(0.5, ageDays / 7);
    if (c.senderId === viewerId) score -= 2; // your own videos rarely
    score += Math.random() * 1.2;
    return { id: c.id, senderId: c.senderId, score };
  });
  scored.sort((a, b) => b.score - a.score);

  // 3. One per author per batch, so a single creator can't take over the feed.
  const picked: string[] = [];
  const seenAuthors = new Set(items.map((i) => i.post.senderId));
  for (const s of scored) {
    if (picked.length + items.length >= limit) break;
    if (seenAuthors.has(s.senderId)) continue;
    seenAuthors.add(s.senderId);
    picked.push(s.id);
  }
  // Not enough distinct authors: fill with the next best.
  for (const s of scored) {
    if (picked.length + items.length >= limit) break;
    if (!picked.includes(s.id)) picked.push(s.id);
  }

  const raw = await prisma.forumMessage.findMany({ where: { id: { in: picked } }, select: FORUM_POST_SELECT });
  const shaped = new Map((await shapeForumPosts(raw, viewerId)).map((p) => [p.id, p]));
  for (const id of picked) {
    const post = shaped.get(id);
    const attachment = post && firstVisibleVideo(post);
    if (post && attachment) items.push({ key: `${post.id}:${attachment.id}`, attachment, post });
  }
  return items;
}
