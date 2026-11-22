"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import { InlineQrScanner } from "@/components/inline-qr-scanner";
import { CardHalo, QrCard } from "./qr-card";
import { QrThemeSheet } from "./qr-theme-sheet";
import { BACKDROPS, imageBackground, patternStyle, useCustomImage, useQrTheme } from "./qr-theme";

/* ───────── Promo designs that rotate under the card ───────── */

interface Slide {
  title: string;
  /** CTA copy; the `highlight` word is drawn in the slide's accent colour. */
  cta: [before: string, highlight: string, after: string];
  href: string;
  accent: string;
  sticker: string;
}

const SLIDES: Slide[] = [
  { title: "Find the right person", cta: ["Post a ", "request", " in 30 seconds"], href: "/post", accent: "#fb923c", sticker: "new" },
  { title: "Spin. Win. Repeat.", cta: ["Win up to ", "500 credits", " daily"], href: "/spin", accent: "#a78bfa", sticker: "daily" },
  { title: "Get seen first", cta: ["Feature your post at the ", "top", ""], href: "/featured", accent: "#facc15", sticker: "boost" },
  { title: "Bring your crew", cta: ["Invite & earn ", "300 credits", " each"], href: "/invite", accent: "#34d399", sticker: "refer" },
];

const SLIDE_MS = 5000;
const LONG_PRESS_MS = 450;

interface ExploreHeroProps {
  header: ReactNode;
  profileUrl: string;
  avatarUrl?: string | null;
  initial?: string;
}

export function ExploreHero({ header, profileUrl, avatarUrl, initial }: ExploreHeroProps) {
  const [theme, setTheme] = useQrTheme();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const qrTileRef = useRef<HTMLDivElement>(null);
  const backdrop = BACKDROPS[theme.backdrop];
  const customHero = useCustomImage("hero");
  const heroImage = imageBackground(theme.heroImage, "hero", customHero);

  // Scrolling the scanner (mostly) off-screen flips the tile back to the QR and stops the camera.
  useEffect(() => {
    const tile = qrTileRef.current;
    if (!scannerOpen || !tile) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry && entry.intersectionRatio < 0.25) setScannerOpen(false);
      },
      { threshold: [0, 0.25] },
    );
    observer.observe(tile);
    return () => observer.disconnect();
  }, [scannerOpen]);

  const press = useLongPress({
    onTap: () => setScannerOpen(true),
    onLongPress: () => {
      void haptic("medium");
      setSheetOpen(true);
    },
  });

  return (
    <section
      className="relative overflow-hidden rounded-b-[34px] pb-6 shadow-[0_1px_0_rgba(255,255,255,0.06)]"
      style={{ background: backdrop.base }}
    >
      {/* Backdrop: optional image, pattern, top vignette, soft glow + lighter floor like a stage */}
      {heroImage && (
        <>
          <div aria-hidden className="absolute inset-0" style={{ background: heroImage }} />
          {/* Dims the image so the header, title and buttons stay readable */}
          <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.45)_0%,rgba(0,0,0,0.15)_40%,rgba(0,0,0,0.55)_100%)]" />
        </>
      )}
      <div aria-hidden className="absolute inset-0" style={patternStyle(theme.pattern, backdrop.ink)} />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: `radial-gradient(80% 45% at 50% 42%, ${backdrop.glow}, transparent 70%), linear-gradient(180deg, rgba(0,0,0,0.35) 0%, transparent 22%, transparent 62%, rgba(255,255,255,0.06) 100%)`,
        }}
      />

      <div className="relative px-4 pt-[max(env(safe-area-inset-top),1rem)]">
        {header}

        {/* Profile QR: tap to scan someone else's in place, press & hold to customise */}
        <div ref={qrTileRef} className="relative mx-auto mt-9 grid h-[224px] w-[224px] place-items-center">
          <CardHalo theme={theme} className="-inset-14" />
          {scannerOpen ? (
            <InlineQrScanner
              onClose={() => setScannerOpen(false)}
              className="h-full w-full rounded-[26px] shadow-[0_22px_50px_-12px_rgba(0,0,0,0.75)] ring-1 ring-white/25"
            />
          ) : (
            <button
              type="button"
              {...press.handlers}
              aria-label="Open QR scanner. Press and hold to customise your QR."
              className={cn(
                "relative select-none rounded-[26px] [-webkit-touch-callout:none] [-webkit-tap-highlight-color:transparent]",
                "transition-transform ease-out",
                press.pressing ? "scale-[0.94] duration-[450ms]" : "scale-100 duration-200",
              )}
            >
              <QrCard theme={theme} size={224} value={profileUrl} avatarUrl={avatarUrl} initial={initial} />
            </button>
          )}
        </div>

        <p className="mt-3 text-center text-[11px] text-white/35">Tap to scan · Hold to customise</p>

        <PromoSlides paused={sheetOpen || scannerOpen} />
      </div>

      <QrThemeSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        theme={theme}
        onSave={setTheme}
        qrValue={profileUrl}
        avatarUrl={avatarUrl}
        initial={initial}
      />
    </section>
  );
}

