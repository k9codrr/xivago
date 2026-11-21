"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { haptic } from "@/lib/haptics";
import { doubleFastPullActive, isFastPull } from "@/components/fast-scroll-search";

/** Pull (after resistance) needed to trigger a refresh. */
const TRIGGER_PX = 72;
/** Where the content rests while the refresh runs. */
const HOLD_PX = 64;
/** Rubber-band ceiling: the pull approaches this but never reaches it. */
const MAX_PX = 140;
/** Finger travel before we decide the gesture is a vertical pull. */
const LOCK_PX = 8;
/** Keep the logo spinning at least this long so the refresh reads as one beat. */
const MIN_SPIN_MS = 750;
/** Snap-back animation length. */
const SETTLE_MS = 380;
const LOGO_PX = 34;
/** With a header logo, how far the logo slides per px of finger pull. */
const ANCHOR_FOLLOW = 0.85;

/** Routes where a pull-down means something else (chat history, auth flows, etc.). */
function isDisabledRoute(pathname: string) {
  return (
    (pathname.startsWith("/chats/") && pathname !== "/chats") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/checkout")
  );
}

/** True when the touch started inside something that is itself scrolled down. */
function insideScrolledContainer(target: EventTarget | null) {
  let el = target instanceof Element ? target : null;
  while (el && el !== document.body && el !== document.documentElement) {
    if (el.scrollTop > 0) {
      const oy = getComputedStyle(el).overflowY;
      if (oy === "auto" || oy === "scroll") return true;
    }
    el = el.parentElement;
  }
  return false;
}

/** Soft rubber-band: linear at first, then flattening out towards MAX_PX. */
function resist(dy: number) {
  return MAX_PX * (1 - Math.exp(-dy / 200));
}

/**
 * Threads-style pull-to-refresh for the whole app. Pulling down from the top
 * draws the Xivago logo in (a sweep that fills as you pull), ticks a haptic
 * when you pass the trigger point, then spins the logo while it refetches
 * every active query and re-runs server components — no full page reload.
 *
 * On pages with a header logo (`data-ptr-anchor`, i.e. home and explore) the
 * page stays put and the header logo itself slides down out of the header and
 * becomes the refresh logo, then slides back into place.
 *
 * A fast flick is left to the search drawer (two fast pulls open search), so
 * only a slower, deliberate pull refreshes there.
 *
 * Opt a subtree out with `data-no-pull-refresh`.
 */
