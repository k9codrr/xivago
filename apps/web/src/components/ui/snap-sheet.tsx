"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { animate, motion, useMotionValue } from "motion/react";
import { cn } from "@/lib/utils";
import { LIQUID_GLASS_SHEET, useKeyboardFit } from "@/components/ui/family-drawer";
import type { SheetStyle } from "@/lib/sheet-style";

/**
 * Bottom sheet that opens half way (like Spotify or Apple Maps) and expands to
 * full height with a swipe up. It floats with the same gap on the left, right
 * and bottom in both states, because its height changes rather than sliding
 * part of it off screen.
 *
 * - Half: content doesn't scroll; any vertical swipe on the sheet moves it.
 * - Full: content scrolls; swiping down from the top of the content (or on the
 *   header/footer) collapses it back to half, then closes it.
 * - Tapping outside or pressing Escape closes it.
 *
 * Wrap the scrollable part of the content in `SheetScrollArea`.
 */

type Snap = "half" | "full";

/** Gap to the screen's left, right and bottom edges, in px. */
const GAP = 16;
const HALF_RATIO = 0.52;
const FULL_RATIO = 0.92;
/** Movement (px) before a touch counts as a swipe rather than a tap. */
const SLOP = 4;
const SPRING = { type: "spring", stiffness: 420, damping: 42, mass: 0.9 } as const;
const EXIT = { duration: 0.28, ease: [0.32, 0.72, 0, 1] } as const;

const SheetContext = createContext<{ snap: Snap; setSnap: (s: Snap) => void }>({
  snap: "full",
  setSnap: () => {},
});

export const useSnapSheet = () => useContext(SheetContext);

/** The part of the sheet that scrolls once it's expanded. */
export function SheetScrollArea({ className, children }: { className?: string; children: ReactNode }) {
  const { snap } = useSnapSheet();
  return (
    <div
      data-sheet-scroll=""
      className={cn(
        "min-h-0 flex-1 overscroll-contain",
        snap === "full" ? "overflow-y-auto" : "overflow-hidden",
        className,
      )}
    >
      {children}
    </div>
  );
}

const THEMES: Record<SheetStyle, { sheet: string; style?: CSSProperties; backdrop: string; handle: string }> = {
  default: {
    sheet: LIQUID_GLASS_SHEET,
    backdrop: "bg-black/30",
    handle: "bg-white/30",
  },
  spotify: {
    sheet: "rounded-[18px] border border-white/[0.06] shadow-[0_-10px_60px_rgba(0,0,0,0.75)]",
    style: { background: "linear-gradient(180deg, #2b2b2b 0px, #1f1f1f 160px, #181818 100%)" },
    backdrop: "bg-black/60",
    handle: "bg-[#b3b3b3]/60",
  },
  glass: {
    sheet: "rounded-[36px]",
    style: {
      // Same CSS on iOS and Android: WebKit can't run SVG refraction in a backdrop
      // filter, so the glass look comes from blur, saturation, tint and lighting only.
      background:
        "linear-gradient(180deg, rgb(255 255 255 / 0.15) 0%, rgb(255 255 255 / 0.06) 45%, rgb(255 255 255 / 0.04) 100%), rgb(20 20 24 / 0.42)",
      backdropFilter: "blur(38px) saturate(190%) brightness(1.04)",
      WebkitBackdropFilter: "blur(38px) saturate(190%) brightness(1.04)",
      boxShadow:
        "inset 0 1px 0.5px rgb(255 255 255 / 0.45), inset 0 -1px 0.5px rgb(255 255 255 / 0.10), inset 0 0 24px rgb(255 255 255 / 0.05), 0 30px 80px rgb(0 0 0 / 0.45), 0 0 0 0.5px rgb(255 255 255 / 0.18)",
    },
    backdrop: "bg-black/25",
    handle: "bg-white/45",
  },
};

/** Lit rim and soft top sheen for the glass theme. */
function GlassLighting() {
  return (
    <>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit]"
        style={{
          background:
            "radial-gradient(140% 60% at 20% 0%, rgb(255 255 255 / 0.20), transparent 50%), radial-gradient(90% 40% at 100% 100%, rgb(255 255 255 / 0.06), transparent 60%)",
        }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit]"
        style={{
          padding: 1,
          background:
            "linear-gradient(160deg, rgb(255 255 255 / 0.65), rgb(255 255 255 / 0.12) 30%, rgb(255 255 255 / 0.04) 60%, rgb(255 255 255 / 0.30))",
          WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          mask: "linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0)",
        }}
      />
    </>
  );
}

/** Another (vaul) drawer opened on top of this sheet owns taps and Escape. */
const drawerOnTop = () => !!document.querySelector("[data-vaul-drawer]");

interface Gesture {
  startX: number;
  startY: number;
  originY: number;
  startExtent: number;
  startSnap: Snap;
  scroller: HTMLElement | null;
  mode: "pending" | "drag" | "native";
  lastY: number;
  lastT: number;
  velocity: number; // px per ms, positive = downwards
}

