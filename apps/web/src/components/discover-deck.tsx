"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Heart, Info, Loader2, RefreshCw, X } from "lucide-react";
import { demandsFeedQueryOptions } from "@/lib/demands-feed";
import { DemandCardData } from "@/components/demand-card";
import { DemandDetailSheet } from "@/components/demand-detail-sheet";
// import { SkeletonCard } from "@/components/skeleton-card";
import { SwipeCard } from "@/components/swipe-card";

export function DiscoverDeck() {
  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery(demandsFeedQueryOptions());

  const all = useMemo(() => data?.pages.flatMap((p) => p.demands) ?? [], [data]);
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  const stack = useMemo(() => all.filter((d) => !dismissed.has(d.id)), [all, dismissed]);

  const [exitDir, setExitDir] = useState<"left" | "right" | null>(null);
  const [detail, setDetail] = useState<DemandCardData | null>(null);
  const swipedRef = useRef<{ id: string; dir: "left" | "right" } | null>(null);

  // keep the deck fed: pull next page before we run out
  useEffect(() => {
    if (stack.length <= 2 && hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [stack.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const dismissTop = useCallback((dir: "left" | "right") => {
    setDetail((open) => {
      if (open) return open;              // don't swipe while sheet is open
      return null;
    });
    if (exitDir || stack.length === 0) return;
    swipedRef.current = { id: stack[0]!.id, dir };
    setExitDir(dir);
  }, [exitDir, stack]);

  const handleExited = useCallback(() => {
    setExitDir(null);
    const s = swipedRef.current;
    swipedRef.current = null;
    if (!s) return;
    setDismissed((prev) => new Set(prev).add(s.id));
    if (s.dir === "right") {
      const d = all.find((x) => x.id === s.id);
      if (d) setDetail(d);
    }
  }, [all]);

  // keyboard support
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (detail) return;
      if (e.key === "ArrowRight") dismissTop("right");
      if (e.key === "ArrowLeft") dismissTop("left");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dismissTop, detail]);

  if (isLoading) {
    return (
      <div className="space-y-3" aria-busy="true">
        {Array.from({ length: 2 }).map((_, i) => <div className="bg-red-500" key={i} />)}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="card-shell flex flex-col items-center gap-3 p-8 text-center">
        <p className="text-sm text-neutral-500">Couldn't load requests.</p>
        <button onClick={() => void refetch()} className="flex items-center gap-1.5 rounded-xl border px-4 py-2 text-xs font-semibold">
          <RefreshCw className="h-3.5 w-3.5" /> Try again
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="relative h-[480px]" role="group" aria-label="Discover requests. Swipe right if you’re interested, left to skip.">
        {stack.slice(0, 3).map((demand, i) => (
          <SwipeCard
            key={demand.id}
            demand={demand}
            isTop={i === 0}
            stackIndex={i}
            exitDirection={i === 0 ? exitDir : null}
            onSwipe={(dir) => dismissTop(dir)}
            onExited={handleExited}
          />
        ))}

        {stack.length === 0 && (
          <div className="card-shell flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
            <p className="text-sm font-medium">You're all caught up 🎉</p>
            <p className="text-xs text-neutral-500">New requests will appear here as they're posted.</p>
            <button
              onClick={() => { setDismissed(new Set()); void refetch(); }}
              className="flex items-center gap-1.5 rounded-xl border px-4 py-2 text-xs font-semibold"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Start over
            </button>
          </div>
        )}
      </div>

      {/* fallback controls — also makes the interaction discoverable */}
      {stack.length > 0 && (
        <div className="mt-6 flex items-center justify-center gap-5">
          <button
            aria-label="Skip this request"
            onClick={() => dismissTop("left")}
            className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-rose-500/50 text-rose-500 transition-transform active:scale-90"
          >
            <X className="h-5 w-5" />
          </button>
          <button
            aria-label="View details"
            onClick={() => stack[0] && setDetail(stack[0])}
            className="flex h-10 w-10 items-center justify-center rounded-full border text-neutral-500 transition-transform active:scale-90"
          >
            <Info className="h-4 w-4" />
          </button>
          <button
            aria-label="I'm interested"
            onClick={() => dismissTop("right")}
            className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-teal-500/50 text-teal-500 transition-transform active:scale-90"
          >
            <Heart className="h-5 w-5" />
          </button>
        </div>
      )}

      {isFetchingNextPage && (
        <div className="flex justify-center pt-3"><Loader2 className="h-4 w-4 animate-spin text-neutral-400" /></div>
      )}

      {detail && <DemandDetailSheet demand={detail} onClose={() => setDetail(null)} />}
    </>
  );
}