"use client";

import { Bookmark, Repeat2, Send } from "lucide-react";
import { formatCount } from "@/lib/format-count";
import { cn } from "@/lib/utils";
import { ShareDrawer } from "./share-drawer";
import type { usePostActions } from "./use-post-actions";
import type { ForumPost } from "./types";

type PostActions = ReturnType<typeof usePostActions>;

interface Props {
  post: ForumPost;
  actions: PostActions;
  /** Icon size in px; the feed card uses 18, the post page 20. */
  size?: number;
  /** Extra classes for each button (e.g. the media viewer's pill style). */
  buttonClassName?: string;
  /** Count text classes. */
  countClassName?: string;
}

function Count({ n, className }: { n: number; className?: string }) {
  if (n <= 0) return null;
  return <span className={cn("text-xs tabular-nums", className)}>{formatCount(n)}</span>;
}

/** Repost, bookmark and share buttons with counts, plus the share drawer they open. */
export function PostEngagementButtons({ post, actions, size = 18, buttonClassName, countClassName }: Props) {
  const iconStyle = { width: size, height: size };

  return (
    <>
      <button
        type="button"
        onClick={actions.toggleRepost}
        aria-label={post.isReposted ? "Undo repost" : "Repost"}
        aria-pressed={post.isReposted}
        className={cn(
          "flex items-center gap-1.5 transition-colors",
          buttonClassName,
          post.isReposted ? "text-mint" : "text-neutral-400 hover:text-mint",
        )}
      >
        <Repeat2 style={iconStyle} strokeWidth={post.isReposted ? 2.5 : 2} />
        <Count n={post.repostCount} className={countClassName} />
      </button>

      <button
        type="button"
        onClick={actions.toggleBookmark}
        aria-label={post.isBookmarked ? "Remove bookmark" : "Bookmark"}
        aria-pressed={post.isBookmarked}
        className={cn(
          "flex items-center gap-1.5 transition-colors",
          buttonClassName,
          post.isBookmarked ? "text-amber-400" : "text-neutral-400 hover:text-amber-400",
        )}
      >
        <Bookmark style={iconStyle} className={cn(post.isBookmarked && "fill-current")} />
        <Count n={post.bookmarkCount} className={countClassName} />
      </button>

      <button
        type="button"
        onClick={actions.share}
        aria-label="Share"
        className={cn("flex items-center gap-1.5 transition-colors", buttonClassName, "text-neutral-400 hover:text-brand-600")}
      >
        <Send style={{ width: size - 1, height: size - 1 }} />
        <Count n={post.shareCount} className={countClassName} />
      </button>

      <ShareDrawer
        post={post}
        open={actions.shareOpen}
        onOpenChange={actions.setShareOpen}
        onShared={actions.setShareCount}
        onToggleBookmark={actions.toggleBookmark}
      />
    </>
  );
}
