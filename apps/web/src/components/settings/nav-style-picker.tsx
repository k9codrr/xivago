"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHaptic } from "@/components/ui/haptic";
import { NAV_STYLES, setNavStyle, useNavStyle, type NavStyle } from "@/lib/nav-style";

const LABELS: Record<NavStyle, { title: string; hint: string }> = {
  glass: { title: "Glass", hint: "Floating glass bar, icons stay in place" },
  modern: { title: "Modern", hint: "Sliding bar, selected tab in the center" },
};

/* Miniature, non-interactive sketches of each nav design */
function GlassPreview() {
  return (
    <div className="relative aspect-[3/4.4] w-full overflow-hidden rounded-[12px] bg-gradient-to-br from-[#30D158] via-[#0A84FF] to-[#1C1C1E]">
      <div className="absolute inset-x-1.5 bottom-1.5 flex h-5 items-center justify-between rounded-full bg-[#1C1C1E]/60 px-[3px] ring-1 ring-white/20 backdrop-blur-sm">
        <div className="flex h-[14px] w-[14px] items-center justify-center rounded-full bg-white/25">
          <div className="h-1.5 w-1.5 rounded-[2px] bg-white" />
        </div>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="mx-auto h-1.5 w-1.5 rounded-[2px] bg-white/75" />
        ))}
      </div>
    </div>
  );
}

function ModernPreview() {
  return (
    <div className="relative aspect-[3/4.4] w-full overflow-hidden rounded-[12px] bg-gradient-to-br from-[#BF5AF2] via-[#5E5CE6] to-[#1C1C1E]">
      <div className="absolute inset-x-0 bottom-0 flex h-7 items-center justify-center gap-1.5 bg-neutral-950/95">
        <div className="h-3 w-3 rounded-full bg-[#222]" />
        <div className="h-3 w-3 rounded-full bg-[#222]" />
        <div className="h-[18px] w-[18px] rounded-full bg-white" />
        <div className="h-3 w-3 rounded-full bg-[#222]" />
        <div className="h-3 w-3 rounded-full bg-[#222]" />
      </div>
    </div>
  );
}

export function NavStylePicker() {
  const current = useNavStyle();
  const tap = useHaptic("light");

  return (
    <div role="radiogroup" aria-label="Bottom navigation style" className="grid grid-cols-2 gap-3">
      {NAV_STYLES.map((style) => {
        const selected = style === current;
        return (
          <button
            key={style}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => {
              tap();
              setNavStyle(style);
            }}
            className={cn(
              "flex flex-col gap-3 rounded-[20px] border-2 p-3 text-left transition-colors",
              selected
                ? "border-[#0A84FF] bg-[#0A84FF]/[0.06]"
                : "border-neutral-200 hover:border-neutral-300 dark:border-neutral-800 dark:hover:border-neutral-700",
            )}
          >
            <div className="mx-auto w-[72%]">{style === "glass" ? <GlassPreview /> : <ModernPreview />}</div>
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
