import type { ForumReactions } from "@/components/forum/types";

/** Optimistic local update after a successful react call -- avoids a full refetch just to reflect one click. */
export function bumpReaction(reactions: ForumReactions, emoji: string): ForumReactions {
  const counts = { ...reactions.counts };
  let total = reactions.total;
  if (reactions.myReaction) {
    counts[reactions.myReaction] = Math.max(0, (counts[reactions.myReaction] ?? 1) - 1);
  } else {
    total += 1;
  }
  counts[emoji] = (counts[emoji] ?? 0) + 1;
  return { counts, total, myReaction: emoji };
}

export function clearMyReaction(reactions: ForumReactions): ForumReactions {
  if (!reactions.myReaction) return reactions;
  const counts = { ...reactions.counts };
  counts[reactions.myReaction] = Math.max(0, (counts[reactions.myReaction] ?? 1) - 1);
  return { counts, total: Math.max(0, reactions.total - 1), myReaction: null };
}
