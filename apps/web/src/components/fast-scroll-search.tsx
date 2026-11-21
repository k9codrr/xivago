"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { SearchResults } from "@/components/search-results";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";

/** Average pull speed (px/ms) from touch start that counts as a fast pull-down. */
const FAST_PULL_SPEED = 0.7;
/** Minimum finger travel (px) before a pull-down can count, so taps and jitters are ignored. */
const MIN_PULL_PX = 40;
/** Upward wheel delta at the top of the page that counts as a pull on desktop/trackpad. */
const WHEEL_PULL_DELTA = 60;

/** Ignore further pulls for this long after one fires, so one gesture never counts twice. */
const PULL_COOLDOWN_MS = 350;
/** The second fast pull must land within this long of the first to count as a double pull. */
const DOUBLE_PULL_WINDOW_MS = 900;

/** True when a pull of `pulled` px over `dt` ms is a fast flick (search gesture), not a slow refresh pull. */
export function isFastPull(pulled: number, dt: number) {
  return pulled >= MIN_PULL_PX && dt > 0 && pulled / dt > FAST_PULL_SPEED;
}

/** How many mounted double-fast-pull listeners there are (pages with the search drawer). */
let activeDoubleFastPull = 0;
/** Whether fast pulls on this page belong to search, so pull-to-refresh should leave them alone. */
export function doubleFastPullActive() {
  return activeDoubleFastPull > 0;
}

/**
 * Calls `onDoublePull` when the user quickly pulls down from the top of the page
 * twice in a row (the pull-to-refresh gesture, done fast, twice). A single fast
 * pull does nothing, but is still kept from triggering the browser's own
 * pull-to-refresh (which would reload the page).
 */
export function useDoubleFastPull(onDoublePull: () => void, enabled = true) {
  const start = useRef<{ y: number; t: number } | null>(null);
  const lastFired = useRef(-Infinity);
  const callback = useRef(onDoublePull);
  callback.current = onDoublePull;

  useEffect(() => {
    if (!enabled) return;
    const atTop = () => window.scrollY <= 0;
    // Gestures inside an open drawer belong to that drawer, not the page.
    const inDrawer = (e: Event) => e.target instanceof Element && !!e.target.closest("[data-vaul-drawer],[data-app-sheet]");
    const fire = () => {
      const now = performance.now();
      const sinceLast = now - lastFired.current;
      if (sinceLast < PULL_COOLDOWN_MS) return; // same gesture still going
      if (sinceLast <= DOUBLE_PULL_WINDOW_MS) {
        lastFired.current = -Infinity; // a third pull starts a fresh count
        callback.current();
      } else {
        lastFired.current = now; // first pull: wait for the second
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      start.current = !inDrawer(e) && atTop() && touch && e.touches.length === 1 ? { y: touch.clientY, t: performance.now() } : null;
    };
    const onTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!start.current || !touch) return;
      const pulled = touch.clientY - start.current.y;
      if (pulled < 0) {
        start.current = null; // scrolling the page up, not a pull
        return;
      }
      const dt = performance.now() - start.current.t;
      if (isFastPull(pulled, dt)) {
        // Keep the browser's own pull-to-refresh from reloading the page
        if (e.cancelable) e.preventDefault();
        start.current = null;
        fire();
      }
    };
    const onTouchEnd = () => {
      start.current = null;
    };
    const onWheel = (e: WheelEvent) => {
      if (!inDrawer(e) && atTop() && e.deltaY < -WHEEL_PULL_DELTA) fire();
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: true });
    activeDoubleFastPull++;
    return () => {
      activeDoubleFastPull--;
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
      window.removeEventListener("wheel", onWheel);
    };
  }, [enabled]);
}

/** How long the search pill takes to grow into the drawer (and shrink back), in ms. */
const DRAWER_ANIM_MS = 420;
/** Upward drag (px) on the drawer handle that closes it. */
const DRAWER_CLOSE_DRAG_PX = 60;

/** Where the drawer grows from (and shrinks back into), in viewport px. */
interface OriginBox {
  top: number;
  left: number;
  width: number;
  height: number;
  radius: number;
  background: string;
  el: HTMLElement | null;
}

