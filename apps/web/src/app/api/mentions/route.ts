import { NextRequest, NextResponse } from "next/server";
import { prisma, ensureUsernames } from "@/lib/db";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError } from "@/lib/api-response";
import type { MentionCommunity, MentionUser, UserRelation } from "@/components/forum/types";

/** Total rows the @-mention list shows. */
const LIMIT = 10;
/** People get up to this many rows; communities fill the rest. */
const USER_LIMIT = 6;
/** Cap on follow edges / joined communities scanned for ranking. */
const MAX_SCAN = 500;

/**
 * Closeness of a candidate to what was typed after "@": exact > prefix >
 * prefix of a word > anywhere. Lower is closer; Infinity means no match.
 */
function rank(q: string, fields: (string | null | undefined)[]): number {
  if (!q) return 0;
  let best = Infinity;
  for (const raw of fields) {
    if (!raw) continue;
    const f = raw.toLowerCase();
    if (f === q) return 0;
    if (f.startsWith(q)) best = Math.min(best, 1);
    else if (f.split(/[\s\-_.@]+/).some((w) => w.startsWith(q))) best = Math.min(best, 2);
    else if (f.includes(q)) best = Math.min(best, 3);
  }
  return best;
}

/** The email's local part only, so "gmail" doesn't match every Gmail user. */
const emailLocal = (email: string) => (email.startsWith("wa+") ? "" : (email.split("@")[0] ?? ""));

const RELATION_ORDER: Record<UserRelation, number> = { mutual: 0, following: 1, follower: 2 };

const USER_SELECT = { id: true, name: true, username: true, email: true, avatarUrl: true } as const;

/**
 * GET /api/mentions?q=ann
 * Suggestions for "@" mentions in the composer.
 * People: those the viewer follows or is followed by come first (matched on
 * username, name or email), then anyone else who matches. Communities: joined
 * ones first, then other matches. Emails are matched but never returned.
 */
export async function GET(req: NextRequest) {
  try {
    const viewer = await requireUser();
    const q = (new URL(req.url).searchParams.get("q") ?? "").trim().toLowerCase().replace(/^@/, "").slice(0, 60);

    const [following, followers, memberships] = await Promise.all([
      prisma.follow.findMany({
        where: { followerId: viewer.id },
        orderBy: { createdAt: "desc" },
        take: MAX_SCAN,
        select: { followingId: true },
      }),
      prisma.follow.findMany({
        where: { followingId: viewer.id },
        orderBy: { createdAt: "desc" },
        take: MAX_SCAN,
        select: { followerId: true },
      }),
      prisma.communityMember.findMany({
        where: { userId: viewer.id },
        orderBy: { joinedAt: "desc" },
        take: MAX_SCAN,
        select: {
          community: {
            select: { id: true, name: true, slug: true, coverImage: true, _count: { select: { members: true } } },
          },
        },
      }),
    ]);

    // ── People ──
    const followingIds = new Set(following.map((f) => f.followingId));
    const followerIds = new Set(followers.map((f) => f.followerId));
    const relationOf = (id: string): UserRelation | null =>
      followingIds.has(id) && followerIds.has(id)
        ? "mutual"
        : followingIds.has(id)
          ? "following"
          : followerIds.has(id)
            ? "follower"
            : null;
    // Recency order: people you follow (newest first), then your followers
    const connectionIds = [...new Set([...followingIds, ...followerIds])].filter((id) => id !== viewer.id);
    const recency = new Map(connectionIds.map((id, i) => [id, i]));

    const connectionRows = connectionIds.length
      ? await prisma.user.findMany({
          where: { id: { in: connectionIds }, isBanned: false },
          select: USER_SELECT,
        })
      : [];

    const connections = connectionRows
      .map((u) => ({ u, r: rank(q, [u.username, u.name, emailLocal(u.email)]), rel: relationOf(u.id)! }))
      .filter((x) => x.r !== Infinity)
      .sort(
        (a, b) =>
          a.r - b.r || RELATION_ORDER[a.rel] - RELATION_ORDER[b.rel] || (recency.get(a.u.id) ?? 0) - (recency.get(b.u.id) ?? 0),
      )
      .slice(0, USER_LIMIT);

    let others: { u: (typeof connectionRows)[number]; r: number }[] = [];
    if (q && connections.length < USER_LIMIT) {
      const found = await prisma.user.findMany({
        where: {
          id: { notIn: [viewer.id, ...connectionIds] },
          isBanned: false,
          OR: [
            { username: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
            { email: { startsWith: q, mode: "insensitive" } },
          ],
        },
        select: USER_SELECT,
        orderBy: { followers: { _count: "desc" } },
        take: 30,
      });
      others = found
        .map((u) => ({ u, r: rank(q, [u.username, u.name, emailLocal(u.email)]) }))
        .filter((x) => x.r !== Infinity)
        .sort((a, b) => a.r - b.r)
        .slice(0, USER_LIMIT - connections.length);
    }

    const picked = [...connections.map((x) => ({ ...x.u, relation: x.rel })), ...others.map((x) => ({ ...x.u, relation: null }))];
    // Accounts from before handles existed get one now, so the mention has something to point at
    const missing = picked.filter((u) => !u.username).map((u) => u.id);
    const assigned = missing.length ? await ensureUsernames(prisma, missing) : new Map<string, string>();

    const users: MentionUser[] = picked
      .map((u) => ({
        kind: "user" as const,
        id: u.id,
        name: u.name,
        username: u.username ?? assigned.get(u.id) ?? "",
        avatarUrl: u.avatarUrl,
        relation: u.relation,
      }))
      .filter((u) => u.username);

    // ── Communities ──
    const communityLimit = Math.max(LIMIT - users.length, 3);
    const joined = memberships
      .map((m, order) => ({ c: m.community, r: rank(q, [m.community.slug, m.community.name]), order }))
      .filter((x) => x.r !== Infinity)
      .sort((a, b) => a.r - b.r || a.order - b.order)
      .slice(0, communityLimit)
      .map(({ c }) => c);

    let otherCommunities: typeof joined = [];
    if (q && joined.length < communityLimit) {
      const found = await prisma.community.findMany({
        where: {
          id: { notIn: memberships.map((m) => m.community.id) },
          OR: [{ slug: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }],
        },
        select: { id: true, name: true, slug: true, coverImage: true, _count: { select: { members: true } } },
        orderBy: { members: { _count: "desc" } },
        take: 25,
      });
      otherCommunities = found
        .map((c) => ({ c, r: rank(q, [c.slug, c.name]) }))
        .sort((a, b) => a.r - b.r)
        .slice(0, communityLimit - joined.length)
        .map(({ c }) => c);
    }

    const shape = (isMember: boolean) => (c: (typeof joined)[number]): MentionCommunity => ({
      kind: "community",
      id: c.id,
      name: c.name,
      slug: c.slug,
      coverImage: c.coverImage,
      memberCount: c._count.members,
      isMember,
    });

    return NextResponse.json({
      suggestions: [...users, ...joined.map(shape(true)), ...otherCommunities.map(shape(false))],
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "Sign in to mention people.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    throw err;
  }
}
