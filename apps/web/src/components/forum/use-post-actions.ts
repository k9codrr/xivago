"use client";

import { useState } from "react";
import { toast } from "sonner";
import { haptic } from "@/lib/haptics";
import { bumpReaction, clearMyReaction } from "@/lib/forum-client";
import type { ForumPost } from "./types";

type UpdatePost = (postId: string, updater: (post: ForumPost) => ForumPost) => void;

/** What can be done to a post, shared by the feed card, post page and media viewer. */
export function usePostActions(post: ForumPost, onUpdate: UpdatePost, onRemove: (postId: string) => void) {
  const [voting, setVoting] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  async function vote(optionId: string) {
    if (voting || !post.poll) return;
    void haptic("selection");
    setVoting(true);
    try {
      const res = await fetch(`/api/forum/${post.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        void haptic("error");
        toast.error(data?.error?.message ?? "Could not record your vote.");
        return;
      }
      onUpdate(post.id, (p) => {
        if (!p.poll) return p;
        const prevChoice = p.poll.myVoteOptionId;
        return {
          ...p,
          poll: {
            ...p.poll,
            myVoteOptionId: optionId,
            totalVotes: prevChoice ? p.poll.totalVotes : p.poll.totalVotes + 1,
            options: p.poll.options.map((o) => {
              if (o.id === optionId) return { ...o, voteCount: o.voteCount + 1 };
              if (o.id === prevChoice) return { ...o, voteCount: Math.max(0, o.voteCount - 1) };
              return o;
            }),
          },
        };
      });
    } finally {
      setVoting(false);
    }
  }

  async function react(emoji: string) {
    void haptic("light");
    const res = await fetch(`/api/forum/${post.id}/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    });
    if (!res.ok) return;
    onUpdate(post.id, (p) => ({ ...p, reactions: bumpReaction(p.reactions, emoji) }));
  }

  async function unreact() {
    void haptic("light");
    await fetch(`/api/forum/${post.id}/react`, { method: "DELETE" });
    onUpdate(post.id, (p) => ({ ...p, reactions: clearMyReaction(p.reactions) }));
  }

  async function remove() {
    const res = await fetch(`/api/forum/${post.id}`, { method: "DELETE" });
    if (!res.ok) {
      void haptic("error");
      toast.error("Could not delete this post.");
      return;
    }
    void haptic("success");
    onRemove(post.id);
  }

  async function report(reason: string) {
    await fetch(`/api/forum/${post.id}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
  }

  /** Opens the share drawer (send to people in the app, or to other apps). */
  function share() {
    void haptic("light");
    setShareOpen(true);
  }

  /** Optimistic toggle; rolls back if the server refuses, then trusts the server's count. */
  async function toggleRepost() {
    const next = !post.isReposted;
    void haptic(next ? "medium" : "light");
    onUpdate(post.id, (p) => ({ ...p, isReposted: next, repostCount: Math.max(0, p.repostCount + (next ? 1 : -1)) }));
    const res = await fetch(`/api/forum/${post.id}/repost`, { method: next ? "POST" : "DELETE" });
    if (!res.ok) {
      void haptic("error");
      toast.error(res.status === 401 ? "Sign in to repost." : "Could not update your repost.");
      onUpdate(post.id, (p) => ({ ...p, isReposted: !next, repostCount: Math.max(0, p.repostCount + (next ? -1 : 1)) }));
      return;
    }
    const { count } = (await res.json()) as { count: number };
    onUpdate(post.id, (p) => ({ ...p, repostCount: count }));
    if (next) toast.success("Reposted to your profile");
  }

  async function toggleBookmark() {
    const next = !post.isBookmarked;
    void haptic(next ? "success" : "light");
    onUpdate(post.id, (p) => ({ ...p, isBookmarked: next, bookmarkCount: Math.max(0, p.bookmarkCount + (next ? 1 : -1)) }));
    const res = await fetch(`/api/forum/${post.id}/bookmark`, { method: next ? "POST" : "DELETE" });
    if (!res.ok) {
      void haptic("error");
      toast.error(res.status === 401 ? "Sign in to save posts." : "Could not update your bookmark.");
      onUpdate(post.id, (p) => ({ ...p, isBookmarked: !next, bookmarkCount: Math.max(0, p.bookmarkCount + (next ? -1 : 1)) }));
      return;
    }
    const { count } = (await res.json()) as { count: number };
    onUpdate(post.id, (p) => ({ ...p, bookmarkCount: count }));
    toast.success(next ? "Saved to bookmarks" : "Removed from bookmarks");
  }

  /** Called by the share drawer with the server's fresh total after any share. */
  function setShareCount(shareCount: number) {
    onUpdate(post.id, (p) => ({ ...p, shareCount }));
  }

  function changeCommentCount(delta: number) {
    onUpdate(post.id, (p) => ({ ...p, commentCount: Math.max(0, p.commentCount + delta) }));
  }

  return {
    vote,
    react,
    unreact,
    remove,
    report,
    share,
    shareOpen,
    setShareOpen,
    setShareCount,
    toggleRepost,
    toggleBookmark,
    changeCommentCount,
  };
}
