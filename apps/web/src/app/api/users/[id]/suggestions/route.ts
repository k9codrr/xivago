import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOptionalUser } from "@/lib/guards";
import { apiError } from "@/lib/api-response";

const LIMIT = 15;
const POOL = 60; // candidates taken from each signal before ranking

interface Candidate {
  score: number;
  /** Strongest reason seen so far, with its weight so a better one can replace it. */
  reason: { weight: number; text: string };
}

/**
 * "Suggested for you" on a profile: people the viewer might want to follow, in
 * the context of the profile being viewed (like Instagram's similar accounts).
 *
 * Signals, strongest first:
 *  1. Viewer's network  -- followed by people the viewer follows ("Followed by A + 2 others")
 *  2. Profile's graph   -- who this person follows, and who follows them
 *  3. Shared communities with this person
 *  4. Same niche        -- overlapping service categories with this person
 *
 * Never suggests the viewer, the profile owner, people the viewer already
 * follows, or banned users.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: profileId } = await params;
  const viewer = await getOptionalUser();
  const isSelf = viewer?.id === profileId;

  const profile = await prisma.user.findUnique({
    where: { id: profileId },
    select: { id: true, name: true, categorySubIds: true },
  });
  if (!profile) return apiError(404, "NOT_FOUND", "This user doesn't exist.");
  const firstName = profile.name.split(" ")[0] ?? profile.name;

  const viewerFollowing = viewer
    ? (
        await prisma.follow.findMany({
          where: { followerId: viewer.id },
          select: { followingId: true },
          take: 2000,
        })
      ).map((f) => f.followingId)
    : [];
  const exclude = [...new Set([profileId, ...(viewer ? [viewer.id] : []), ...viewerFollowing])];

  const candidates = new Map<string, Candidate>();
  function add(userId: string, score: number, weight: number, text: string) {
    const c = candidates.get(userId);
    if (!c) {
      candidates.set(userId, { score, reason: { weight, text } });
      return;
    }
    c.score += score;
    if (weight > c.reason.weight) c.reason = { weight, text };
  }

  const profileCommunityIds = (
    await prisma.communityMember.findMany({ where: { userId: profileId }, select: { communityId: true }, take: 200 })
  ).map((m) => m.communityId);

  const [mutualCounts, profileFollowing, profileFollowers, communityCounts, niche] = await Promise.all([
    // 1. Followed by people the viewer follows
    viewerFollowing.length
      ? prisma.follow.groupBy({
          by: ["followingId"],
          where: { followerId: { in: viewerFollowing }, followingId: { notIn: exclude } },
          _count: { followingId: true },
          orderBy: { _count: { followingId: "desc" } },
          take: POOL,
        })
      : Promise.resolve([]),
    // 2. Who this person follows / who follows them
    prisma.follow.findMany({
      where: { followerId: profileId, followingId: { notIn: exclude } },
      select: { followingId: true },
      orderBy: { createdAt: "desc" },
      take: POOL,
    }),
    prisma.follow.findMany({
      where: { followingId: profileId, followerId: { notIn: exclude } },
      select: { followerId: true },
      orderBy: { createdAt: "desc" },
      take: POOL,
    }),
    // 3. Members of the same communities
    profileCommunityIds.length
      ? prisma.communityMember.groupBy({
          by: ["userId"],
          where: { communityId: { in: profileCommunityIds }, userId: { notIn: exclude } },
          _count: { userId: true },
          orderBy: { _count: { userId: "desc" } },
          take: POOL,
        })
      : Promise.resolve([]),
    // 4. Same niche (overlapping category picks)
    profile.categorySubIds.length
      ? prisma.user.findMany({
          where: { id: { notIn: exclude }, isBanned: false, categorySubIds: { hasSome: profile.categorySubIds } },
          select: { id: true, categorySubIds: true },
          orderBy: { createdAt: "desc" },
          take: POOL,
        })
      : Promise.resolve([]),
  ]);

  // Name one mutual per candidate for the "Followed by A + N others" label.
  const mutualIds = mutualCounts.map((m) => m.followingId);
  const mutualNames = new Map<string, string>();
  if (mutualIds.length) {
    const rows = await prisma.follow.findMany({
      where: { followingId: { in: mutualIds }, followerId: { in: viewerFollowing } },
      distinct: ["followingId"],
      select: { followingId: true, follower: { select: { name: true } } },
    });
    for (const r of rows) mutualNames.set(r.followingId, r.follower.name);
  }
  for (const m of mutualCounts) {
    const n = m._count.followingId;
    const name = mutualNames.get(m.followingId);
    const text = name ? (n > 1 ? `Followed by ${name} + ${n - 1} more` : `Followed by ${name}`) : "Followed by people you follow";
    add(m.followingId, 4 * n, 40 + n, text);
  }

  for (const f of profileFollowing) add(f.followingId, 3, 30, isSelf ? "Suggested for you" : `Followed by ${firstName}`);
  for (const f of profileFollowers) add(f.followerId, 2, isSelf ? 35 : 20, isSelf ? "Follows you" : `Follows ${firstName}`);

  // Name one shared community per candidate.
  if (communityCounts.length) {
    const rows = await prisma.communityMember.findMany({
      where: { userId: { in: communityCounts.map((c) => c.userId) }, communityId: { in: profileCommunityIds } },
      distinct: ["userId"],
      select: { userId: true, community: { select: { name: true } } },
    });
    const shared = new Map(rows.map((r) => [r.userId, r.community.name]));
    for (const c of communityCounts) {
      const n = c._count.userId;
      const name = shared.get(c.userId);
      add(c.userId, 1.5 * n, 10 + n, name ? (n > 1 ? `In ${name} + ${n - 1} more` : `In ${name}`) : "In the same communities");
    }
  }

  const nicheSet = new Set(profile.categorySubIds);
  for (const u of niche) {
    const overlap = u.categorySubIds.filter((s) => nicheSet.has(s)).length;
    add(u.id, overlap, 5 + overlap, isSelf ? "In your category" : `Similar to ${firstName}`);
  }

  // Not enough personal signal (small network, no niche picks): top up with popular, then newest accounts.
  if (candidates.size < LIMIT) {
    const fill = await prisma.user.findMany({
      where: { id: { notIn: [...exclude, ...candidates.keys()] }, isBanned: false },
      select: { id: true, _count: { select: { followers: true } } },
      orderBy: [{ followers: { _count: "desc" } }, { createdAt: "desc" }],
      take: LIMIT - candidates.size,
    });
    for (const u of fill) {
      add(u.id, 0.1 * Math.min(u._count.followers, 9), 1, u._count.followers > 0 ? "Popular on xivago" : "New to xivago");
    }
  }

  if (candidates.size === 0) return NextResponse.json({ users: [] });

  // Rank, then load profiles (dropping banned accounts the graph signals may have surfaced).
  const ranked = [...candidates.entries()].sort((a, b) => b[1].score - a[1].score).slice(0, LIMIT * 2);
  const users = await prisma.user.findMany({
    where: { id: { in: ranked.map(([uid]) => uid) }, isBanned: false },
    select: { id: true, name: true, avatarUrl: true, companyName: true, isVerified: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));

  return NextResponse.json({
    users: ranked
      .filter(([uid]) => byId.has(uid))
      .slice(0, LIMIT)
      .map(([uid, c]) => ({ ...byId.get(uid)!, reason: c.reason.text })),
  });
}
