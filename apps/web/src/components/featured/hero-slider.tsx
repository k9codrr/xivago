"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { MapPin, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBudgetRange } from "@/lib/money";
import { trackFeatured } from "@/components/featured/track";
import { LiquidGlass } from "../ui/liquid-glass";
import { useHeroStyle } from "@/lib/hero-style";
import { StackHero } from "@/components/featured/stack-hero";

export interface HeroSlideData {
  kind: "sponsored" | "top" | "promo";
  placementId?: string;
  nicheId: string;
  nicheName: string;
  demand?: {
    id: string;
    summary: string;
    budgetMin: number | null;
    budgetMax: number | null;
    subCategoryName: string | null;
    mediaUrls: string[];
    author: { name: string; companyName: string | null; location: string | null };
  };
}

const GLASS =
  "border border-white/[0.14] bg-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_10px_30px_rgba(0,0,0,0.4)] backdrop-blur-2xl backdrop-saturate-[1.8]";

const AUTOPLAY_MS = 5000;
const MAX_DOTS = 7;

/**
 * Home hero. With featured bidding on, slides are the sponsored winners per
 * niche (labelled "Sponsored" — paid placement must be disclosed); with it
 * off, the top listing of each niche. "Explore" opens that niche's page.
 */
export function HeroSlider({ slides }: { slides: HeroSlideData[] }) {
  const style = useHeroStyle();
  return style === "stack" ? <StackHero slides={slides} /> : <ClassicHero slides={slides} />;
}

function ClassicHero({ slides }: { slides: HeroSlideData[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const pausedRef = useRef(false);

  const goTo = useCallback((i: number) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  }, []);

  // Keep `active` in sync with manual swipes.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const onScroll = () => setActive(Math.round(el.scrollLeft / Math.max(el.clientWidth, 1)));
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (slides.length < 2) return;
    const t = setInterval(() => {
      // Hold still while a drawer is open: the glass sheet shows the page behind it.
      if (!pausedRef.current && !document.querySelector("[data-vaul-drawer],[data-app-sheet]")) {
        goTo((active + 1) % slides.length);
      }
    }, AUTOPLAY_MS);
    return () => clearInterval(t);
  }, [active, slides.length, goTo]);

  useEffect(() => {
    const s = slides[active];
    if (s?.kind === "sponsored") trackFeatured(s.placementId, "impression");
  }, [active, slides]);

  if (!slides.length) return null;

  const dotStart = Math.min(Math.max(0, active - Math.floor(MAX_DOTS / 2)), Math.max(0, slides.length - MAX_DOTS));
  const dots = slides.slice(dotStart, dotStart + MAX_DOTS).map((_, i) => i + dotStart);

  return (
    <div
      className="relative overflow-hidden rounded-[30px] bg-[#1C1C1E] shadow-[0_30px_60px_-12px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.06)] animate-in fade-in zoom-in-95 duration-700"
      onPointerDown={() => (pausedRef.current = true)}
      onPointerUp={() => (pausedRef.current = false)}
      onPointerLeave={() => (pausedRef.current = false)}
    >
      <div ref={trackRef} className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {slides.map((s, i) => (
          <Slide key={`${s.kind}-${s.placementId ?? s.demand?.id ?? i}`} slide={s} />
        ))}
      </div>

      {/* {slides.length > 1 && (
        <div className={cn("absolute bottom-6 right-6 z-20 flex h-2 items-center gap-[6px] rounded-full px-3 py-2.5", GLASS)}>
          {dots.map((i) => (
            <button
              key={i}
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => goTo(i)}
              className={cn(
                "!h-[1px] rounded-full transition-all duration-300",
                i === active ? "w-[18px] h-1 bg-white" : "w-[6px] h-1 bg-white/35",
              )}
            />
          ))}
        </div>
      )} */}
      {slides.length > 1 && (
      <LiquidGlass
          radius={28}
          bevelDepth={37}
          scale={36}
          tint={0.35}
          aberration={14}
          frost={0.4}
          contentClassName="flex items-center justify-between"
        className={cn("absolute bottom-6 right-4 z-20 flex items-center gap-5 rounded-full px-2 py-3 shadow-[0_12px_40px_rgb(0_0_0/0.25),inset_0_1px_0_rgb(255_255_255/0.5)]")}>
       
    {dots.map((i) => (
      <button
          key={i}
          type="button"
          aria-label={`Go to slide ${i + 1}`}
          aria-current={i===active ? "true" : undefined}
          onClick={() => goTo(i)}
          className="group relative gap-4 grid place-items-center h-2 w-2 bg-transparent !min-h-0 min-w-0 p-0 m-0 leading-none appearance-none border-0 outline-none focus-visible:ring-2 focus-visible:ring-white/60 rounded-full"
        >
          <span
            className={cn(
              "block aspect-square rounded-full transition-all duration-300 ease-out",
              i===active
                ? "h-2 w-2 bg-white scale-110 shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                : "h-1.5 w-1.5 bg-white/40 scale-100 group-hover:bg-white/70 group-hover:scale-125",
            )}
          />
        </button>
    ))}
  </LiquidGlass>
)}
    </div>
  );
}