/**
 * Finds the page's search button to grow the drawer out of: the header search
 * button first (it's on every page), then any other tagged search button, as long
 * as it's on screen. Falls back to the pinned-bar spot at the top.
 */
function findSearchOrigin(): OriginBox {
  const vw = window.innerWidth;
  const candidates = [
    ...document.querySelectorAll<HTMLElement>('[data-search-origin="header"]'),
    ...document.querySelectorAll<HTMLElement>('[data-search-origin]:not([data-search-origin="header"])'),
  ];
  for (const el of candidates) {
    const r = el.getBoundingClientRect();
    const onScreen = r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
    if (!onScreen || getComputedStyle(el).visibility === "hidden") continue;
    const cs = getComputedStyle(el);
    const bg = cs.backgroundColor;
    return {
      top: r.top,
      left: r.left,
      width: r.width,
      height: r.height,
      radius: Math.min(r.width, r.height) / 2,
      background: bg && bg !== "rgba(0, 0, 0, 0)" ? bg : "rgba(92, 102, 80, 0.9)",
      el,
    };
  }
  const width = Math.min(vw, 430) - 32;
  return { top: 8, left: (vw - width) / 2, width, height: 52, radius: 26, background: "rgba(92, 102, 80, 0.9)", el: null };
}

/** Search drawer that grows out of the page's search button, with the same search input and results. */
export function FastScrollSearchDrawer({ onClose }: { onClose: () => void }) {
  const [q, onQChange] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [origin, setOrigin] = useState<OriginBox | null>(null);
  const [vw, setVw] = useState(430);
  const closing = useRef(false);

  // Measure the search button before the first paint so the drawer starts exactly on top of it
  useLayoutEffect(() => {
    const o = findSearchOrigin();
    setOrigin(o);
    setVw(window.innerWidth);
    // The drawer stands in for the button while open, so hide the real one
    const prevVisibility = o.el?.style.visibility ?? "";
    if (o.el) o.el.style.visibility = "hidden";
    return () => {
      if (o.el) o.el.style.visibility = prevVisibility;
    };
  }, []);
  const [dragY, setDragY] = useState(0);
  const dragStart = useRef<number | null>(null);

  const close = () => {
    if (closing.current) return;
    closing.current = true;
    setDragY(0);
    setExpanded(false); // shrink back into the search pill…
    setTimeout(onClose, DRAWER_ANIM_MS); // …then unmount
  };

  // Grow out of the pill on the next frame (so the transition runs), lock page
  // scroll behind the drawer, and close on Escape
  useEffect(() => {
    if (!origin) return;
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setExpanded(true)));
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin]);

  // Springy overshoot while opening, quick settle while closing
  const ease = expanded ? "cubic-bezier(0.34, 1.25, 0.64, 1)" : "cubic-bezier(0.4, 0, 0.2, 1)";
  const morph = `${DRAWER_ANIM_MS}ms ${ease}`;

  if (!origin) return null;
  const drawerWidth = Math.min(vw, 430);
  const iconOnly = origin.width < 120; // round icon button vs. a wide pill

  return (
    <>
      {/* Backdrop: tap to close */}
      <div
        onClick={close}
        style={{ transition: `opacity ${DRAWER_ANIM_MS}ms ease` }}
        className={cn("fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm", expanded ? "opacity-100" : "opacity-0")}
      />

      {/* The search pill itself grows into the drawer (and shrinks back on close) */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        style={{
          top: expanded ? 0 : origin.top,
          left: expanded ? (vw - drawerWidth) / 2 : origin.left,
          width: expanded ? drawerWidth : origin.width,
          height: expanded ? "85dvh" : origin.height,
          borderRadius: expanded ? "0 0 28px 28px" : origin.radius,
          backgroundColor: expanded ? "#0a0a0a" : origin.background,
          transform: `translateY(${dragY}px)`,
          transition: dragStart.current != null
            ? "none"
            : `top ${morph}, left ${morph}, width ${morph}, height ${morph}, border-radius ${morph}, background-color ${DRAWER_ANIM_MS}ms ease, transform ${morph}`,
        }}
        className="fixed z-[61] flex flex-col overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.6)] ring-1 ring-white/10"
      >
        <div
          style={{ transition: `padding ${morph}` }}
          className={cn(
            "flex shrink-0 items-center gap-3",
            expanded ? "px-4 pb-3 pt-[max(env(safe-area-inset-top),0.75rem)]" : "p-0",
          )}
        >
          <div
            style={{
              height: expanded ? 48 : origin.height,
              // Collapsed: icon sits exactly where it is in the button
              paddingLeft: expanded ? 20 : iconOnly ? (origin.width - 20) / 2 : 24,
              transition: `height ${morph}, padding ${morph}, background-color ${DRAWER_ANIM_MS}ms ease`,
            }}
            className={cn(
              "flex min-w-0 flex-1 items-center gap-3 rounded-full pr-5 text-white",
              expanded ? "bg-[#5c6650]/90" : "bg-transparent",
            )}
          >
            <Search
              style={{ transition: `transform ${morph}, width ${morph}, height ${morph}` }}
              className={cn(
                "shrink-0",
                expanded ? "h-[17px] w-[17px] text-white/80" : iconOnly ? "h-[20px] w-[20px] text-white" : "h-[17px] w-[17px] text-white/80",
              )}
              strokeWidth={2}
            />
            <input
              autoFocus
              value={q}
              onChange={(e) => onQChange(e.target.value)}
              placeholder="Search people, requests, communities…"
              style={{ transition: `opacity 200ms ease ${expanded ? 120 : 0}ms` }}
              className={cn(
                "min-w-0 flex-1 bg-transparent text-[13px] tracking-[0.02em] text-white placeholder:text-white/60 outline-none",
                !expanded && iconOnly && "opacity-0",
              )}
            />
            {q && (
              <button type="button" onClick={() => onQChange("")} aria-label="Clear search" className="shrink-0 text-white/80">
                <X className="h-[15px] w-[15px]" strokeWidth={2} />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={close}
            style={{ transition: `opacity ${DRAWER_ANIM_MS}ms ease, max-width ${morph}` }}
            className={cn(
              "shrink-0 overflow-hidden whitespace-nowrap text-[13px] font-medium text-white/80",
              expanded ? "max-w-[80px] opacity-100" : "max-w-0 opacity-0",
            )}
          >
            Cancel
          </button>
        </div>

        {/* Results fade/slide in once the drawer has room */}
        <div
          style={{ transition: `opacity 220ms ease ${expanded ? 160 : 0}ms, transform ${morph}` }}
          className={cn(
            "min-h-0 flex-1 overflow-y-auto overscroll-contain",
            expanded ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0",
          )}
        >
          <SearchResults q={q} />
        </div>

        {/* Grab handle: drag up to close */}
        <div
          onTouchStart={(e) => (dragStart.current = e.touches[0]?.clientY ?? null)}
          onTouchMove={(e) => {
            const y = e.touches[0]?.clientY;
            if (dragStart.current == null || y == null) return;
            setDragY(Math.min(0, y - dragStart.current));
          }}
          onTouchEnd={() => {
            dragStart.current = null;
            if (dragY < -DRAWER_CLOSE_DRAG_PX) close();
            else setDragY(0);
          }}
          className={cn("flex shrink-0 touch-none justify-center py-3 transition-opacity", expanded ? "opacity-100" : "opacity-0")}
        >
          <span className="h-[5px] w-10 rounded-full bg-white/25" />
        </div>
      </div>
    </>
  );
}

/**
 * The search drawer plus how to open it: double fast pull-down from the top of
 * the page, or `open()` (e.g. from a search button tap).
 */
export function useSearchDrawer() {
  const [open, setOpen] = useState(false);
  useDoubleFastPull(() => {
    void haptic("medium");
    setOpen(true);
  }, !open);
  const drawer = open ? <FastScrollSearchDrawer onClose={() => setOpen(false)} /> : null;
  return { open: () => setOpen(true), drawer };
}
