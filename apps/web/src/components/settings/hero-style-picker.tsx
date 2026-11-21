"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHaptic } from "@/components/ui/haptic";
import { HERO_STYLES, setHeroStyle, useHeroStyle, type HeroStyle } from "@/lib/hero-style";

const LABELS: Record<HeroStyle, { title: string; hint: string }> = {
  classic: { title: "Classic", hint: "Full-width slider with dots" },
  stack: { title: "Stack", hint: "Stacked cards that loop forever" },
};

/* Miniature, non-interactive sketches of each hero design */
function ClassicPreview() {
  return (
    <div className="relative aspect-[4/4.6] w-full overflow-hidden rounded-[12px] bg-gradient-to-br from-[#0A84FF] via-[#5E5CE6] to-[#1C1C1E]">
      <div className="absolute inset-x-0 bottom-0 h-[60%] bg-gradient-to-t from-black via-black/70 to-transparent" />
      <div className="absolute left-1.5 top-1.5 h-2 w-7 rounded-full bg-white/30" />
      <div className="absolute inset-x-2 bottom-2 space-y-1">
        <div className="h-2 w-full rounded-full bg-white" />
        <div className="h-2 w-2/3 rounded-full bg-white" />
        <div className="flex items-center justify-between pt-1">
          <div className="h-3 w-8 rounded-full bg-white/90" />
          <div className="flex gap-0.5">
            <span className="h-1 w-1 rounded-full bg-white" />
            <span className="h-1 w-1 rounded-full bg-white/40" />
            <span className="h-1 w-1 rounded-full bg-white/40" />
          </div>
        </div>
      </div>
    </div>
  );
}

function StackPreview() {
  return (
    <div className="relative aspect-[4/4.6] w-full">
      <div className="absolute inset-y-[10%] left-0 right-0 rounded-[11px] bg-[#3A2A1A]" />
      <div className="absolute inset-y-[5%] left-0 right-[6px] rounded-[11px] bg-[#1E3A5F]" />
      <div className="absolute inset-y-0 left-0 right-[12px] overflow-hidden rounded-[12px] bg-gradient-to-br from-[#FF9F0A] via-[#FF375F] to-[#1C1C1E]">
        <div className="absolute inset-x-0 bottom-0 h-[60%] bg-gradient-to-t from-black via-black/70 to-transparent" />
        <div className="absolute left-1.5 top-1.5 h-2.5 w-9 rounded-[4px] bg-white/25" />
        <div className="absolute inset-x-2 bottom-2 space-y-1">
          <div className="h-2 w-4/5 rounded-full bg-white" />
          <div className="h-1.5 w-1/2 rounded-full bg-white/40" />
          <div className="flex gap-1 pt-1">
            <div className="h-3.5 flex-1 rounded-[5px] bg-white/20" />
            <div className="h-3.5 w-3.5 rounded-[5px] bg-white/20" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function HeroStylePicker() {
  const current = useHeroStyle();
  const tap = useHaptic("light");

  return (
    <div role="radiogroup" aria-label="Home hero style" className="grid grid-cols-2 gap-3">
      {HERO_STYLES.map((style) => {
        const selected = style === current;
        return (
          <button
            key={style}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => {
              tap();
              setHeroStyle(style);
            }}
            className={cn(
              "flex flex-col gap-3 rounded-[20px] border-2 p-3 text-left transition-colors",
              selected
                ? "border-[#0A84FF] bg-[#0A84FF]/[0.06]"
                : "border-neutral-200 hover:border-neutral-300 dark:border-neutral-800 dark:hover:border-neutral-700",
            )}
          >
            <div className="mx-auto w-[80%]">{style === "classic" ? <ClassicPreview /> : <StackPreview />}</div>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[15px] font-semibold">{LABELS[style].title}</p>
                <p className="text-[12px] leading-snug text-neutral-500">{LABELS[style].hint}</p>
              </div>
              <span
                className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                  selected ? "border-[#0A84FF] bg-[#0A84FF] text-white" : "border-neutral-300 dark:border-neutral-700",
                )}
              >
                {selected && <Check className="h-3 w-3" strokeWidth={3} />}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
