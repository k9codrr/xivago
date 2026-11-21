"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, MessageCircle } from "lucide-react";
import { ReelVideo } from "@/components/reels/reel-video";
import { PostText } from "@/components/forum/post-content";
import { ReactionBar } from "@/components/forum/reaction-bar";
import { PostEngagementButtons } from "@/components/forum/post-engagement-buttons";
import { usePostActions } from "@/components/forum/use-post-actions";
import { formatCount } from "@/lib/format-count";
import type { ForumAttachment, ForumPost } from "@/components/forum/types";

interface ReelItem {
  key: string;
  attachment: ForumAttachment;
  post: ForumPost;
}

const BATCH = 8;
/** Start fetching more this many reels before the end. */
const PREFETCH_AT = 3;

const RAIL_BUTTON = "flex flex-col items-center gap-1 text-white [&_svg]:drop-shadow";

function ReelSlide({
  item,
  active,
  near,
  muted,
  onMutedChange,
  onUpdate,
}: {
  item: ReelItem;
  active: boolean;
  near: boolean;
  muted: boolean;
  onMutedChange: (muted: boolean) => void;
  onUpdate: (postId: string, updater: (p: ForumPost) => ForumPost) => void;
}) {
  const { post } = item;
  const actions = usePostActions(post, onUpdate, () => {});
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="relative h-dvh w-full shrink-0 snap-start snap-always overflow-hidden" aria-label={`Video by ${post.sender.name}`}>
      <ReelVideo
        src={item.attachment.url}
        active={active}
        preload={active || near ? "auto" : "none"}
        muted={muted}
        onMutedChange={onMutedChange}
      />

      {/* Readability gradient behind the caption */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

      {/* Right action rail */}
      <div className="absolute bottom-24 right-2 z-10 flex flex-col items-center gap-5 [&_button]:flex-col [&_button]:gap-1 [&_button]:text-white">
        <div className={RAIL_BUTTON}>
          <ReactionBar
            counts={post.reactions.counts}
            total={post.reactions.total}
            myReaction={post.reactions.myReaction}
            onReact={actions.react}
            onRemove={actions.unreact}
          />
        </div>
        <Link href={`/forum/${post.id}`} aria-label="Comments" className={RAIL_BUTTON}>
          <MessageCircle className="h-7 w-7" />
          <span className="text-xs font-semibold tabular-nums">{formatCount(post.commentCount)}</span>
        </Link>
        <PostEngagementButtons post={post} actions={actions} size={26} countClassName="text-xs font-semibold text-white" />
      </div>

      {/* Author + caption */}
      <div className="absolute bottom-10 left-0 right-16 z-10 space-y-2 px-4">
        <Link href={`/u/${post.sender.id}`} className="flex w-fit max-w-full items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.sender.avatarUrl ?? "/icons/avatar-placeholder.svg"}
            alt=""
            className="h-9 w-9 shrink-0 rounded-full border border-white/30 bg-neutral-800 object-cover"
          />
          <span className="truncate text-[15px] font-semibold text-white drop-shadow">
            {post.sender.companyName ?? post.sender.name}
          </span>
        </Link>
        {post.community && (
          <Link href={`/communities/${post.community.id}`} className="block w-fit text-xs font-semibold text-white/80">
            in {post.community.name}
          </Link>
        )}
        {post.text && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="block text-left text-[14px] leading-snug text-white drop-shadow"
          >
            <span className={expanded ? "whitespace-pre-wrap break-words" : "line-clamp-2 break-words"}>
              <PostText text={post.text} />
            </span>
          </button>
        )}
      </div>
    </section>
  );
}

function Reels() {
  const { postId } = useParams<{ postId: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<ReelItem[] | null>(null);
  const [active, setActive] = useState(0);
  const [muted, setMuted] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const seen = useRef(new Set<string>());

  const fetchReels = useCallback(async (first: boolean) => {
    const q = new URLSearchParams({ limit: String(BATCH) });
    if (first) {
      q.set("start", postId);
      q.set("v", params.get("v") ?? "0");
    }
    if (seen.current.size) q.set("exclude", [...seen.current].join(","));
    const res = await fetch(`/api/forum/reels?${q}`);
    if (!res.ok) return [];
    return ((await res.json()) as { reels: ReelItem[] }).reels;
  }, [postId, params]);

  /** Keeps only reels not shown yet, and marks them shown. */
  const takeUnseen = useCallback((reels: ReelItem[]) => {
    const fresh = reels.filter((r) => !seen.current.has(r.post.id));
    fresh.forEach((r) => seen.current.add(r.post.id));
    return fresh;
  }, []);

  useEffect(() => {
    let cancelled = false;
    seen.current = new Set();
    fetchReels(true).then((reels) => {
      if (cancelled) return; // a newer load replaced this one
      const first = takeUnseen(reels);
      if (first.length === 0) router.replace(`/forum/${postId}`);
      else setItems(first);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchReels, takeUnseen, postId, router]);

  // Which reel fills the screen.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || !items) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index));
        }
      },
      { root: scroller, threshold: 0.6 },
    );
    scroller.querySelectorAll<HTMLElement>("[data-index]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items]);

  // Near the end: load the next ranked batch.
  useEffect(() => {
    if (!items || loadingMore || exhausted || active < items.length - PREFETCH_AT) return;
    setLoadingMore(true);
    fetchReels(false)
      .then((reels) => {
        const more = takeUnseen(reels);
        if (more.length === 0) setExhausted(true);
        else setItems((cur) => [...(cur ?? []), ...more]);
      })
      .finally(() => setLoadingMore(false));
  }, [active, items, loadingMore, exhausted, fetchReels, takeUnseen]);

  const update = useCallback((id: string, updater: (p: ForumPost) => ForumPost) => {
    setItems((cur) => (cur ?? []).map((r) => (r.post.id === id ? { ...r, post: updater(r.post) } : r)));
  }, []);

  return (
    <div className="fixed inset-0 z-[70] bg-black text-white">
      <button
        type="button"
        onClick={() => (window.history.length > 1 ? router.back() : router.push("/forum"))}
        aria-label="Back"
        className="absolute left-4 top-[max(env(safe-area-inset-top),0.75rem)] z-30 flex h-11 w-11 items-center justify-center rounded-full bg-black/45 backdrop-blur"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>

      {!items ? (
        <div className="flex h-full items-center justify-center text-neutral-500">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div
          ref={scrollerRef}
          data-swipe-zone // keeps vertical swipes from switching the app's tabs
          className="[scrollbar-width:none] [&::-webkit-scrollbar]:hidden h-full snap-y snap-mandatory overflow-y-auto overscroll-contain"
        >
          {items.map((item, i) => (
            <div key={item.key} data-index={i}>
              <ReelSlide
                item={item}
                active={i === active}
                near={Math.abs(i - active) === 1}
                muted={muted}
                onMutedChange={setMuted}
                onUpdate={update}
              />
            </div>
          ))}
          {exhausted && (
            <div className="flex h-40 snap-end items-center justify-center text-sm text-neutral-500">
              You&apos;re all caught up
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ReelsPage() {
  return (
    <Suspense fallback={<div className="fixed inset-0 z-[70] bg-black" />}>
      <Reels />
    </Suspense>
  );
}