function Slide({ slide }: { slide: HeroSlideData }) {
  if (slide.kind === "promo") {
    return (
      <div className="relative flex min-h-[460px] w-full shrink-0 snap-center flex-col justify-between overflow-hidden p-6">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0A84FF]/50 via-[#5E5CE6]/30 to-[#BF5AF2]/40" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(255,255,255,0.25),transparent_55%)]" />
        <span className={cn("relative w-fit rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-white", GLASS)}>
          Featured
        </span>
        <div className="relative">
          <Sparkles className="mb-3 h-8 w-8 text-white/80" />
          <h2 className="text-[32px] font-bold leading-[1.05] tracking-[-0.025em]">
            Feature your
            <br />
            request here
          </h2>
          <p className="mt-2 max-w-[270px] text-[15px] leading-snug text-white/70">
            Show your request to every provider in its category for 5 days.
          </p>
          {/* <Link
            href="/featured"
            className="mt-6 inline-flex h-11 items-center rounded-full bg-pearl px-6 text-[15px] font-semibold tracking-[-0.01em] text-slate-navy shadow-[0_10px_30px_rgba(255,255,255,0.18)] transition-transform duration-200 active:scale-95"
          >
            Get featured
          </Link> */}
          <LiquidGlass
          radius={28}
          bevelDepth={37}
          scale={36}
          tint={0.35}
          aberration={14}
          frost={0.4}
          contentClassName="flex items-center justify-between"
        className={cn("mt-6 inline-flex h-11 items-center rounded-full text-white text-[15px] font-semibold z-20  gap-1.5 px-2 py-3 shadow-[0_12px_40px_rgb(0_0_0/0.25),inset_0_1px_0_rgb(255_255_255/0.5)]")}>
       Get featured </LiquidGlass>
        </div>
      </div>
    );
  }

  const d = slide.demand!;
  const cover = d.mediaUrls[0];
  const budget = formatBudgetRange(d.budgetMin, d.budgetMax);
  const onClick = () => slide.kind === "sponsored" && trackFeatured(slide.placementId, "click");

  return (
    <div className="group relative flex min-h-[460px] w-full shrink-0 snap-center flex-col justify-between overflow-hidden p-6">
      <Link href={`/demands/${d.id}`} onClick={onClick} className="absolute inset-0" aria-label={d.summary}>
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#0A84FF]/40 to-[#BF5AF2]/40" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-[70%] bg-gradient-to-t from-black/95 via-black/60 to-transparent" />
      </Link>
      <div className="pointer-events-none absolute inset-0 rounded-[30px] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]" />

      <div className="pointer-events-none relative flex items-center gap-2">
        <span className={cn("rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-white", GLASS)}>
          {slide.kind === "sponsored" ? "Sponsored" : "Featured request"}
        </span>
      </div>

      <div className="pointer-events-none relative">
        <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-white/60">
          {slide.nicheName}
          {d.subCategoryName ? ` · ${d.subCategoryName}` : ""}
        </p>
        <h2 className="mt-1.5 line-clamp-3 text-[26px] font-bold leading-[1.1] tracking-[-0.025em]">{d.summary}</h2>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-white/70">
          <span className="font-medium text-white/85">{d.author.companyName ?? d.author.name}</span>
          {d.author.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {d.author.location.split(",")[0]}
            </span>
          )}
          {budget && <span>{budget}</span>}
        </p>

        <div className="mt-6 flex items-center">
          <Link
            href={`/niche/${slide.nicheId}`}
            onClick={onClick}
            className="pointer-events-auto inline-flex h-10 items-center rounded-full bg-pearl px-6 text-[15px] font-semibold tracking-[-0.01em] text-slate-navy shadow-[0_10px_30px_rgba(255,255,255,0.18)] transition-transform duration-200 active:scale-95"
          >
            Explore
          </Link>
        </div>
      </div>
    </div>
  );
}
