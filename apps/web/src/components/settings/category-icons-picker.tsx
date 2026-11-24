"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHaptic } from "@/components/ui/haptic";
import {
  CATEGORY_ICON_STYLES,
  CATEGORY_ICON_VARIANTS,
  type CategoryIconPrefs,
  type CategoryIconStyle,
} from "@/lib/category-icons";
import { HOME_CATEGORIES } from "@/lib/home-categories";
import { CategoryIcon, categoryDesignLabel } from "@/components/category-icons/category-icon";

export const CATEGORY_ICON_STYLE_LABELS: Record<CategoryIconStyle, { title: string; hint: string }> = {
  "blue-gold": { title: "Blue & Gold", hint: "Navy with gold trim" },
  "chrome-gold": { title: "Chrome & Gold", hint: "Polished silver, gold" },
  "white-blue-gold": { title: "White, Blue & Gold", hint: "Porcelain with cobalt" },
  "black-gold": { title: "Black & Gold", hint: "Matte black, gold" },
  lucide: { title: "Default", hint: "Simple line icons in colour" },
};

/** Categories shown in each style card's 2x2 preview. */
const PREVIEW_CATEGORIES = ["14", "15", "25", "24"];
const VARIANTS = Array.from({ length: CATEGORY_ICON_VARIANTS }, (_, i) => i);

function StylePreview({ style }: { style: CategoryIconStyle }) {
  return (
    <div className="grid aspect-square w-full grid-cols-2 place-items-center gap-1 rounded-[12px] bg-[#0b0b0d] p-2 ring-1 ring-white/[0.06]">
      {PREVIEW_CATEGORIES.map((id) => (
        <CategoryIcon key={id} categoryId={id} style={style} className={style === "lucide" ? "h-[60%] w-[60%]" : "h-full w-full"} />
      ))}
    </div>
  );
}

export function CategoryIconsPicker({
  value,
  onChange,
}: {
  value: CategoryIconPrefs;
  onChange: (v: CategoryIconPrefs) => void;
}) {
  const { style, picks } = value;
  const tap = useHaptic("light");
  const hasCustomPicks = Object.values(picks).some((n) => n !== 0);

  return (
    <div className="space-y-6">
      <div role="radiogroup" aria-label="Category icon style" className="grid grid-cols-3 gap-2.5">
        {CATEGORY_ICON_STYLES.map((s) => {
          const selected = s === style;
          return (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => {
                tap();
                onChange({ ...value, style: s });
              }}
              className={cn(
                "flex flex-col gap-2.5 rounded-[18px] border-2 p-2.5 text-left transition-colors",
                selected
                  ? "border-[#0A84FF] bg-[#0A84FF]/[0.06]"
                  : "border-neutral-200 hover:border-neutral-300 dark:border-neutral-800 dark:hover:border-neutral-700",
              )}
            >
              <StylePreview style={s} />
              <div className="flex items-start justify-between gap-1.5">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold leading-tight">{CATEGORY_ICON_STYLE_LABELS[s].title}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">{CATEGORY_ICON_STYLE_LABELS[s].hint}</p>
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

      <div>
        <div className="mb-2 flex items-end justify-between px-1">
          <p className="text-[13px] text-neutral-500">Pick one of 9 designs for each category.</p>
          {hasCustomPicks && (
            <button
              type="button"
              onClick={() => {
                tap();
                onChange({ ...value, picks: {} });
              }}
              className="shrink-0 text-[13px] font-medium text-[#0A84FF]"
            >
              Reset all
            </button>
          )}
        </div>

        <div className="divide-y divide-neutral-200 overflow-hidden rounded-[18px] border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
          {HOME_CATEGORIES.map((cat) => {
            const current = picks[cat.id] ?? 0;
            return (
              <div key={cat.id} className="py-3">
                <div className="mb-2 flex items-baseline justify-between gap-2 px-3">
                  <p className="text-[14px] font-semibold">{cat.name}</p>
                  {style !== "lucide" && (
                    <p className="truncate text-[12px] text-neutral-500">{categoryDesignLabel(cat.id, current)}</p>
                  )}
                </div>
                <div
                  role="radiogroup"
                  aria-label={`${cat.name} icon`}
                  className="no-scrollbar flex gap-2 overflow-x-auto px-3 pb-1"
                >
                  {VARIANTS.map((v) => {
                    const selected = v === current;
                    const label = categoryDesignLabel(cat.id, v);
                    return (
                      <button
                        key={v}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-label={style === "lucide" ? `${cat.name} icon ${v + 1}` : label}
                        title={style === "lucide" ? undefined : label}
                        onClick={() => {
                          tap();
                          onChange({ ...value, picks: { ...picks, [cat.id]: v } });
                        }}
                        className={cn(
                          "flex h-[64px] w-[64px] shrink-0 items-center justify-center rounded-[16px] bg-[#0b0b0d] transition-all",
                          selected
                            ? "ring-[2.5px] ring-[#0A84FF] ring-offset-2 ring-offset-white dark:ring-offset-black"
                            : "opacity-80 ring-1 ring-white/[0.06] hover:opacity-100",
                        )}
                      >
                        <CategoryIcon
                          categoryId={cat.id}
                          style={style}
                          variant={v}
                          className={style === "lucide" ? "h-8 w-8" : "h-[54px] w-[54px]"}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
