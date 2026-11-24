"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHaptic } from "@/components/ui/haptic";
import {
  EXPLORE_ICON_BASE,
  EXPLORE_ICON_SETS,
  PINTEREST_ICONS_READY,
  type ExploreIconSet,
} from "@/lib/explore-icons";

export const EXPLORE_ICON_LABELS: Record<ExploreIconSet, { title: string; hint: string }> = {
  color: { title: "Colour 3D", hint: "Bright, playful icons" },
  metal: { title: "Metallic", hint: "Chrome & gold finish" },
  pinterest: { title: "Pinterest", hint: "Curated 3D picks" },
};

const PREVIEW_ICONS = ["fire", "groups", "gift", "rocket"];

/** Mini dark card with the set's real icons in a 2x2 grid. */
function Preview({ set, disabled }: { set: ExploreIconSet; disabled: boolean }) {
  return (
    <div className="relative grid aspect-square w-full grid-cols-2 place-items-center gap-1 rounded-[12px] bg-[#0b0b0d] p-2 ring-1 ring-white/[0.06]">
      {disabled ? (
        <span className="col-span-2 row-span-2 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
          Coming
          <br />
          soon
        </span>
      ) : (
        PREVIEW_ICONS.map((icon) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={icon} src={`${EXPLORE_ICON_BASE[set]}/${icon}.png`} alt="" className="h-full w-full object-contain" />
        ))
      )}
    </div>
  );
}

export function ExploreIconsPicker({ value: current, onChange }: { value: ExploreIconSet; onChange: (v: ExploreIconSet) => void }) {
  const tap = useHaptic("light");

  return (
    <div role="radiogroup" aria-label="Explore icon style" className="grid grid-cols-3 gap-2.5">
      {EXPLORE_ICON_SETS.map((set) => {
        const disabled = set === "pinterest" && !PINTEREST_ICONS_READY;
        const selected = set === current;
        return (
          <button
            key={set}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-disabled={disabled}
            disabled={disabled}
            onClick={() => {
              tap();
              onChange(set);
            }}
            className={cn(
              "flex flex-col gap-2.5 rounded-[18px] border-2 p-2.5 text-left transition-colors",
              selected
                ? "border-[#0A84FF] bg-[#0A84FF]/[0.06]"
                : "border-neutral-200 hover:border-neutral-300 dark:border-neutral-800 dark:hover:border-neutral-700",
              disabled && "cursor-not-allowed opacity-60 hover:border-neutral-200 dark:hover:border-neutral-800",
            )}
          >
            <Preview set={set} disabled={disabled} />
            <div className="flex items-start justify-between gap-1.5">
              <div className="min-w-0">
                <p className="truncate text-[13.5px] font-semibold">{EXPLORE_ICON_LABELS[set].title}</p>
                <p className="text-[11px] leading-snug text-neutral-500">{disabled ? "Coming soon" : EXPLORE_ICON_LABELS[set].hint}</p>
              </div>
              <span
                className={cn(
                  "mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2",
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
