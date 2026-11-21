"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, MessageCircle } from "lucide-react";
import { isVideo, PostText } from "@/components/forum/post-content";
import { ReactionBar } from "@/components/forum/reaction-bar";
import { ReplyBar } from "@/components/forum/reply-bar";
import { useForumPost } from "@/components/forum/use-forum-post";
import { usePostActions } from "@/components/forum/use-post-actions";
import { PostEngagementButtons } from "@/components/forum/post-engagement-buttons";
import { formatCount } from "@/lib/format-count";
import type { ForumPost } from "@/components/forum/types";

const PILL = "flex h-11 items-center justify-center gap-2 rounded-full bg-white/10 px-5 text-sm text-white transition-colors active:bg-white/20";

function MediaViewer({ post, startIndex, onUpdate, onRemove }: {
  post: ForumPost;
  startIndex: number;
  onUpdate: (id: string, updater: (p: ForumPost) => ForumPost) => void;
  onRemove: (id: string) => void;
}) {
  const router = useRouter();
  const actions = usePostActions(post, onUpdate, onRemove);
  const trackRef = useRef<HTMLDivElement>(null);
  const items = post.attachments;
  const [active, setActive] = useState(startIndex);

  // Open on the item that was tapped.
  const opened = useRef(false);
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track || opened.current) return;
    opened.current = true;
    track.scrollLeft = startIndex * track.clientWidth;
  }, [startIndex]);

  // Only the visible video plays.
  useEffect(() => {
    trackRef.current?.querySelectorAll("video").forEach((video) => {
      if (Number(video.dataset.index) === active) void video.play().catch(() => {});
      else video.pause();
    });
  }, [active]);

  return (
    <div className="fixed inset-0 z-[60] flex h-dvh flex-col bg-black text-white">
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),0.75rem)]">
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? router.back() : router.push(`/forum/${post.id}`))}
          aria-label="Back"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        {items.length > 1 && (
          <span className="rounded-full bg-black/60 px-3 py-1 text-xs font-semibold tabular-nums backdrop-blur">
            {active + 1} / {items.length}
          </span>
        )}
      </div>

      <div
        ref={trackRef}
        data-swipe-zone
        onScroll={(e) => {
          const track = e.currentTarget;
          setActive(Math.round(track.scrollLeft / Math.max(track.clientWidth, 1)));
        }}
        className="[scrollbar-width:none] [&::-webkit-scrollbar]:hidden flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto"
      >
        {items.map((item, i) => (
          <div key={item.id} className="flex h-full w-full shrink-0 snap-center items-center justify-center">
            {isVideo(item) ? (
              <video src={item.url} data-index={i} controls playsInline className="max-h-full w-full object-contain" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.url} alt="" draggable={false} className="max-h-full w-full object-contain" />
            )}
          </div>
        ))}
      </div>

      <div className="shrink-0 space-y-3 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3">
        <Link href={`/u/${post.sender.id}`} className="flex w-fit max-w-full items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.sender.avatarUrl ?? "/icons/avatar-placeholder.svg"} alt={post.sender.name} className="h-9 w-9 shrink-0 rounded-full bg-neutral-800 object-cover" />
          <span className="min-w-0 truncate text-[15px] font-semibold">{post.sender.companyName ?? post.sender.name}</span>
        </Link>

        <Link href={`/forum/${post.id}`} className="block">
          <span className="line-clamp-2 whitespace-pre-wrap break-words text-[15px] leading-snug text-white">
            <PostText text={post.text} />
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <Link href={`/forum/${post.id}`} aria-label="View replies" className={PILL}>
            <MessageCircle className="h-5 w-5" />
            {formatCount(post.commentCount)}
          </Link>
          <div className={PILL}>
            <ReactionBar
              counts={post.reactions.counts}
              total={post.reactions.total}
              myReaction={post.reactions.myReaction}
              onReact={actions.react}
              onRemove={actions.unreact}
            />
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <PostEngagementButtons post={post} actions={actions} buttonClassName={`${PILL} px-3.5`} countClassName="text-sm" />
          </div>
        </div>

        <ReplyBar postId={post.id} onPosted={() => actions.changeCommentCount(1)} />
      </div>
    </div>
  );
}

export default function ForumMediaPage() {
  const { id, index } = useParams<{ id: string; index: string }>();
  const router = useRouter();
  const { post, isLoading, update, removeFromFeed } = useForumPost(id);

  const hasMedia = Boolean(post && post.attachments.length > 0);

  // Nothing to show here (bad link, or the media was removed): fall back to the post.
  useEffect(() => {
    if (!isLoading && !hasMedia) router.replace(`/forum/${id}`);
  }, [isLoading, hasMedia, id, router]);

  if (!post || !hasMedia) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black text-neutral-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const parsed = Number.parseInt(index, 10);
  const startIndex = Number.isNaN(parsed) ? 0 : Math.min(Math.max(parsed, 0), post.attachments.length - 1);

  return (
    <MediaViewer
      post={post}
      startIndex={startIndex}
      onUpdate={update}
      onRemove={(postId) => {
        removeFromFeed(postId);
        router.replace("/forum");
      }}
    />
  );
}
