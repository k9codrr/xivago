"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHaptic } from "@/components/ui/haptic";
import { SHEET_STYLES, setSheetStyle, useSheetStyle, type SheetStyle } from "@/lib/sheet-style";

const LABELS: Record<SheetStyle, { title: string; hint: string }> = {
  default: { title: "Default", hint: "Dark frosted sheet" },
  spotify: { title: "Spotify", hint: "Solid dark, music-app style" },
  glass: { title: "Liquid glass", hint: "Clear, Apple-style glass" },
};

/* Miniature sketch: a page with a half-open sheet floating over it */
function Preview({ style }: { style: SheetStyle }) {
  const sheet: Record<SheetStyle, string> = {
    default: "rounded-[10px] border border-white/15 bg-neutral-800/80 backdrop-blur",
    spotify: "rounded-[6px] bg-gradient-to-b from-[#2b2b2b] to-[#181818]",
    glass:
      "rounded-[12px] border border-white/40 bg-white/15 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]",
  };
  return (
    <div className="relative aspect-[3/4.4] w-full overflow-hidden rounded-[12px] bg-gradient-to-br from-[#0A84FF] via-[#BF5AF2] to-[#FF9F0A]">
      <div className="absolute inset-0 bg-black/30" />
      <div className={cn("absolute inset-x-1.5 bottom-1.5 h-[52%] p-1.5", sheet[style])}>
        <div className="mx-auto h-1 w-5 rounded-full bg-white/50" />
        <div className="mt-1.5 space-y-1">
          <div className="h-2.5 w-full rounded-[4px] bg-white/15" />
          <div className="h-2.5 w-full rounded-[4px] bg-white/15" />
          <div className={cn("h-2.5 w-full", style === "spotify" ? "rounded-full bg-[#1DB954]" : "rounded-full bg-white/85")} />
        </div>
      </div>
    </div>
  );
}

export function SheetStylePicker() {
  const current = useSheetStyle();
  const tap = useHaptic("light");

  return (
    <div role="radiogroup" aria-label="Drawer style" className="grid grid-cols-3 gap-2.5">
      {SHEET_STYLES.map((style) => {
        const selected = style === current;
        return (
          <button
            key={style}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => {
              tap();
              setSheetStyle(style);
            }}
            className={cn(
              "flex flex-col gap-2.5 rounded-[18px] border-2 p-2.5 text-left transition-colors",
              selected
                ? "border-[#0A84FF] bg-[#0A84FF]/[0.06]"
                : "border-neutral-200 hover:border-neutral-300 dark:border-neutral-800 dark:hover:border-neutral-700",
            )}
          >
            <Preview style={style} />
            <div className="flex items-start justify-between gap-1">
              <div className="min-w-0">
                <p className="text-[14px] font-semibold leading-tight">{LABELS[style].title}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">{LABELS[style].hint}</p>
              </div>
              <span
                className={cn(
                  "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
                  selected ? "border-[#0A84FF] bg-[#0A84FF] text-white" : "border-neutral-300 dark:border-neutral-700",
                )}
              >
                {selected && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
