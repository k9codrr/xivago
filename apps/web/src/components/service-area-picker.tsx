"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Crosshair, Globe2, Loader2, MapPinned, Monitor, Plus, Search, Wifi, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import { LocationPicker, type PickedLocation } from "@/components/location-picker";
import {
  AREA_KIND_LABEL,
  INDIA_STATES,
  MAX_SERVICE_AREAS,
  SERVICE_AREA_TYPE_INFO,
  SERVICE_RADIUS_CHOICES,
  type ServiceArea,
  type ServiceAreaType,
} from "@/lib/service-area";

export interface ServiceAreaValue {
  type: ServiceAreaType | null;
  areas: ServiceArea[];
  radiusKm: number;
  online: boolean;
}

interface RegionHit {
  id: string;
  name: string;
  secondary: string;
  lat: number;
  lng: number;
  areaKind?: "STATE" | "DISTRICT" | "CITY";
  state?: string;
}

const TYPE_ICON: Record<ServiceAreaType, typeof Globe2> = {
  NEARBY: Crosshair,
  REGIONS: MapPinned,
  ALL_INDIA: Globe2,
  ONLINE: Monitor,
};

const sameArea = (a: ServiceArea, b: ServiceArea) =>
  a.kind === b.kind && a.name.toLowerCase() === b.name.toLowerCase() && (a.state ?? "") === (b.state ?? "");

/**
 * "Where do you offer this?" for the offer flow: near me (with a distance),
 * hand-picked states / districts / cities, all over India, or online only.
 */
