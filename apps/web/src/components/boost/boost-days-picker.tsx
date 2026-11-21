"use client";

import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import {
  DEFAULT_BOOST_CONFIG,
  boostEndsAt,
  boostLimits,
  type BoostConfig,
  type BoostMode,
} from "@/lib/boost-shared";

let cached: BoostConfig | null = null;

/** Per-day boost pricing set by the admin. Starts from the defaults until loaded. */
export function useBoostSettings(enabled = true): { config: BoostConfig; loaded: boolean } {
  const [config, setConfig] = useState<BoostConfig>(cached ?? DEFAULT_BOOST_CONFIG);
  const [loaded, setLoaded] = useState(cached != null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetch("/api/boost-settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.settings) return;
        cached = data.settings as BoostConfig;
        setConfig(cached);
        setLoaded(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { config, loaded };
}

/**
 * "30 credits / day" day picker: stepper, quick chips and the running total.
 * Used in the post drawer and the feature / extend sheet.
 */
export function BoostDaysPicker({
  config,
  mode,
  days,
  onChange,
  currentEnd,
  className,
}: {
  config: BoostConfig;
  mode: BoostMode;
  days: number;
  onChange: (days: number) => void;
  /** End of a running boost: an extension adds to it. */
  currentEnd?: string | Date | null;
  className?: string;
}) {
  const { pricePerDay, minDays, maxDays } = boostLimits(config, mode);
  const chips = Array.from(new Set([minDays, 7, 14, maxDays])).filter((d) => d >= minDays && d <= maxDays).sort((a, b) => a - b);
  const set = (d: number) => {
    const next = Math.min(Math.max(d, minDays), maxDays);
    if (next !== days) void haptic("light");
    onChange(next);
  };
  const endsAt = boostEndsAt(days, currentEnd ?? null);

  return (
    <div className={cn("space-y-3 rounded-2xl border border-white/10 bg-white/[0.05] p-4", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
          {mode === "extend" ? "Extend by" : "Featured for"}
        </p>
        <p className="text-xs text-neutral-400">
          <span className="font-semibold text-amber-400">{pricePerDay} credits</span> / day
        </p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          aria-label="One day less"
          onClick={() => set(days - 1)}
          disabled={days <= minDays}
          className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.08] text-white transition active:scale-95 disabled:opacity-30"
        >
          <Minus className="h-4 w-4" />
        </button>
        <div className="text-center" aria-live="polite">
          <p className="text-2xl font-bold tabular-nums text-white">
            {days} <span className="text-base font-semibold text-neutral-400">day{days === 1 ? "" : "s"}</span>
          </p>
          <p className="text-[11px] text-neutral-500">
            Min {minDays} · Max {maxDays} days
          </p>
        </div>
        <button
          type="button"
          aria-label="One day more"
          onClick={() => set(days + 1)}
          disabled={days >= maxDays}
          className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.08] text-white transition active:scale-95 disabled:opacity-30"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {chips.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => set(d)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold transition",
              d === days ? "bg-white text-black" : "bg-white/[0.08] text-neutral-300 hover:bg-white/[0.14]",
            )}
          >
            {d} days
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-white/10 pt-3 text-xs">
        <span className="text-neutral-400">
          {pricePerDay} × {days} days
          <span className="block text-[11px] text-neutral-500">
            Until {endsAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
          </span>
        </span>
        <span className="text-sm font-bold text-amber-400">{(pricePerDay * days).toLocaleString("en-IN")} credits</span>
      </div>
    </div>
  );
}
