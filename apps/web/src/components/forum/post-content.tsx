"use client";

import { Fragment } from "react";
import Link from "next/link";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ForumAttachment, ForumPoll, ForumPost } from "./types";

export const isVideo = (a: ForumAttachment) => a.contentType.startsWith("video/");

/** Turns "@handle" tokens into links -- to the community with that slug, or
 * else the person with that username (resolved by /m/[handle]). */
export function PostText({ text }: { text: string }) {
  const parts = text.split(/((?:^|(?<=\s))@[a-z0-9_-]+)/gi);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("@") && part.length > 1 ? (
          <Link
            key={i}
            href={`/m/${encodeURIComponent(part.slice(1).toLowerCase())}`}
            prefetch={false}
            onClick={(e) => e.stopPropagation()}
            className="font-medium text-brand-600 hover:underline"
          >
            {part}
          </Link>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

function MediaThumb({ item, className }: { item: ForumAttachment; className: string }) {
  if (isVideo(item)) {
    return (
      <>
        {/* #t jumps past a blank first frame so the still shows on mobile; it plays in the viewer. */}
        <video src={`${item.url}#t=0.1`} muted playsInline preload="metadata" className={cn("pointer-events-none", className)} />
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur">
            <Play className="ml-0.5 h-5 w-5 fill-current" />
          </span>
        </span>
      </>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={item.url} alt="" draggable={false} className={className} />;
}

/** Videos open full-screen in reels (swipe up for more); images open in the media viewer. */
function mediaHref(postId: string, item: ForumAttachment, index: number): string {
  return isVideo(item) ? `/reels/${postId}?v=${index}` : `/forum/${postId}/media/${index}`;
}

interface PostMediaProps {
  post: Pick<ForumPost, "id" | "attachments">;
  className?: string;
  /** Margins and padding that let a multi-item row run to the screen edges from where it sits. */
  bleedClassName: string;
}

/** One item fills the column; several become a sideways swipe row with the next one peeking in. */
export function PostMedia({ post, className, bleedClassName }: PostMediaProps) {
  const items = post.attachments;
  if (items.length === 0) return null;

  if (items.length === 1) {
    return (
      <Link
        href={mediaHref(post.id, items[0]!, 0)}
        aria-label="View media"
        className={cn("relative block overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800", className)}
      >
        <MediaThumb item={items[0]!} className="max-h-[420px] w-full object-cover" />
      </Link>
    );
  }

  return (
    <div
      data-swipe-zone // keeps these swipes from switching the app's tabs
      className={cn("[scrollbar-width:none] [&::-webkit-scrollbar]:hidden flex snap-x snap-mandatory gap-2 overflow-x-auto", bleedClassName, className)}
    >
      {items.map((item, i) => (
        <Link
          key={item.id}
          href={mediaHref(post.id, item, i)}
          aria-label={`View media ${i + 1} of ${items.length}`}
          className="relative h-72 w-[82%] shrink-0 snap-start overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800"
        >
          <MediaThumb item={item} className="h-full w-full object-cover" />
        </Link>
      ))}
    </div>
  );
}

function closesIn(iso: string): string {
  const diffMs = new Date(iso).getTime() - Date.now();
  if (diffMs <= 0) return "closed";
  const hours = Math.round(diffMs / 3600000);
  if (hours < 1) return "closes in <1h";
  if (hours < 24) return `closes in ${hours}h`;
  return `closes in ${Math.round(hours / 24)}d`;
}

export function PostPoll({ poll, onVote, className }: { poll: ForumPoll; onVote: (optionId: string) => void; className?: string }) {
  return (
    <div data-post-no-open className={cn("cursor-auto space-y-1.5 rounded-2xl border border-neutral-200 p-3 dark:border-neutral-800", className)}>
      {poll.options.map((o) => {
        const pct = poll.totalVotes > 0 ? Math.round((o.voteCount / poll.totalVotes) * 100) : 0;
        const mine = poll.myVoteOptionId === o.id;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onVote(o.id)}
            className="relative block w-full overflow-hidden rounded-xl border border-neutral-200 px-3 py-2 text-left text-sm dark:border-neutral-700"
          >
            <div className="absolute inset-y-0 left-0 bg-brand-50 dark:bg-brand-900/30" style={{ width: `${pct}%` }} />
            <div className="relative flex items-center justify-between">
              <span className={mine ? "font-semibold text-brand-700 dark:text-brand-300" : "text-neutral-800 dark:text-neutral-200"}>
                {o.text}
              </span>
              <span className="text-xs text-neutral-400">{pct}%</span>
            </div>
          </button>
        );
      })}
      <p className="pt-0.5 text-xs text-neutral-400">
        {poll.totalVotes} vote{poll.totalVotes === 1 ? "" : "s"}
        {poll.closesAt && ` · ${closesIn(poll.closesAt)}`}
      </p>
    </div>
  );
}
