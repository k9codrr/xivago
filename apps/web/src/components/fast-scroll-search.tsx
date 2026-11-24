"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
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
  const pathname = usePathname();
  const [q, onQChange] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [origin, setOrigin] = useState<OriginBox | null>(null);
  const [vw, setVw] = useState(430);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<number | null>(null);
  const closing = useRef(false);
  const closeTimer = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

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

  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    inputRef.current?.blur(); // drop the keyboard right away
    setDragging(false);
    setDragY(0);
    setExpanded(false); // shrink back into the search pill…
    closeTimer.current = window.setTimeout(() => onCloseRef.current(), DRAWER_ANIM_MS); // …then unmount
  }, []);

  useEffect(
    () => () => {
      if (closeTimer.current != null) window.clearTimeout(closeTimer.current);
    },
    [],
  );

  // Navigating anywhere (tapping a result, switching tabs, browser back) closes the drawer at once.
  const firstPath = useRef(pathname);
  useEffect(() => {
    if (pathname !== firstPath.current) onCloseRef.current();
  }, [pathname]);

  // Grow out of the pill on the next frame (so the transition runs), lock page
  // scroll behind the drawer, and close on Escape
  useEffect(() => {
    if (!origin) return;
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setExpanded(true);
        inputRef.current?.focus({ preventScroll: true });
      }),
    );
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [origin, close]);

  // Springy overshoot while opening, quick settle while closing
  const ease = expanded ? "cubic-bezier(0.34, 1.15, 0.64, 1)" : "cubic-bezier(0.4, 0, 0.2, 1)";
  const morph = `${DRAWER_ANIM_MS}ms ${ease}`;

  if (!origin) return null;
  const drawerWidth = Math.min(vw, 430);
  const iconOnly = origin.width < 120; // round icon button vs. a wide pill

  const onDragStart = (y: number | undefined) => {
    if (y == null) return;
    dragStart.current = y;
    setDragging(true);
  };
  const onDragMove = (y: number | undefined) => {
    if (dragStart.current == null || y == null) return;
    setDragY(Math.min(0, y - dragStart.current));
  };
  const onDragEnd = () => {
    dragStart.current = null;
    setDragging(false);
    if (dragY < -DRAWER_CLOSE_DRAG_PX) close();
    else setDragY(0);
  };

  // Portalled to <body>: the headers that open this use backdrop-filter / z-index
  // stacking, which would otherwise trap these fixed layers inside the header box
  // (the backdrop then doesn't cover the page and taps outside never close it).
  return createPortal(
    <>
      {/* Backdrop: tap anywhere outside to close */}
      <div
        aria-hidden
        onClick={close}
        style={{ transition: `opacity ${DRAWER_ANIM_MS}ms ease` }}
        className={cn(
          "fixed inset-0 z-[9990] bg-black/70 backdrop-blur-md",
          expanded ? "opacity-100" : "pointer-events-none opacity-0",
        )}
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
          height: expanded ? "88dvh" : origin.height,
          borderRadius: expanded ? "0 0 28px 28px" : origin.radius,
          backgroundColor: expanded ? "#0c0c0e" : origin.background,
          transform: `translateY(${dragY}px)`,
          transition: dragging
            ? "none"
            : `top ${morph}, left ${morph}, width ${morph}, height ${morph}, border-radius ${morph}, background-color ${DRAWER_ANIM_MS}ms ease, transform ${morph}`,
        }}
        className="fixed z-[9991] flex flex-col overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,0.7)] ring-1 ring-white/[0.08]"
      >
        {/* ── Search bar ── */}
        <div
          style={{ transition: `padding ${morph}` }}
          className={cn(
            "flex shrink-0 items-center gap-2",
            expanded ? "px-4 pb-2 pt-[max(env(safe-area-inset-top),0.75rem)]" : "p-0",
          )}
        >
          <div
            style={{
              height: expanded ? 46 : origin.height,
              // Collapsed: icon sits exactly where it is in the button
              paddingLeft: expanded ? 14 : iconOnly ? (origin.width - 20) / 2 : 24,
              transition: `height ${morph}, padding ${morph}, background-color ${DRAWER_ANIM_MS}ms ease`,
            }}
            className={cn(
              "flex min-w-0 flex-1 items-center gap-2.5 rounded-[14px] pr-3 text-white",
              expanded ? "bg-white/[0.08] ring-1 ring-white/[0.08] focus-within:ring-[#0A84FF]/60" : "bg-transparent",
            )}
          >
            <Search
              className={cn("shrink-0", expanded || !iconOnly ? "h-[18px] w-[18px] text-white/55" : "h-[20px] w-[20px] text-white")}
              strokeWidth={2}
            />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => onQChange(e.target.value)}
              placeholder="Search people, requests, communities"
              enterKeyHint="search"
              autoComplete="off"
              style={{ transition: `opacity 200ms ease ${expanded ? 120 : 0}ms` }}
              className={cn(
                "min-w-0 flex-1 bg-transparent text-[15px] text-white placeholder:text-white/40 outline-none",
                !expanded && "opacity-0",
              )}
            />
            {q && expanded && (
              <button
                type="button"
                onClick={() => {
                  onQChange("");
                  inputRef.current?.focus();
                }}
                aria-label="Clear search"
                className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/25 text-black"
              >
                <X className="h-3 w-3" strokeWidth={3} />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={close}
            style={{ transition: `opacity ${DRAWER_ANIM_MS}ms ease, max-width ${morph}` }}
            className={cn(
              "shrink-0 overflow-hidden whitespace-nowrap px-1 text-[15px] font-medium text-[#0A84FF]",
              expanded ? "max-w-[90px] opacity-100" : "pointer-events-none max-w-0 opacity-0",
            )}
          >
            Cancel
          </button>
        </div>

        {/* Results fade/slide in once the drawer has room */}
        <div
          style={{ transition: `opacity 220ms ease ${expanded ? 160 : 0}ms, transform ${morph}` }}
          className={cn(
            "no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain",
            expanded ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0",
          )}
        >
          <SearchResults q={q} onNavigate={close} />
        </div>

        {/* Grab handle: drag up (or tap) to close */}
        <button
          type="button"
          aria-label="Close search"
          onClick={close}
          onTouchStart={(e) => onDragStart(e.touches[0]?.clientY)}
          onTouchMove={(e) => onDragMove(e.touches[0]?.clientY)}
          onTouchEnd={onDragEnd}
          onTouchCancel={onDragEnd}
          className={cn(
            "flex shrink-0 touch-none justify-center border-t border-white/[0.06] pb-3 pt-2.5 transition-opacity",
            expanded ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          <span className="h-[5px] w-10 rounded-full bg-white/25" />
        </button>
      </div>
    </>,
    document.body,
  );
}

/**
 * The search drawer plus how to open it: double fast pull-down from the top of
 * the page, or `open()` (e.g. from a search button tap).
 *
 * `anchorRef` should point at an element of the page that owns the drawer. The
 * keep-alive tab shell keeps several pages mounted (hidden) at once; only the
 * one that is actually visible reacts to the pull gesture, so a pull never opens
 * invisible drawers in background tabs that would then stay open.
 */
export function useSearchDrawer(anchorRef?: RefObject<HTMLElement | null>) {
  const [open, setOpen] = useState(false);
  useDoubleFastPull(() => {
    const anchor = anchorRef?.current;
    if (anchor && anchor.getClientRects().length === 0) return; // this page is hidden
    void haptic("medium");
    setOpen(true);
  }, !open);
  const handleClose = useCallback(() => setOpen(false), []);
  const drawer = open ? <FastScrollSearchDrawer onClose={handleClose} /> : null;
  return { open: () => setOpen(true), close: handleClose, isOpen: open, drawer };
}