/* ───────── Promo slides ───────── */

function PromoSlides({ paused }: { paused: boolean }) {
  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    if (paused) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % SLIDES.length), SLIDE_MS);
    return () => clearTimeout(t);
  }, [index, paused]);

  const go = (dir: 1 | -1) => setIndex((i) => (i + dir + SLIDES.length) % SLIDES.length);

  return (
    <div
      className="relative mt-4"
      onTouchStart={(e) => (touchX.current = e.touches[0]?.clientX ?? null)}
      onTouchEnd={(e) => {
        const start = touchX.current;
        const end = e.changedTouches[0]?.clientX;
        touchX.current = null;
        if (start == null || end == null || Math.abs(end - start) < 40) return;
        go(end < start ? 1 : -1);
      }}
    >
      <div className="relative h-[92px]">
        {SLIDES.map((s, i) => (
          <div
            key={s.href}
            aria-hidden={i !== index}
            className={cn(
              "absolute inset-0 flex flex-col items-center transition-all duration-500 ease-out",
              i === index ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0",
            )}
          >
            <h2 className="text-center text-[27px] font-bold leading-tight tracking-[-0.025em] text-white">{s.title}</h2>
            <Link
              href={s.href}
              tabIndex={i === index ? 0 : -1}
              className="relative mt-2.5 flex h-[38px] items-center gap-2.5 rounded-full border border-white/[0.12] bg-black/55 pl-5 pr-4 text-[14px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md active:scale-[0.98]"
            >
              <span>
                {s.cta[0]}
                <span style={{ color: s.accent }}>{s.cta[1]}</span>
                {s.cta[2]}
              </span>
              <ArrowRight className="h-4 w-4" strokeWidth={2.2} />
              <span
                className="absolute -bottom-3 -right-3 -rotate-[8deg] rounded-[6px] bg-white px-1.5 py-px text-[11px] font-black italic lowercase tracking-tight text-black shadow-[0_2px_0_rgba(0,0,0,0.6)]"
                style={{ boxShadow: `0 0 0 1.5px #000, 2px 2px 0 ${s.accent}` }}
              >
                {s.sticker}
              </span>
            </Link>
          </div>
        ))}
      </div>

      {/* <div className="mt-3 flex justify-center gap-1.5" role="tablist" aria-label="Highlights">
        {SLIDES.map((s, i) => (
          <button
            key={s.href}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={s.title}
            onClick={() => setIndex(i)}
            className={cn("h-1.5 rounded-full transition-all duration-300", i === index ? "w-5 bg-white/80" : "w-1.5 bg-white/25")}
          />
        ))}
      </div> */}
    </div>
  );
}

/* ───────── Tap vs press-and-hold ───────── */

function useLongPress({ onTap, onLongPress }: { onTap: () => void; onLongPress: () => void }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const [pressing, setPressing] = useState(false);

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    origin.current = null;
    setPressing(false);
  };
  const fire = () => {
    cancel();
    fired.current = true;
    onLongPress();
  };

  useEffect(() => cancel, []);

  return {
    pressing,
    handlers: {
      onPointerDown: (e: React.PointerEvent) => {
        if (e.button !== 0) return;
        fired.current = false;
        origin.current = { x: e.clientX, y: e.clientY };
        setPressing(true);
        timer.current = setTimeout(fire, LONG_PRESS_MS);
      },
      onPointerMove: (e: React.PointerEvent) => {
        const o = origin.current;
        if (o && Math.hypot(e.clientX - o.x, e.clientY - o.y) > 10) cancel();
      },
      onPointerUp: cancel,
      onPointerLeave: cancel,
      onPointerCancel: cancel,
      // Right-click, the keyboard menu key, or Android's own long-press all land here.
      onContextMenu: (e: React.MouseEvent) => {
        e.preventDefault();
        if (!fired.current) fire();
      },
      onClick: (e: React.MouseEvent) => {
        if (fired.current) {
          e.preventDefault();
          fired.current = false;
          return;
        }
        onTap();
      },
    },
  };
}