export function ServiceAreaPicker({
  value,
  onChange,
  place,
  onPlaceChange,
}: {
  value: ServiceAreaValue;
  onChange: (v: ServiceAreaValue) => void;
  place: PickedLocation | null;
  onPlaceChange: (p: PickedLocation | null) => void;
}) {
  const set = (patch: Partial<ServiceAreaValue>) => onChange({ ...value, ...patch });

  function toggleArea(area: ServiceArea) {
    const exists = value.areas.some((a) => sameArea(a, area));
    if (!exists && value.areas.length >= MAX_SERVICE_AREAS) {
      void haptic("error");
      return;
    }
    void haptic("selection");
    set({ areas: exists ? value.areas.filter((a) => !sameArea(a, area)) : [...value.areas, area] });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(SERVICE_AREA_TYPE_INFO) as ServiceAreaType[]).map((type) => {
          const Icon = TYPE_ICON[type];
          const active = value.type === type;
          return (
            <motion.button
              key={type}
              type="button"
              whileTap={{ scale: 0.97 }}
              aria-pressed={active}
              onClick={() => {
                void haptic("medium");
                set({ type });
              }}
              className={cn(
                "relative flex flex-col items-start gap-2 rounded-2xl border p-3.5 text-left transition-colors",
                active ? "border-white/40 bg-white/[0.14]" : "border-white/5 bg-white/[0.06] hover:bg-white/10",
              )}
            >
              <span
                className={cn(
                  "grid h-9 w-9 place-items-center rounded-full",
                  active ? "bg-white text-black" : "bg-white/[0.08] text-neutral-400",
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-neutral-100">{SERVICE_AREA_TYPE_INFO[type].label}</span>
                <span className="mt-0.5 block text-[11.5px] leading-4 text-neutral-500">{SERVICE_AREA_TYPE_INFO[type].hint}</span>
              </span>
              {active && (
                <span className="absolute right-2.5 top-2.5 grid h-5 w-5 place-items-center rounded-full bg-emerald-400 text-black">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
              )}
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {value.type === "NEARBY" && (
          <Section key="nearby">
            <LocationPicker value={place} onChange={onPlaceChange} />
            <div>
              <p className="mb-2 text-xs font-semibold text-neutral-300">How far do you travel?</p>
              <div className="flex flex-wrap gap-2">
                {SERVICE_RADIUS_CHOICES.map((km) => (
                  <Chip key={km} active={value.radiusKm === km} onClick={() => set({ radiusKm: km })}>
                    {km} km
                  </Chip>
                ))}
              </div>
              {!place && (
                <p className="mt-2 text-[11.5px] text-neutral-500">No place set — we&apos;ll use your current location.</p>
              )}
            </div>
            <OnlineToggle on={value.online} onToggle={() => set({ online: !value.online })} />
          </Section>
        )}

        {value.type === "REGIONS" && (
          <Section key="regions">
            {value.areas.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold text-neutral-300">
                  You cover <span className="text-neutral-500">({value.areas.length}/{MAX_SERVICE_AREAS})</span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <AnimatePresence initial={false}>
                    {value.areas.map((a) => (
                      <motion.button
                        key={`${a.kind}-${a.name}-${a.state ?? ""}`}
                        type="button"
                        layout
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        onClick={() => toggleArea(a)}
                        className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-black"
                      >
                        <span className="text-[10px] font-bold uppercase text-black/45">{AREA_KIND_LABEL[a.kind]}</span>
                        {a.name}
                        <X className="h-3 w-3" />
                      </motion.button>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}

            <RegionSearch onPick={toggleArea} picked={value.areas} />

            <div>
              <p className="mb-2 text-xs font-semibold text-neutral-300">Or tap whole states</p>
              <div className="-mx-1 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto px-1 pb-1">
                {INDIA_STATES.map((name) => {
                  const area: ServiceArea = { kind: "STATE", name };
                  return (
                    <Chip key={name} small active={value.areas.some((a) => sameArea(a, area))} onClick={() => toggleArea(area)}>
                      {name}
                    </Chip>
                  );
                })}
              </div>
            </div>
            <OnlineToggle on={value.online} onToggle={() => set({ online: !value.online })} />
          </Section>
        )}

        {value.type === "ALL_INDIA" && (
          <Section key="india">
            <Note>Your offer shows to people anywhere in India, whatever distance filter they use.</Note>
          </Section>
        )}

        {value.type === "ONLINE" && (
          <Section key="online">
            <Note>Your offer shows everywhere, marked Online. Great for calls, consultations and remote work.</Note>
          </Section>
        )}
      </AnimatePresence>
    </div>
  );
}

function RegionSearch({ onPick, picked }: { onPick: (a: ServiceArea) => void; picked: ServiceArea[] }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<RegionHit[] | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setHits(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places?scope=region&q=${encodeURIComponent(query)}`, { signal: ctrl.signal });
        const j = res.ok ? await res.json() : { places: [] };
        setHits(j.places ?? []);
      } catch {
        if (!ctrl.signal.aborted) setHits([]);
      } finally {
        if (!ctrl.signal.aborted) setSearching(false);
      }
    }, 250);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [q]);

  return (
    <div className="space-y-1.5">
      <div className="flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 focus-within:ring-2 focus-within:ring-white/30">
        <Search className="h-4 w-4 shrink-0 text-neutral-500" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search a city, district or state"
          autoComplete="off"
          inputMode="search"
          className="min-w-0 flex-1 bg-transparent text-[15px] text-neutral-100 outline-none placeholder:text-neutral-600"
        />
        {searching && <Loader2 className="h-4 w-4 animate-spin text-neutral-500" />}
      </div>
      {hits && hits.length === 0 && !searching && (
        <p className="px-1 text-xs text-neutral-500">No Indian city, district or state found. Try another spelling.</p>
      )}
      {hits && hits.length > 0 && (
        <ul className="overflow-hidden rounded-xl border border-white/5 bg-white/[0.04]">
          {hits.map((h) => {
            const area: ServiceArea = {
              kind: h.areaKind ?? "CITY",
              name: h.name,
              state: h.state ?? null,
              lat: h.lat,
              lng: h.lng,
            };
            const on = picked.some((a) => sameArea(a, area));
            return (
              <li key={h.id}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(area);
                    setQ("");
                  }}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-white/5"
                >
                  <span className="rounded-md bg-white/[0.08] px-1.5 py-0.5 text-[10px] font-bold uppercase text-neutral-400">
                    {AREA_KIND_LABEL[area.kind]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-neutral-100">{h.name}</span>
                    {h.secondary && <span className="block truncate text-[11.5px] text-neutral-500">{h.secondary}</span>}
                  </span>
                  {on ? <Check className="h-4 w-4 text-emerald-400" /> : <Plus className="h-4 w-4 text-neutral-500" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.18 }}
      className="space-y-4 rounded-2xl border border-white/5 bg-white/[0.03] p-3.5"
    >
      {children}
    </motion.div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="text-xs leading-5 text-neutral-400">{children}</p>;
}

function Chip({
  active,
  onClick,
  children,
  small,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  small?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => {
        void haptic("selection");
        onClick();
      }}
      className={cn(
        "rounded-xl border font-semibold transition-colors",
        small ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm",
        active ? "border-white bg-white text-black" : "border-white/10 bg-white/[0.06] text-neutral-300 hover:bg-white/10",
      )}
    >
      {children}
    </button>
  );
}

function OnlineToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => {
        void haptic("light");
        onToggle();
      }}
      className="flex w-full items-center gap-3 text-left"
    >
      <span className={cn("grid h-8 w-8 place-items-center rounded-full", on ? "bg-white text-black" : "bg-white/[0.08] text-neutral-500")}>
        <Wifi className="h-4 w-4" />
      </span>
      <span className="flex-1">
        <span className="block text-sm font-semibold text-neutral-100">Also available online</span>
        <span className="block text-[11.5px] text-neutral-500">Calls, chat or remote work too</span>
      </span>
      <span className={cn("relative h-6 w-10 rounded-full transition-colors", on ? "bg-emerald-400" : "bg-white/15")}>
        <motion.span
          layout
          className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow"
          style={{ left: on ? 18 : 2 }}
        />
      </span>
    </button>
  );
}
