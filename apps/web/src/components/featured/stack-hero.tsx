"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode, type PointerEvent as ReactPointerEvent } from "react";
import { ArrowUpRight, Check, MapPin, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatBudgetRange } from "@/lib/money";
import { trackFeatured } from "@/components/featured/track";
import type { HeroSlideData } from "@/components/featured/hero-slider";

const AUTOPLAY_MS = 5000;
/** How far each card behind the front one peeks out on the right. */
const PEEK = 16;
/** Horizontal drag distance that commits a swipe. */
const SWIPE_THRESHOLD = 70;
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const TRANSITION = `transform 560ms ${EASE}, opacity 420ms ${EASE}, filter 560ms ${EASE}`;

const GLASS_PILL =
  "border border-white/[0.14] bg-black/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur-2xl backdrop-saturate-[1.6]";
const GLASS_BUTTON =
  "border border-white/[0.12] bg-gradient-to-b from-white/[0.18] to-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_10px_24px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-transform duration-200 active:scale-[0.97]";

const mod = (i: number, n: number) => ((i % n) + n) % n;

/**
 * "Stack" home hero: the featured slides as a deck of stacked cards. Swipe
 * (or wait) to move through them; the deck loops forever, so after the last
 * slide the first comes round again. Same links, tracking and disclosure as
 * the classic slider.
 */
