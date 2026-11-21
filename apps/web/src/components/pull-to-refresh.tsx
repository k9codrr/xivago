"use client";

import { useRef, useState, type ReactNode } from "react";
import { Loader2, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";

const TRIGGER_DISTANCE_PX = 50;
const MAX_PULL_PX = 110;

interface PullToRefreshProps {
  onRefresh: () => Promise<unknown>;
  children: ReactNode;
}

/**
 * Minimal touch-driven pull-to-refresh. Only activates when the scroll
 * container is already at the top (so it doesn't fight normal scrolling),
 * and only responds to a downward drag.
 */
export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  function onTouchStart(e: React.TouchEvent) {
    if (refreshing) return;
    const el = containerRef.current;
    if (!el || el.scrollTop > 0) return;
    startY.current = e.touches[0]?.clientY ?? null;
  }

  function onTouchMove(e: React.TouchEvent) {
    if (startY.current == null || refreshing) return;
    const currentY = e.touches[0]?.clientY ?? startY.current;
    const delta = currentY - startY.current;
    if (delta > 0) {
      const next = Math.min(delta * 0.7, MAX_PULL_PX);
      // Tick once when the pull crosses the "release to refresh" line
      if (next >= TRIGGER_DISTANCE_PX && pullDistance < TRIGGER_DISTANCE_PX) void haptic("heavy");
      setPullDistance(next);
    }
  }

  async function onTouchEnd() {
    if (startY.current == null) return;
    startY.current = null;

    if (pullDistance >= TRIGGER_DISTANCE_PX && !refreshing) {
      setRefreshing(true);
      setPullDistance(TRIGGER_DISTANCE_PX);
      try {
        await onRefresh();
        void haptic("success");
      } finally {
        setRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }

  const showIndicator = pullDistance > 0 || refreshing;
  const triggered = pullDistance >= TRIGGER_DISTANCE_PX;

  return (
    <div
      ref={containerRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className="relative"
    >
      {showIndicator && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 flex justify-center overflow-hidden transition-[height]"
          style={{ height: pullDistance }}
        >
          <span className="flex items-center pt-2 text-neutral-400">
            {refreshing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <ArrowDown
                className={cn("h-5 w-5 transition-transform", triggered && "rotate-180 text-brand-600")}
              />
            )}
          </span>
        </div>
      )}
      <div
        style={{ transform: `translateY(${pullDistance}px)` }}
        className={refreshing ? "transition-transform" : pullDistance === 0 ? "transition-transform" : undefined}
      >
        {children}
      </div>
    </div>
  );
}
