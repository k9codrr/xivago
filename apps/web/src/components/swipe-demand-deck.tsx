"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2, MapPin, RotateCcw, Wallet, X } from "lucide-react";
import { CountdownBadge } from "@/components/countdown-badge";
import { PriorityBadge } from "@/components/priority-badge";
import { formatBudgetRange } from "@/lib/money";
import type { DemandCardData } from "@/components/demand-card";
import type { FeedFilters } from "@/lib/demands-feed";
import { haptic } from "@/lib/haptics";

const STORAGE_KEY = "dismissed-demands";
const SWIPE_THRESHOLD = 100;

function loadDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

function saveDismissed(ids: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
}

const SWIPE_SPRING = { type: "spring", stiffness: 320, damping: 26, mass: 0.9 } as const;

export function SwipeDemandDeck({ filters = {} }: { filters?: FeedFilters }) {
  const router = useRouter();
  const [dismissed, setDismissed] = React.useState<Set<string>>(loadDismissed);
  const [dragX, setDragX] = React.useState(0);
  const [exitDir, setExitDir] = React.useState<"left" | "right" | null>(null);
  const topCardRef = React.useRef<string | null>(null); // demand being swiped

  const { data, isLoading } = useQuery({
    queryKey: ["demands-deck", filters],
    queryFn: async () => {
      const url = new URL("/api/demands", window.location.origin);
      if (filters.category) url.searchParams.set("category", filters.category);
      if (filters.subCategory) url.searchParams.set("subCategory", filters.subCategory);
      if (filters.lat != null) url.searchParams.set("lat", filters.lat.toString());
      if (filters.lng != null) url.searchParams.set("lng", filters.lng.toString());
      if (filters.radiusKm != null) url.searchParams.set("radiusKm", filters.radiusKm.toString());
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Could not load requests");
      const json = await res.json();
      return (json.demands ?? []) as DemandCardData[];
    },
    staleTime: 60_000,
  });

  const deck = React.useMemo(
    () => (data ?? []).filter((d) => d.status === "OPEN" && !dismissed.has(d.id)),
    [data, dismissed],
  );

  const top = deck[0] ?? null;

  async function commit(direction: "left" | "right") {
    const id = topCardRef.current;
    void haptic(direction === "right" ? "success" : "heavy");
    setExitDir(direction);
    setDragX(0);

    if (id) {
      if (direction === "right") {
        try {
          await fetch("/api/bookmarks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ demandId: id }),
          });
        } catch (e) {
          console.error("Failed to bookmark demand:", e);
        }
      }

      setDismissed((prev) => {
        const next = new Set(prev).add(id);
        saveDismissed(next);
        return next;
      });
    }

    setTimeout(() => {
      setExitDir(null);
      topCardRef.current = null;
    }, 280);
  }

  function handleDragEnd(_: unknown, info: { offset: { x: number } }) {
    if (Math.abs(info.offset.x) > SWIPE_THRESHOLD) {
      commit(info.offset.x > 0 ? "right" : "left");
    } else {
      setDragX(0);
    }
  }

  function resetDismissed() {
    void haptic("heavy");
    saveDismissed(new Set());
    setDismissed(new Set());
  }

  if (isLoading) {
    return (
      <div className="mx-auto h-[460px] w-full max-w-sm animate-pulse rounded-[30px] bg-[#1C1C1E]" />
    );
  }

  if (!top) {
    return (
      <div className="flex flex-col items-center rounded-[22px] bg-[#1C1C1E] px-8 py-10 text-center">
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#30D158]/15">
          <Check className="h-7 w-7 text-[#30D158]" strokeWidth={2.5} />
        </span>
        <p className="text-[17px] font-semibold tracking-[-0.01em] text-white">You&apos;re All Caught Up</p>
        <p className="mt-1.5 max-w-[260px] text-[13px] leading-snug text-[#EBEBF5]/60">
          No new requests to show. Check back later or review the ones you skipped.
        </p>
        <button
          type="button"
          onClick={resetDismissed}
          className="mt-5 inline-flex h-10 items-center gap-1.5 rounded-full bg-[#767680]/25 px-5 text-[15px] font-semibold text-[#0A84FF] transition-opacity active:opacity-60"
        >
          <RotateCcw className="h-4 w-4" /> Show Skipped
        </button>
      </div>
    );
  }

  const rightOpacity = Math.min(Math.max(dragX / SWIPE_THRESHOLD, 0), 1);
  const leftOpacity = Math.min(Math.max(-dragX / SWIPE_THRESHOLD, 0), 1);
  const budget = formatBudgetRange(top.budgetMin, top.budgetMax);

  return (
    <div className="flex flex-col items-center pt-1">
      {/* ── Card stack ── */}
      <div className="relative h-[460px] w-full max-w-sm">
        <AnimatePresence>
          {/* Next card peeking behind */}
          {deck[1] && (
            <motion.div
              key={deck[1].id}
              className="absolute inset-0 overflow-hidden rounded-[30px] bg-[#2C2C2E] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
              initial={{ scale: 0.9, y: 28, opacity: 0.5 }}
              animate={{ scale: 0.94, y: 16, opacity: 1 }}
              transition={SWIPE_SPRING}
            >
              {deck[1].mediaUrls?.[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={deck[1].mediaUrls[0]} alt="" className="h-full w-full object-cover opacity-40 blur-sm" />
              )}
            </motion.div>
          )}

          {/* Top (draggable) card */}
          <motion.div
            key={top.id}
            drag={exitDir ? false : "x"}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.6}
            onDrag={(_, info) => setDragX(info.offset.x)}
            onDragStart={() => (topCardRef.current = top.id)}
            onDragEnd={handleDragEnd}
            initial={{ scale: 0.96, y: 12, opacity: 1 }}
            animate={
              exitDir
                ? {
                    x: exitDir === "right" ? 360 : -360,
                    rotate: exitDir === "right" ? 18 : -18,
                    opacity: 0,
                  }
                : { scale: 1, y: 0, x: 0, rotate: 0, opacity: 1 }
            }
            transition={SWIPE_SPRING}
            whileTap={{ cursor: "grabbing" }}
            className="absolute inset-0 flex cursor-grab select-none flex-col justify-between overflow-hidden rounded-[30px] bg-gradient-to-br from-[#2C2C2E] via-[#1C1C1E] to-black p-5 text-white shadow-[0_30px_60px_-12px_rgba(0,0,0,0.9)]"
          >
            {top.mediaUrls?.[0] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={top.mediaUrls[0]}
                alt="Request"
                draggable={false}
                className="pointer-events-none absolute inset-0 h-full w-full object-cover"
              />
            )}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/50 to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[70%] bg-gradient-to-t from-black via-black/80 to-transparent" />
            <div className="pointer-events-none absolute inset-0 z-20 rounded-[30px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08),inset_0_1px_0_rgba(255,255,255,0.18)]" />

            {/* Drag tints */}
            <div className="pointer-events-none absolute inset-0 z-10 bg-[#30D158]/25" style={{ opacity: rightOpacity }} />
            <div className="pointer-events-none absolute inset-0 z-10 bg-[#FF453A]/25" style={{ opacity: leftOpacity }} />

            {/* Drag indicators */}
            <div
              className="pointer-events-none absolute left-5 top-16 z-30 rounded-[10px] border-[3px] border-[#30D158] px-3 py-1 text-[22px] font-black uppercase tracking-wide text-[#30D158]"
              style={{ opacity: rightOpacity, transform: `rotate(-14deg) scale(${0.7 + rightOpacity * 0.3})` }}
            >
              Save
            </div>
            <div
              className="pointer-events-none absolute right-5 top-16 z-30 rounded-[10px] border-[3px] border-[#FF453A] px-3 py-1 text-[22px] font-black uppercase tracking-wide text-[#FF453A]"
              style={{ opacity: leftOpacity, transform: `rotate(14deg) scale(${0.7 + leftOpacity * 0.3})` }}
            >
              Skip
            </div>

            <div className="relative z-10 flex items-center justify-between [&>span]:border [&>span]:border-white/15 [&>span]:bg-black/35 [&>span]:text-white [&>span]:backdrop-blur-xl">
              {top.isPriority ? <PriorityBadge /> : <span className="invisible" />}
              <CountdownBadge timelineEnd={top.timelineEnd} />
            </div>

            <div className="relative z-10">
              {top.subCategoryName && (
                <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-white/60">
                  {top.subCategoryName}
                </p>
              )}
              <p className="line-clamp-4 text-[24px] font-bold leading-[1.15] tracking-[-0.025em]">
                {top.summary}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {budget && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#30D158]/20 px-3 py-1.5 text-[13px] font-semibold text-[#30D158] backdrop-blur-xl">
                    <Wallet className="h-3.5 w-3.5" /> {budget}
                  </span>
                )}
                {top.author.location && (
                  <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[13px] font-medium text-white/85 backdrop-blur-xl">
                    <MapPin className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{top.author.location}</span>
                  </span>
                )}
              </div>

              <div className="mt-4 flex items-center gap-3 border-t border-white/10 pt-4">
                {top.author.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={top.author.avatarUrl} alt="" draggable={false} className="h-10 w-10 rounded-full object-cover ring-2 ring-white/20" />
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-sm font-semibold text-white backdrop-blur">
                    {top.author.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 leading-tight">
                  <p className="truncate text-[15px] font-semibold">{top.author.name}</p>
                  <p className="truncate text-[13px] text-white/55">
                    {top.author.companyName ?? "Request author"}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Tap buttons for non-swipers ── */}
      <div className="mt-7 flex items-center gap-8">
        <motion.button
          type="button"
          aria-label="Not interested"
          whileTap={{ scale: 0.85 }}
          onClick={() => {
            topCardRef.current = top.id;
            commit("left");
          }}
          className="flex h-16 w-16 items-center justify-center rounded-full border border-white/[0.12] bg-[#1C1C1E]/80 text-[#FF453A] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_12px_30px_rgba(0,0,0,0.6)] backdrop-blur-2xl"
        >
          <X className="h-7 w-7" strokeWidth={2.75} />
        </motion.button>

        <motion.button
          type="button"
          aria-label="Interested"
          whileTap={{ scale: 0.85 }}
          onClick={() => {
            topCardRef.current = top.id;
            commit("right");
          }}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-[#30D158] text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_12px_30px_rgba(48,209,88,0.35)]"
        >
          <Check className="h-7 w-7" strokeWidth={2.75} />
        </motion.button>
      </div>

      <p className="mt-4 text-[12px] text-[#EBEBF5]/45">
        Swipe right to save · Swipe left to skip
      </p>
    </div>
  );
}
