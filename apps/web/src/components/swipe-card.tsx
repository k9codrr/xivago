"use client";

import { useEffect, useRef, useState } from "react";
import { Clock, MapPin } from "lucide-react";
import type { DemandCardData } from "@/components/demand-card";
import { CountdownBadge } from "@/components/countdown-badge";
import { formatBudgetRange } from "@/lib/money";
import { cn } from "@/lib/utils";

const SWIPE_THRESHOLD = 110; // px
const EXIT_MS = 220;

interface SwipeCardProps {
  demand: DemandCardData;
  isTop: boolean;
  stackIndex: number;          // 0 = top of deck
  exitDirection: "left" | "right" | null;
  onSwipe: (dir: "left" | "right") => void;
  onExited: () => void;
}

export function SwipeCard({ demand, isTop, stackIndex, exitDirection, onSwipe, onExited }: SwipeCardProps) {
  const innerRef = useRef<HTMLDivElement>(null);
  const start = useRef({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [stamp, setStamp] = useState<"left" | "right" | null>(null);
  const budgetLabel = formatBudgetRange(demand.budgetMin, demand.budgetMax);

  const setTransform = (x: number, y: number, rot: number, animate: boolean) => {
    const el = innerRef.current;
    if (!el) return;
    el.style.transition = animate ? "transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)" : "none";
    el.style.transform = `translate(${x}px, ${y}px) rotate(${rot}deg)`;
  };

  // programmatic exit (buttons / keyboard) — deck drives this via exitDirection
  useEffect(() => {
    if (!isTop || !exitDirection) return;
    const el = innerRef.current;
    if (!el) return;
    const offX = exitDirection === "right" ? window.innerWidth : -window.innerWidth;
    setTransform(offX, 0, exitDirection === "right" ? 24 : -24, true);
    const t = setTimeout(onExited, EXIT_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exitDirection, isTop, onExited]);

  const handleDown = (e: React.PointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY };
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const dragDx = useRef(0);

const handleMove = (e: React.PointerEvent) => {
  if (!dragging) return;
  const dx = e.clientX - start.current.x;
  const dy = e.clientY - start.current.y;
  dragDx.current = dx;
  setTransform(dx, dy * 0.35, dx * 0.06, false);
  setStamp(dx > 40 ? "right" : dx < -40 ? "left" : null);
};

const handleUp = () => {
  if (!dragging) return;
  setDragging(false);
  const dx = dragDx.current;
  dragDx.current = 0;
  if (Math.abs(dx) > SWIPE_THRESHOLD) {
    setStamp(null);
    onSwipe(dx > 0 ? "right" : "left");   // deck animates exit + advances
  } else {
    setTransform(0, 0, 0, true);          // spring back
    setStamp(null);
  }
};

  return (
    <div
      className="absolute inset-x-0 top-0 transition-[transform] duration-300 ease-out"
      style={{
        zIndex: 20 - stackIndex,
        transform: `translateY(${stackIndex * 14}px) scale(${1 - stackIndex * 0.05})`,
      }}
    >
      <div
        ref={innerRef}
        onPointerDown={isTop ? handleDown : undefined}
        onPointerMove={isTop ? handleMove : undefined}
        onPointerUp={isTop ? handleUp : undefined}
        onPointerCancel={isTop ? handleUp : undefined}
        className={cn(
          "card-shell relative p-5",
          isTop && "cursor-grab touch-none select-none active:cursor-grabbing",
        )}
        style={{ transform: "translate(0px, 0px) rotate(0deg)" }}
      >
        {/* stamps */}
        <div className={cn(
          "pointer-events-none absolute left-5 top-5 -rotate-12 rounded-lg border-2 border-teal-500 px-3 py-1 text-sm font-bold tracking-widest text-teal-500 transition-opacity",
          stamp === "right" ? "opacity-100" : "opacity-0",
        )}>
          INTERESTED
        </div>
        <div className={cn(
          "pointer-events-none absolute right-5 top-5 rotate-12 rounded-lg border-2 border-rose-500 px-3 py-1 text-sm font-bold tracking-widest text-rose-500 transition-opacity",
          stamp === "left" ? "opacity-100" : "opacity-0",
        )}>
          SKIP
        </div>

        <p className="mb-3 line-clamp-4 text-base font-medium text-neutral-900 dark:text-neutral-100">
          {demand.summary}
        </p>

        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-400">
          {budgetLabel && <span className="font-semibold text-neutral-200">{budgetLabel}</span>}
          {demand.author.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" aria-hidden /> {demand.author.location}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-neutral-200 pt-3 dark:border-neutral-800">
          <CountdownBadge timelineEnd={demand.timelineEnd} />
          <span className="flex items-center gap-1 text-[11px] text-neutral-500">
            <Clock className="h-3 w-3" aria-hidden /> swipe → details
          </span>
        </div>
      </div>
    </div>
  );
}