export function StackHero({ slides }: { slides: HeroSlideData[] }) {
  const n = slides.length;
  // Unbounded position: the slide shown is slides[pos mod n]. Keying cards by
  // absolute position lets the deck keep animating forward without an end.
  const [pos, setPos] = useState(0);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [saved, setSaved] = useState<Set<string>>(() => new Set());
  const pausedRef = useRef(false);
  const draggedRef = useRef(false);
  const active = n ? mod(pos, n) : 0;

  const step = useCallback((dir: 1 | -1) => setPos((p) => p + dir), []);

  // Autoplay; restarts after every move so a manual swipe gets a full interval.
  useEffect(() => {
    if (n < 2) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      // Hold still while a drawer is open: the glass sheet shows the page behind it.
      if (pausedRef.current || document.hidden || document.querySelector("[data-vaul-drawer],[data-app-sheet]")) return;
      setPos((p) => p + 1);
    }, AUTOPLAY_MS);
    return () => clearInterval(t);
  }, [pos, n]);

  useEffect(() => {
    const s = slides[active];
    if (s?.kind === "sponsored") trackFeatured(s.placementId, "impression");
  }, [active, slides]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (n < 2 || (e.pointerType === "mouse" && e.button !== 0)) return;
    const startX = e.clientX;
    const startY = e.clientY;
    let lastX = 0;
    let horizontal = false;
    draggedRef.current = false;
    pausedRef.current = true;

    const move = (ev: PointerEvent) => {
      const mx = ev.clientX - startX;
      const my = ev.clientY - startY;
      if (!horizontal) {
        if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
        // Mostly vertical: it's a page scroll, not a swipe.
        if (Math.abs(my) >= Math.abs(mx)) return finish(false);
        horizontal = true;
        draggedRef.current = true;
        setDragging(true);
      }
      lastX = mx;
      setDx(mx);
    };
    const up = () => finish(true);
    const finish = (commit: boolean) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      pausedRef.current = false;
      if (commit && horizontal) {
        if (lastX <= -SWIPE_THRESHOLD) step(1);
        else if (lastX >= SWIPE_THRESHOLD) step(-1);
      }
      setDx(0);
      setDragging(false);
    };
    const cancel = () => finish(false);

    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (n < 2) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      step(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      step(-1);
    }
  };

  const toggleSave = useCallback(
    async (demandId: string) => {
      const next = !saved.has(demandId);
      setSaved((prev) => {
        const copy = new Set(prev);
        if (next) copy.add(demandId);
        else copy.delete(demandId);
        return copy;
      });
      try {
        const res = next
          ? await fetch("/api/bookmarks", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ demandId }),
            })
          : await fetch(`/api/bookmarks?demandId=${encodeURIComponent(demandId)}`, { method: "DELETE" });
        if (!res.ok) throw new Error();
        toast.success(next ? "Saved to bookmarks" : "Removed from bookmarks");
      } catch {
        setSaved((prev) => {
          const copy = new Set(prev);
          if (next) copy.delete(demandId);
          else copy.add(demandId);
          return copy;
        });
        toast.error("Couldn't update bookmarks");
      }
    },
    [saved],
  );

  if (!n) return null;

  // Cards behind the front one: up to two, fewer when there aren't enough slides.
  const maxBack = Math.min(2, n - 1);
  // -1: the card that just left (or will come back on a right swipe); 3: next one waiting, hidden.
  const depths = n < 2 ? [0] : [-1, 0, 1, 2, 3];
  // While dragging left, the cards behind start moving up into place.
  const progress = dragging && dx < 0 ? Math.min(-dx / 240, 1) : 0;

  const layerStyle = (d: number): CSSProperties => {
    const transition = dragging ? "none" : TRANSITION;
    if (d === 0) {
      return {
        transform: `translateX(${dx}px) rotate(${dx * 0.025}deg)`,
        transition: dragging ? "none" : TRANSITION,
        zIndex: 30,
      };
    }
    if (d < 0) {
      return {
        transform: "translateX(-115%) rotate(-8deg)",
        opacity: 0,
        transition,
        zIndex: 40,
        pointerEvents: "none",
      };
    }
    const hidden = d > maxBack;
    const depth = (hidden ? maxBack + 1 : d) - progress;
    return {
      transform: `translateX(${depth * PEEK}px) scale(${1 - depth * 0.07})`,
      transformOrigin: "right center",
      filter: `brightness(${Math.max(1 - depth * 0.3, 0.2)})`,
      opacity: hidden ? 0 : 1,
      transition,
      zIndex: 30 - d,
      pointerEvents: "none",
    };
  };

  return (
    // Bleeds to the screen edges so the cards flying out aren't clipped mid-page.
    <div className="-mx-4 -my-4 overflow-hidden px-4 py-4 animate-in fade-in zoom-in-95 duration-700">
      <div
        role="region"
        aria-roledescription="carousel"
        aria-label="Featured requests"
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onClickCapture={(e) => {
          // A swipe ends with a click on whatever was under the finger: swallow it.
          if (draggedRef.current) {
            e.preventDefault();
            e.stopPropagation();
            draggedRef.current = false;
          }
        }}
        className="relative h-[480px] touch-pan-y select-none outline-none focus-visible:rounded-[30px] focus-visible:ring-2 focus-visible:ring-white/50"
      >
        {depths.map((d) => {
          const abs = pos + d;
          const slide = slides[mod(abs, n)]!;
          const front = d === 0;
          return (
            <div
              key={abs}
              aria-hidden={!front}
              className="absolute inset-y-0 left-0 will-change-transform"
              style={{ width: n < 2 ? "100%" : `calc(100% - ${maxBack * PEEK}px)`, ...layerStyle(d) }}
            >
              <StackCard
                slide={slide}
                interactive={front}
                saved={!!slide.demand && saved.has(slide.demand.id)}
                onToggleSave={toggleSave}
              />
            </div>
          );
        })}
      </div>
      <p className="sr-only" aria-live="polite">
        Slide {active + 1} of {n}
      </p>
    </div>
  );
}

