"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHaptic } from "@/components/ui/haptic";
import { DRAWER_STYLES, type DrawerStyle } from "@/lib/drawer-style";

export const DRAWER_STYLE_LABELS: Record<DrawerStyle, { title: string; hint: string }> = {
  default: { title: "Default", hint: "Standard bottom sheet drawer" },
  modern: { title: "Modern", hint: "Pinterest-style peek drawer" },
};

function Preview({ style }: { style: DrawerStyle }) {
  return (
    <div className="relative aspect-[3/4.4] w-full overflow-hidden rounded-[12px] bg-gradient-to-br from-[#0A84FF] via-[#BF5AF2] to-[#FF9F0A]">
      <div className="absolute inset-0 bg-black/30" />
      {style === "default" ? (
        <div className="absolute inset-x-1.5 bottom-1.5 h-[52%] rounded-[10px] border border-white/15 bg-neutral-800/80 p-1.5 backdrop-blur">
          <div className="mx-auto h-1 w-5 rounded-full bg-white/50" />
          <div className="mt-1.5 space-y-1">
            <div className="h-2.5 w-full rounded-[4px] bg-white/15" />
            <div className="h-2.5 w-full rounded-[4px] bg-white/15" />
            <div className="h-2.5 w-full rounded-full bg-white/85" />
          </div>
        </div>
      ) : (
        <>
          <div className="absolute inset-x-0 top-[20%] h-[45%] bg-gradient-to-b from-transparent via-transparent to-black/60" />
          <div className="absolute inset-x-1.5 bottom-1.5 h-[38%] rounded-[10px] border border-white/20 bg-neutral-900/90 p-1.5 backdrop-blur-xl">
            <div className="mx-auto h-1 w-5 rounded-full bg-white/50" />
            <div className="mt-1.5 space-y-1">
              <div className="h-2 w-3/4 rounded-[4px] bg-white/15" />
              <div className="mt-1 flex gap-1">
                <div className="h-5 flex-1 rounded-[4px] bg-[#30D158]/40" />
                <div className="h-5 flex-1 rounded-[4px] bg-[#0A84FF]/40" />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function DrawerStylePicker({ value: current, onChange }: { value: DrawerStyle; onChange: (v: DrawerStyle) => void }) {
  const tap = useHaptic("light");

  return (
    <div role="radiogroup" aria-label="Demand drawer style" className="grid grid-cols-2 gap-2.5">
      {DRAWER_STYLES.map((style) => {
        const selected = style === current;
        return (
          <button
            key={style}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => {
              tap();
              onChange(style);
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
                <p className="text-[14px] font-semibold leading-tight">{DRAWER_STYLE_LABELS[style].title}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">{DRAWER_STYLE_LABELS[style].hint}</p>
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
