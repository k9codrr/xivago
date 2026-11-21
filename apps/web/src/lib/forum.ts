import "server-only";
import { prisma } from "@/lib/db";
import type { ForumReactionTarget } from "@slotbook/db";

export interface ReactionSummary {
  counts: Record<string, number>; // emoji -> count
  total: number;
  myReaction: string | null;
}

/**
 * Batch-loads reaction summaries for a list of targets (posts or comments)
 * in exactly 2 queries regardless of list size -- `ForumReaction.targetId`
 * is a polymorphic plain column (no `@relation`, see schema.prisma), so
 * Prisma can't do this via `include`/`_count` the normal way; it's grouped
 * in application code instead.
 */
export async function getReactionSummaries(
  targetType: ForumReactionTarget,
  targetIds: string[],
  viewerId: string | null,
): Promise<Map<string, ReactionSummary>> {
  const result = new Map<string, ReactionSummary>();
  if (targetIds.length === 0) return result;

  const reactions = await prisma.forumReaction.findMany({
    where: { targetType, targetId: { in: targetIds } },
    select: { targetId: true, userId: true, emoji: true },
  });

  for (const id of targetIds) {
    result.set(id, { counts: {}, total: 0, myReaction: null });
  }

  for (const r of reactions) {
    const entry = result.get(r.targetId);
    if (!entry) continue;
    entry.counts[r.emoji] = (entry.counts[r.emoji] ?? 0) + 1;
    entry.total += 1;
    if (viewerId && r.userId === viewerId) entry.myReaction = r.emoji;
  }

  return result;
}

export async function getCommentCounts(messageIds: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (messageIds.length === 0) return result;

  const counts = await prisma.forumComment.groupBy({
    by: ["messageId"],
    where: { messageId: { in: messageIds }, deletedAt: null },
    _count: { _all: true },
  });
  for (const c of counts) result.set(c.messageId, c._count._all);
  return result;
}

/**
 * Visibility rule for an attachment: visible to everyone once APPROVED;
 * visible to the post's own author (or an admin) while PENDING so they
 * know it's there and awaiting review; never visible once REJECTED except
 * to an admin. See DECISIONS.md #45.
 */
export function isAttachmentVisible(
  status: "PENDING" | "APPROVED" | "REJECTED",
  isOwnerOrAdmin: boolean,
): boolean {
  if (status === "APPROVED") return true;
  if (status === "PENDING") return isOwnerOrAdmin;
  return false;
}

/** Reacting again with a different emoji replaces the previous one -- see schema.prisma's ForumReaction unique constraint and DECISIONS.md #46. */
export async function upsertReaction(
  targetType: ForumReactionTarget,
  targetId: string,
  userId: string,
  emoji: string,
) {
  return prisma.forumReaction.upsert({
    where: { targetType_targetId_userId: { targetType, targetId, userId } },
    update: { emoji },
    create: { targetType, targetId, userId, emoji },
  });
}

export async function removeReaction(targetType: ForumReactionTarget, targetId: string, userId: string) {
  await prisma.forumReaction.deleteMany({ where: { targetType, targetId, userId } });
}

/** Batch-loads which option (if any) the viewer voted for, per poll -- mirrors getReactionSummaries' shape. */
export async function getViewerPollVotes(
  pollIds: string[],
  viewerId: string | null,
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (!viewerId || pollIds.length === 0) return result;

  const votes = await prisma.forumPollVote.findMany({
    where: { pollId: { in: pollIds }, userId: viewerId },
    select: { pollId: true, optionId: true },
  });
  for (const v of votes) result.set(v.pollId, v.optionId);
  return result;
}

export interface PostEngagement {
  repostCount: number;
  shareCount: number;
  bookmarkCount: number;
  isReposted: boolean;
  isBookmarked: boolean;
}

export const EMPTY_ENGAGEMENT: PostEngagement = {
  repostCount: 0,
  shareCount: 0,
  bookmarkCount: 0,
  isReposted: false,
  isBookmarked: false,
};

/** Batch-loads repost/share/bookmark counts and the viewer's own state, in 5 queries regardless of list size. */
export async function getPostEngagement(
  postIds: string[],
  viewerId: string | null,
): Promise<Map<string, PostEngagement>> {
  const result = new Map<string, PostEngagement>();
  if (postIds.length === 0) return result;
  for (const id of postIds) result.set(id, { ...EMPTY_ENGAGEMENT });

  const where = { postId: { in: postIds } };
  const [reposts, shares, bookmarks, myReposts, myBookmarks] = await Promise.all([
    prisma.forumRepost.groupBy({ by: ["postId"], where, _count: { _all: true } }),
    prisma.forumShare.groupBy({ by: ["postId"], where, _count: { _all: true } }),
    prisma.forumBookmark.groupBy({ by: ["postId"], where, _count: { _all: true } }),
    viewerId ? prisma.forumRepost.findMany({ where: { ...where, userId: viewerId }, select: { postId: true } }) : [],
    viewerId ? prisma.forumBookmark.findMany({ where: { ...where, userId: viewerId }, select: { postId: true } }) : [],
  ]);

  for (const r of reposts) result.get(r.postId)!.repostCount = r._count._all;
  for (const s of shares) result.get(s.postId)!.shareCount = s._count._all;
  for (const b of bookmarks) result.get(b.postId)!.bookmarkCount = b._count._all;
  for (const r of myReposts) result.get(r.postId)!.isReposted = true;
  for (const b of myBookmarks) result.get(b.postId)!.isBookmarked = true;
  return result;
}