export function SnapSheet({
  open,
  onClose,
  label,
  theme = "default",
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** Accessible name of the dialog. */
  label: string;
  theme?: SheetStyle;
  className?: string;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(open);
  const [snap, setSnapState] = useState<Snap>("half");
  const height = useMotionValue(0);
  const y = useMotionValue(0);
  const sheetRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const justDragged = useRef(false);
  const openRef = useRef(open);
  const snapRef = useRef(snap);
  const onCloseRef = useRef(onClose);
  openRef.current = open;
  snapRef.current = snap;
  onCloseRef.current = onClose;

  const fit = useKeyboardFit(open && visible);
  const fitRef = useRef(fit);
  fitRef.current = fit;

  useEffect(() => setMounted(true), []);

  const sizes = useCallback(() => {
    const k = fitRef.current;
    if (k) return { half: k.height, full: k.height };
    const vh = window.innerHeight;
    return { half: Math.round(vh * HALF_RATIO), full: Math.round(Math.min(vh * FULL_RATIO, vh - GAP - 32)) };
  }, []);

  const settle = useCallback(
    (target: Snap | "close") => {
      if (target === "close") {
        onCloseRef.current();
        return;
      }
      setSnapState(target);
      animate(height, sizes()[target], SPRING);
      animate(y, 0, SPRING);
    },
    [height, y, sizes],
  );
  const setSnap = useCallback((s: Snap) => settle(s), [settle]);

  // Mount / unmount with a slide.
  useEffect(() => {
    if (open) {
      setVisible(true);
      return;
    }
    if (!visible) return;
    const controls = animate(y, window.innerHeight, EXIT);
    controls.then(() => {
      if (!openRef.current) setVisible(false);
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !visible) return;
    setSnapState("half");
    height.set(sizes().half);
    y.set(window.innerHeight);
    animate(y, 0, SPRING);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, visible]);

  // On-screen keyboard: fill the space above it, then go back to the previous size.
  const keyboardOpen = fit !== null;
  useEffect(() => {
    if (!visible || !open) return;
    if (fit) {
      setSnapState("full");
      animate(height, fit.height, SPRING);
    } else {
      animate(height, sizes()[snapRef.current], SPRING);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyboardOpen, fit?.height]);

  // Keep the size right when the screen rotates or the browser bars change.
  useEffect(() => {
    if (!visible) return;
    const onResize = () => {
      if (gesture.current?.mode === "drag" || !openRef.current) return;
      height.set(sizes()[snapRef.current]);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [visible, height, sizes]);

  // Lock the page behind, close on Escape, and move focus into the sheet.
  useEffect(() => {
    if (!visible || !open) return;
    const body = document.body.style;
    const html = document.documentElement.style;
    const prev = { overflow: body.overflow, overscroll: html.overscrollBehaviorY };
    body.overflow = "hidden";
    html.overscrollBehaviorY = "none";
    const previouslyFocused = document.activeElement as HTMLElement | null;
    sheetRef.current?.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !drawerOnTop()) onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      body.overflow = prev.overflow;
      html.overscrollBehaviorY = prev.overscroll;
      window.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [visible, open]);

  // ── Gestures ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const sheet = sheetRef.current;
    const backdrop = backdropRef.current;
    if (!visible || !sheet) return;

    const begin = (x: number, yPos: number, target: EventTarget | null, t: number) => {
      const el = target instanceof Element ? target : null;
      if (el?.closest("[data-sheet-no-drag], input[type='range']")) {
        gesture.current = null;
        return;
      }
      height.stop();
      y.stop();
      gesture.current = {
        startX: x,
        startY: yPos,
        originY: yPos,
        startExtent: height.get() - y.get(),
        startSnap: snapRef.current,
        scroller: (el?.closest("[data-sheet-scroll]") as HTMLElement | null) ?? null,
        mode: "pending",
        lastY: yPos,
        lastT: t,
        velocity: 0,
      };
    };

    /** Returns true when the sheet took the move (so the caller should block native scrolling). */
    const move = (x: number, yPos: number, t: number, isMouse: boolean): boolean => {
      const g = gesture.current;
      if (!g || g.mode === "native") return false;
      const dx = x - g.startX;
      const dy = yPos - g.startY;

      if (g.mode === "pending") {
        if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return !isMouse && snapRef.current === "half";
        if (Math.abs(dx) > Math.abs(dy)) {
          g.mode = "native"; // sideways: chip rows, carousels
          return false;
        }
        const s = g.scroller;
        const canScroll = !!s && snapRef.current === "full" && s.scrollHeight > s.clientHeight + 1;
        // Expanded content scrolls first; only a pull down from its very top moves the sheet.
        if (canScroll && (isMouse || dy < 0 || s!.scrollTop > 0)) {
          g.mode = "native";
          return false;
        }
        g.mode = "drag";
        g.originY = yPos;
        g.lastY = yPos;
        g.lastT = t;
      }

      const { half, full } = sizes();
      let extent = g.startExtent - (yPos - g.originY);
      if (extent > full) extent = full + (extent - full) * 0.2; // rubber band past full
      if (extent >= half) {
        height.set(extent);
        y.set(0);
      } else {
        height.set(half);
        y.set(half - extent);
      }

      const dt = Math.max(1, t - g.lastT);
      g.velocity = g.velocity * 0.6 + ((yPos - g.lastY) / dt) * 0.4;
      g.lastY = yPos;
      g.lastT = t;
      return true;
    };

    const end = () => {
      const g = gesture.current;
      gesture.current = null;
      if (!g || g.mode !== "drag") return;
      justDragged.current = true;
      window.setTimeout(() => (justDragged.current = false), 60);

      const { half, full } = sizes();
      const extent = height.get() - y.get();
      const projected = extent - g.velocity * 180;
      let target: Snap | "close";
      if (projected < half * 0.62 && !(g.startSnap === "full" && extent >= half * 0.85)) target = "close";
      else if (fitRef.current) target = "full";
      else if (projected > (half + full) / 2) target = "full";
      else target = "half";
      settle(target);
    };

    // Touch: non-passive so a sheet drag can stop the page from scrolling.
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        gesture.current = null;
        return;
      }
      const t = e.touches[0]!;
      begin(t.clientX, t.clientY, e.target, e.timeStamp);
    };
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      if (move(t.clientX, t.clientY, e.timeStamp, false) && e.cancelable) e.preventDefault();
    };
    const onTouchEnd = () => end();

    // Mouse: drag the sheet like a touch, from anywhere outside the scrolling content.
    const onMouseMove = (e: PointerEvent) => {
      move(e.clientX, e.clientY, e.timeStamp, true);
    };
    const onMouseUp = () => {
      window.removeEventListener("pointermove", onMouseMove);
      window.removeEventListener("pointerup", onMouseUp);
      end();
    };
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      begin(e.clientX, e.clientY, e.target, e.timeStamp);
      window.addEventListener("pointermove", onMouseMove);
      window.addEventListener("pointerup", onMouseUp);
    };

    // Scrolling the wheel down on a half-open sheet expands it.
    const onWheel = (e: WheelEvent) => {
      if (snapRef.current === "half" && e.deltaY > 8) settle("full");
    };

    const blockScroll = (e: TouchEvent) => e.cancelable && e.preventDefault();

    sheet.addEventListener("touchstart", onTouchStart, { passive: true });
    sheet.addEventListener("touchmove", onTouchMove, { passive: false });
    sheet.addEventListener("touchend", onTouchEnd);
    sheet.addEventListener("touchcancel", onTouchEnd);
    sheet.addEventListener("pointerdown", onPointerDown);
    sheet.addEventListener("wheel", onWheel, { passive: true });
    backdrop?.addEventListener("touchmove", blockScroll, { passive: false });
    return () => {
      sheet.removeEventListener("touchstart", onTouchStart);
      sheet.removeEventListener("touchmove", onTouchMove);
      sheet.removeEventListener("touchend", onTouchEnd);
      sheet.removeEventListener("touchcancel", onTouchEnd);
      sheet.removeEventListener("pointerdown", onPointerDown);
      sheet.removeEventListener("wheel", onWheel);
      backdrop?.removeEventListener("touchmove", blockScroll);
      window.removeEventListener("pointermove", onMouseMove);
      window.removeEventListener("pointerup", onMouseUp);
    };
  }, [visible, height, y, sizes, settle]);

  if (!mounted || !visible) return null;

  const look = THEMES[theme];

  return <>{createPortal(
    <SheetContext.Provider value={{ snap, setSnap }}>
      <motion.div
        ref={backdropRef}
        aria-hidden
        className={cn("fixed inset-0 z-[55]", look.backdrop)}
        initial={{ opacity: 0 }}
        animate={{ opacity: open ? 1 : 0 }}
        transition={{ duration: 0.25 }}
        onClick={() => {
          if (!drawerOnTop()) onClose();
        }}
      />
      <motion.div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        data-app-sheet=""
        data-snap={snap}
        onClickCapture={(e) => {
          // A swipe ends with a click on whatever was under the finger: swallow it.
          if (justDragged.current) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        className={cn(
          "fixed inset-x-4 z-[60] mx-auto flex max-w-md flex-col overflow-hidden outline-none",
          // Half: only sideways pans are native (chip rows); vertical moves belong to the sheet.
          snap === "half" ? "touch-pan-x" : "touch-auto",
          look.sheet,
          className,
        )}
        style={{ ...look.style, height, y, bottom: fit ? fit.bottom : GAP }}
      >
        {theme === "glass" && <GlassLighting />}
        <div className="relative flex min-h-0 flex-1 flex-col">
          <button
            type="button"
            aria-label={snap === "half" ? "Expand" : "Collapse"}
            onClick={() => settle(snap === "half" ? "full" : "half")}
            className="mx-auto flex h-6 w-16 shrink-0 items-center justify-center"
          >
            <span className={cn("block h-1.5 w-11 rounded-full", look.handle)} />
          </button>
          {children}
        </div>
      </motion.div>
    </SheetContext.Provider>,
    document.body,
  )}</>;
}