export function LogoPullToRefresh({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const queryClient = useQueryClient();

  const contentRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const spinnerRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLImageElement>(null);

  const disabled = isDisabledRoute(pathname);

  // Keep the latest refresh deps without re-binding listeners each render
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  refreshRef.current = async () => {
    router.refresh();
    await Promise.all([
      queryClient.refetchQueries({ type: "active" }).catch(() => {}),
      new Promise((r) => setTimeout(r, MIN_SPIN_MS)),
    ]);
  };

  useEffect(() => {
    if (disabled) return;

    const content = contentRef.current;
    const indicator = indicatorRef.current;
    const spinner = spinnerRef.current;
    const logo = logoRef.current;
    if (!content || !indicator || !spinner || !logo) return;

    let start: { x: number; y: number; t: number } | null = null;
    let pulling = false; // vertical pull locked in
    let fast = false; // this gesture is a fast flick, which belongs to search
    // Header logo the pull grows out of (home/explore), and its resting centre
    let anchor: HTMLElement | null = null;
    let anchorCenter = { x: 0, y: 0 };
    let armed = false; // past the trigger point
    let refreshing = false;
    let distance = 0;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;

    const render = (d: number, animate: boolean) => {
      distance = d;
      const ease = `${SETTLE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`;
      indicator.style.transition = animate ? `transform ${ease}, opacity ${ease}` : "none";
      indicator.style.opacity = d > 0 ? "1" : "0";
      if (anchor) {
        // The header logo hands over to the slide-down logo, which drops out of its spot
        anchor.style.transition = animate ? `opacity ${ease}` : "none";
        anchor.style.opacity = d > 0 ? String(Math.max(0, 1 - d / 20)) : "";
        indicator.style.transform = `translate3d(-50%, ${d * ANCHOR_FOLLOW}px, 0)`;
      } else {
        content.style.transition = animate ? `transform ${ease}` : "none";
        // Only hold a transform while pulled — a transformed ancestor would
        // re-anchor position:fixed children (modals, FABs) to the content.
        content.style.transform = d > 0 ? `translate3d(0, ${d}px, 0)` : "";
        indicator.style.transform = `translate3d(-50%, ${Math.max(0, (d - LOGO_PX) / 2)}px, 0)`;
      }

      if (!refreshing) {
        const p = Math.min(1, d / TRIGGER_PX);
        // The logo "draws" itself: a sweep reveal that completes at the trigger point
        const mask = p >= 1 ? "none" : `conic-gradient(from 225deg, #000 ${p * 360}deg, transparent ${p * 360}deg)`;
        logo.style.maskImage = mask;
        logo.style.webkitMaskImage = mask;
        logo.style.transform = `rotate(${(p - 1) * 90}deg) scale(${0.55 + 0.45 * p})`;
        logo.style.opacity = String(Math.min(1, 0.25 + p));
      }
    };

    const reset = () => {
      spinner.classList.remove("ptr-spin", "ptr-pop");
      logo.style.maskImage = "";
      logo.style.webkitMaskImage = "";
      render(0, true);
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        if (distance !== 0) return;
        content.style.transition = "";
        releaseAnchor();
      }, SETTLE_MS);
    };

    /** Put the indicator back at the top of the screen and give the header its logo back. */
    const releaseAnchor = () => {
      if (anchor) {
        anchor.style.opacity = "";
        anchor.style.transition = "";
      }
      anchor = null;
      indicator.style.left = "";
      indicator.style.top = "env(safe-area-inset-top, 0px)";
    };

    /** Start the logo from the on-screen header logo, if this page has one. */
    const attachAnchor = () => {
      releaseAnchor();
      const el = document.querySelector<HTMLElement>("[data-ptr-anchor]");
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || r.bottom <= 0 || r.top >= window.innerHeight) return;
      anchor = el;
      anchorCenter = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      indicator.style.left = `${anchorCenter.x}px`;
      indicator.style.top = `${anchorCenter.y - LOGO_PX / 2}px`;
    };

    const blocked = (e: TouchEvent) => {
      const t = e.target;
      if (t instanceof Element && t.closest("[data-vaul-drawer],[data-app-sheet],[role='dialog'],[data-no-pull-refresh]")) return true;
      if (document.body.style.overflow === "hidden") return true; // a modal has locked the page
      return insideScrolledContainer(t);
    };

    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (refreshing || e.touches.length !== 1 || !touch || window.scrollY > 0 || blocked(e)) {
        start = null;
        return;
      }
      start = { x: touch.clientX, y: touch.clientY, t: performance.now() };
      pulling = false;
      armed = false;
      fast = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!start || !touch || refreshing) return;
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;

      if (!pulling) {
        if (Math.abs(dx) < LOCK_PX && Math.abs(dy) < LOCK_PX) return;
        // Scrolling up, or a sideways swipe — not ours
        if (dy <= 0 || Math.abs(dx) > dy || window.scrollY > 0) {
          start = null;
          return;
        }
        pulling = true;
        clearTimeout(settleTimer);
        attachAnchor();
        spinner.classList.remove("ptr-spin", "ptr-pop");
      }

      // A fast flick is the search gesture: let it pull, but never arm a refresh
      if (!fast && doubleFastPullActive() && isFastPull(dy, performance.now() - start.t)) {
        fast = true;
        if (armed) armed = false;
      }

      if (e.cancelable) e.preventDefault(); // no native scroll / browser reload
      const d = resist(Math.max(0, dy - LOCK_PX));
      render(d, false);

      if (!armed && !fast && d >= TRIGGER_PX) {
        armed = true;
        void haptic("heavy");
        spinner.classList.remove("ptr-pop");
        void spinner.offsetWidth; // restart the pop animation
        spinner.classList.add("ptr-pop");
      } else if (armed && d < TRIGGER_PX) {
        armed = false; // pulled back up: releasing now cancels
        void haptic("selection");
      }
    };

    const onTouchEnd = async () => {
      if (!start) return;
      start = null;
      if (!pulling) return;
      pulling = false;

      if (!armed) {
        reset();
        return;
      }
      armed = false;
      refreshing = true;
      logo.style.maskImage = "";
      logo.style.webkitMaskImage = "";
      logo.style.transform = "";
      logo.style.opacity = "1";
      render(HOLD_PX, true);
      spinner.classList.remove("ptr-pop");
      spinner.classList.add("ptr-spin");

      try {
        await refreshRef.current();
        void haptic("success");
      } catch {
        void haptic("error");
      } finally {
        refreshing = false;
        reset();
      }
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
      clearTimeout(settleTimer);
      content.style.transform = "";
      content.style.transition = "";
      releaseAnchor();
    };
  }, [disabled]);

  return (
    <>
      <div
        ref={indicatorRef}
        aria-hidden
        className="pointer-events-none fixed left-1/2 z-[55] opacity-0"
        style={{ top: "env(safe-area-inset-top, 0px)", transform: "translate3d(-50%, 0, 0)" }}
      >
        <div ref={spinnerRef} style={{ width: LOGO_PX, height: LOGO_PX }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={logoRef}
            src="/logo/xivago-transparent-favicon.png"
            alt=""
            width={LOGO_PX}
            height={LOGO_PX}
            draggable={false}
            className="h-full w-full select-none object-contain"
          />
        </div>
      </div>
      <div ref={contentRef}>{children}</div>
    </>
  );
}