function StackCard({
  slide,
  interactive,
  saved,
  onToggleSave,
}: {
  slide: HeroSlideData;
  interactive: boolean;
  saved: boolean;
  onToggleSave: (demandId: string) => void;
}) {
  const tabIndex = interactive ? undefined : -1;
  const shell =
    "relative h-full w-full overflow-hidden rounded-[28px] bg-[#1C1C1E] text-white shadow-[0_24px_50px_-12px_rgba(0,0,0,0.85),0_0_0_1px_rgba(255,255,255,0.07)]";

  if (slide.kind === "promo") {
    return (
      <div className={shell}>
        <div className="absolute inset-0 bg-gradient-to-br from-[#0A84FF]/60 via-[#5E5CE6]/40 to-[#BF5AF2]/50" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(255,255,255,0.25),transparent_55%)]" />
        <div className="absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-black/80 to-transparent" />
        <div className="relative flex h-full flex-col justify-between p-5">
          <Badge>Featured</Badge>
          <div>
            <h2 className="text-[30px] font-bold leading-[1.05] tracking-[-0.025em]">
              Feature your
              <br />
              request here
            </h2>
            <p className="mt-2 text-[15px] text-white/65">Every provider in its category · 5 days</p>
            <div className="mt-5 flex items-center gap-3">
              <Link
                href="/featured"
                tabIndex={tabIndex}
                className={cn("flex h-12 flex-1 items-center justify-center gap-2 rounded-[16px] text-[17px] font-semibold", GLASS_BUTTON)}
              >
                <Sparkles className="h-5 w-5" />
                Get featured
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const d = slide.demand!;
  const cover = d.mediaUrls[0];
  const budget = formatBudgetRange(d.budgetMin, d.budgetMax);
  const onClick = () => slide.kind === "sponsored" && trackFeatured(slide.placementId, "click");
  const meta = [slide.nicheName, d.subCategoryName, budget].filter(Boolean) as string[];
  const who = d.author.companyName ?? d.author.name;
  const where = d.author.location?.split(",")[0];

  return (
    <div className={cn(shell, "group")}>
      <Link
        href={`/demands/${d.id}`}
        onClick={onClick}
        tabIndex={tabIndex}
        draggable={false}
        className="absolute inset-0"
        aria-label={d.summary}
      >
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt=""
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#0A84FF]/40 to-[#BF5AF2]/40" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-[72%] bg-gradient-to-t from-black via-black/70 to-transparent" />
      </Link>
      <div className="pointer-events-none absolute inset-0 rounded-[28px] shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]" />

      <div className="pointer-events-none relative flex h-full flex-col justify-between p-5">
        <Badge>{slide.kind === "sponsored" ? "Sponsored" : "Featured request"}</Badge>

        <div>
          <h2 className="line-clamp-3 text-[26px] font-bold leading-[1.1] tracking-[-0.025em] drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)]">
            {d.summary}
          </h2>
          {meta.length > 0 && (
            <p className="mt-2.5 flex flex-wrap items-center gap-x-2 text-[15px] font-medium text-white/60">
              {meta.map((m, i) => (
                <span key={i} className="inline-flex items-center gap-2">
                  {i > 0 && <span aria-hidden className="h-1 w-1 rounded-full bg-white/50" />}
                  {m}
                </span>
              ))}
            </p>
          )}
          <p className="mt-2 flex items-center gap-2 text-[16px] font-semibold text-white/90">
            <span className="grid h-6 w-6 place-items-center rounded-[7px] bg-gradient-to-b from-[#5E8BFF] to-[#5E5CE6]">
              <MapPin className="h-3.5 w-3.5" />
            </span>
            <span className="truncate">
              {who}
              {where ? ` · ${where}` : ""}
            </span>
          </p>

          <div className="mt-5 flex items-center gap-3">
            <Link
              href={`/niche/${slide.nicheId}`}
              onClick={onClick}
              tabIndex={tabIndex}
              draggable={false}
              className={cn(
                "pointer-events-auto flex h-12 flex-1 items-center justify-center gap-2 rounded-[16px] text-[17px] font-semibold tracking-[-0.01em]",
                GLASS_BUTTON,
              )}
            >
              <ArrowUpRight className="h-5 w-5" strokeWidth={2.5} />
              View Post
            </Link>
            <button
              type="button"
              tabIndex={tabIndex}
              aria-label={saved ? "Remove from bookmarks" : "Save to bookmarks"}
              aria-pressed={saved}
              onClick={() => onToggleSave(d.id)}
              className={cn("pointer-events-auto grid h-12 w-12 shrink-0 place-items-center rounded-[16px]", GLASS_BUTTON)}
            >
              {saved ? <Check className="h-6 w-6" strokeWidth={2.25} /> : <Plus className="h-6 w-6" strokeWidth={2} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className={cn("inline-flex w-fit items-center gap-2 rounded-[14px] px-3.5 py-2 text-[15px] font-semibold text-white", GLASS_PILL)}>
      <Sparkles className="h-4 w-4 text-[#FF9F0A]" fill="currentColor" />
      {children}
    </span>
  );
}
