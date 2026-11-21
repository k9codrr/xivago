"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHaptic } from "@/components/ui/haptic";
import { CARD_LAYOUTS, setCardLayout, useCardLayout, type CardLayout } from "@/lib/card-layout";

const LABELS: Record<CardLayout, { title: string; hint: string }> = {
  classic: { title: "Classic", hint: "Full-bleed image, text on top" },
  profile: { title: "Profile", hint: "Photo tile with details below" },
};

/* Miniature, non-interactive sketches of each card design */
function ClassicPreview() {
  return (
    <div className="relative aspect-[3/4.4] w-full overflow-hidden rounded-[12px] bg-gradient-to-br from-[#0A84FF] via-[#5E5CE6] to-[#1C1C1E]">
      <div className="absolute inset-x-0 bottom-0 h-[65%] bg-gradient-to-t from-black via-black/80 to-transparent" />
      <div className="absolute left-1.5 top-1.5 h-2 w-6 rounded-full bg-black/40" />
      <div className="absolute inset-x-2 bottom-2 space-y-1">
        <div className="h-1.5 w-10 rounded-full bg-white/50" />
        <div className="h-2 w-full rounded-full bg-white" />
        <div className="h-2 w-2/3 rounded-full bg-white" />
        <div className="mt-1.5 h-[2px] w-full rounded-full bg-white/30" />
      </div>
    </div>
  );
}

function ProfilePreview() {
  return (
    <div className="w-full rounded-[12px] bg-[#1C1C1E] p-1">
      <div className="relative aspect-[1/1.08] w-full overflow-hidden rounded-[9px] bg-gradient-to-br from-[#FF9F0A] via-[#FF375F] to-[#1C1C1E]">
        <div className="absolute bottom-1 left-1 h-1.5 w-8 rounded-full bg-white/70" />
      </div>
      <div className="space-y-1 px-0.5 pt-1.5">
        <div className="h-2 w-4/5 rounded-full bg-white" />
        <div className="h-1.5 w-1/2 rounded-full bg-white/40" />
      </div>
      <div className="mt-1.5 flex gap-1">
        <div className="h-3.5 flex-1 rounded-[5px] bg-white/15" />
        <div className="h-3.5 w-3.5 rounded-[5px] bg-white/15" />
      </div>
    </div>
  );
}

export function CardLayoutPicker() {
  const current = useCardLayout();
  const tap = useHaptic("light");

  return (
    <div role="radiogroup" aria-label="Feed card layout" className="grid grid-cols-2 gap-3">
      {CARD_LAYOUTS.map((layout) => {
        const selected = layout === current;
        return (
          <button
            key={layout}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => {
              tap();
              setCardLayout(layout);
            }}
            className={cn(
              "flex flex-col gap-3 rounded-[20px] border-2 p-3 text-left transition-colors",
              selected
                ? "border-[#0A84FF] bg-[#0A84FF]/[0.06]"
                : "border-neutral-200 hover:border-neutral-300 dark:border-neutral-800 dark:hover:border-neutral-700",
            )}
          >
            <div className="mx-auto w-[72%]">{layout === "classic" ? <ClassicPreview /> : <ProfilePreview />}</div>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[15px] font-semibold">{LABELS[layout].title}</p>
                <p className="text-[12px] leading-snug text-neutral-500">{LABELS[layout].hint}</p>
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
