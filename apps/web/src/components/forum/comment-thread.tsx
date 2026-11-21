"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { ReactionBar } from "./reaction-bar";
import { ReportMenu } from "./report-menu";
import { ReplyBar } from "./reply-bar";
import { timeAgo } from "@/lib/time";
import { bumpReaction, clearMyReaction } from "@/lib/forum-client";
import { cn } from "@/lib/utils";
import type { ForumComment } from "./types";

interface CommentThreadProps {
  postId: string;
  onCountChange?: (delta: number) => void;
  /** "inline" sits under a feed card; "page" is the full post page, with the reply box pinned. */
  layout?: "inline" | "page";
  /** Comment to scroll to and flash once loaded (from a notification link). */
  focusCommentId?: string | null;
}

const FLASH_MS = 1600;

export function CommentThread({ postId, onCountChange, layout = "inline", focusCommentId }: CommentThreadProps) {
  const [comments, setComments] = useState<ForumComment[] | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const focusedRef = useRef<string | null>(null);
  const isPage = layout === "page";

  useEffect(() => {
    (async () => {
      const qs = focusCommentId ? `?focus=${encodeURIComponent(focusCommentId)}` : "";
      const res = await fetch(`/api/forum/${postId}/comments${qs}`);
      setComments(res.ok ? (await res.json()).comments : []);
    })();
  }, [postId, focusCommentId]);

  // Once the comments are in, bring the linked one into view and flash it, once per link.
  useEffect(() => {
    if (!comments || !focusCommentId || focusedRef.current === focusCommentId) return;
    focusedRef.current = focusCommentId;
    const el = document.getElementById(`comment-${focusCommentId}`);
    if (!el) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() => el.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" }));
    setFlashId(focusCommentId);
    const t = setTimeout(() => setFlashId(null), FLASH_MS);
    return () => clearTimeout(t);
  }, [comments, focusCommentId]);

  async function handleReact(commentId: string, emoji: string) {
    const res = await fetch(`/api/forum/comments/${commentId}/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    });
    if (!res.ok) return;
    setComments((prev) =>
      (prev ?? []).map((c) =>
        c.id === commentId ? { ...c, reactions: bumpReaction(c.reactions, emoji) } : c,
      ),
    );
  }

  async function handleRemoveReaction(commentId: string) {
    await fetch(`/api/forum/comments/${commentId}/react`, { method: "DELETE" });
    setComments((prev) =>
      (prev ?? []).map((c) => (c.id === commentId ? { ...c, reactions: clearMyReaction(c.reactions) } : c)),
    );
  }

  async function handleDelete(commentId: string) {
    const res = await fetch(`/api/forum/comments/${commentId}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Could not delete this comment.");
      return;
    }
    setComments((prev) => (prev ?? []).filter((c) => c.id !== commentId));
    onCountChange?.(-1);
  }

  async function handleReport(commentId: string, reason: string) {
    await fetch(`/api/forum/comments/${commentId}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
  }

  return (
    <div className={cn(isPage ? "contents" : "mt-0 border-t border-neutral-100 px-1 pt-3 dark:border-neutral-800/70")}>
      {comments === null && (
        <div className="flex justify-center py-3 text-neutral-400">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      )}

      {isPage && comments?.length === 0 && (
        <p className="flex-1 px-4 py-10 text-center text-sm text-neutral-500">No replies yet. Be the first to reply.</p>
      )}

      <div className={cn(isPage ? "flex-1 divide-y divide-neutral-800" : "space-y-4", isPage && comments?.length === 0 && "hidden")}>
        {comments?.map((c) => (
          <div
            key={c.id}
            id={`comment-${c.id}`}
            className={cn(
              "flex scroll-mt-20 gap-2.5 transition-colors duration-700 ease-out",
              isPage ? "px-4 py-3" : "-mx-1 rounded-lg px-1",
              flashId === c.id ? "bg-brand-500/20 duration-150" : "bg-transparent",
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={c.sender.avatarUrl ?? "/icons/avatar-placeholder.svg"}
              alt={c.sender.name}
              className={cn("shrink-0 rounded-full bg-neutral-100 object-cover dark:bg-neutral-800", isPage ? "h-9 w-9" : "h-7 w-7")}
            />
            <div className="min-w-0 flex-1">
              <div className={cn("flex items-center justify-between gap-2", isPage && "h-5")}>
                <div className="flex min-w-0 items-baseline gap-1.5">
                  <span className={cn("truncate font-semibold text-neutral-900 dark:text-neutral-100", isPage ? "text-[15px]" : "text-xs")}>
                    {c.sender.name}
                  </span>
                  <span className="shrink-0 text-[11px] text-neutral-400">{timeAgo(c.createdAt)}</span>
                </div>
                <ReportMenu
                  canDelete={c.isMine}
                  onDelete={() => handleDelete(c.id)}
                  onReport={(reason) => handleReport(c.id, reason)}
                />
              </div>
              <p className={cn("mt-0.5 whitespace-pre-wrap break-words text-neutral-800 dark:text-neutral-200", isPage ? "text-[15px] leading-6" : "text-sm leading-5")}>
                {c.text}
              </p>
              <div className="mt-1 flex items-center">
                <ReactionBar
                  counts={c.reactions.counts}
                  total={c.reactions.total}
                  myReaction={c.reactions.myReaction}
                  onReact={(emoji) => handleReact(c.id, emoji)}
                  onRemove={() => handleRemoveReaction(c.id)}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <ReplyBar
        postId={postId}
        placeholder={isPage ? "Post your reply" : "Reply…"}
        onPosted={(comment) => {
          setComments((prev) => [...(prev ?? []), comment]);
          onCountChange?.(1);
        }}
        // Pinned above the 80px bottom nav, like X's reply box.
        className={isPage ? "sticky bottom-20 z-10 mt-auto border-t border-neutral-800 bg-black px-4 py-2" : "mt-4"}
      />
    </div>
  );
}