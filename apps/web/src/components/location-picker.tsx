"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Building2, ChevronRight, Clock, Crosshair, Loader2, MapPin, Navigation, Search, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useGeolocation } from "@/lib/use-geolocation";

export interface PickedLocation {
  name: string;
  /** Second line: area, city, state. */
  secondary?: string;
  lat: number;
  lng: number;
}

interface Place {
  id: string;
  name: string;
  secondary: string;
  full: string;
  lat: number;
  lng: number;
  kind: string;
}

const RECENTS_KEY = "xivago:recent-places";

function readRecents(): PickedLocation[] {
  try {
    return JSON.parse(localStorage.getItem(RECENTS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function pushRecent(p: PickedLocation) {
  try {
    const next = [p, ...readRecents().filter((r) => r.name !== p.name || r.secondary !== p.secondary)].slice(0, 6);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

/** Bold the part of `text` the user typed. */
function Highlight({ text, query }: { text: string; query: string }) {
  const i = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <span className="font-semibold text-white">{text.slice(i, i + query.length)}</span>
      {text.slice(i + query.length)}
    </>
  );
}

/**
 * Location field for the post drawer (Instagram / Swiggy / Amazon style):
 * tap → full-screen search with live suggestions as you type, "Use current
 * location" (no prompt if allowed before), and recent places. Picking one
 * sets it; the chip shows it with an ✕ to clear.
 */
export function LocationPicker({
  value,
  onChange,
  className,
}: {
  value: PickedLocation | null;
  onChange: (v: PickedLocation | null) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <motion.button
        type="button"
        layout
        onClick={() => setOpen(true)}
        className={cn(
          "flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-colors",
          value ? "border-white/20 bg-white/[0.10]" : "border-white/5 bg-white/[0.06] hover:bg-white/10",
          className,
        )}
      >
        <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full", value ? "bg-[#FF453A] text-white" : "bg-white/[0.08] text-neutral-400")}>
          <MapPin className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold text-white">{value ? value.name : "Add location"}</span>
          <span className="block truncate text-[12.5px] text-neutral-400">
            {value ? (value.secondary ?? "Location set") : "Helps people nearby find your post"}
          </span>
        </span>
        {value ? (
          <span
            role="button"
            tabIndex={0}
            aria-label="Remove location"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white/70"
          >
            <X className="h-4 w-4" />
          </span>
        ) : (
          <ChevronRight className="h-4 w-4 text-neutral-500" />
        )}
      </motion.button>

      <LocationSearch
        open={open}
        onClose={() => setOpen(false)}
        onPick={(p) => {
          pushRecent(p);
          onChange(p);
          setOpen(false);
        }}
      />
    </>
  );
}

function LocationSearch({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (p: PickedLocation) => void }) {
  const [mounted, setMounted] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Place[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [recents, setRecents] = useState<PickedLocation[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const { lat, lng, requestLocation } = useGeolocation();
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setResults(null);
    setRecents(readRecents());
    const t = setTimeout(() => inputRef.current?.focus(), 280);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open, onClose]);

  // Type-ahead (debounced; newest request wins).
  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const bias = lat != null && lng != null ? `&lat=${lat}&lng=${lng}` : "";
        const res = await fetch(`/api/places?q=${encodeURIComponent(query)}${bias}`, { signal: ctrl.signal });
        const j = res.ok ? await res.json() : { places: [] };
        setResults(j.places);
      } catch {
        if (!ctrl.signal.aborted) setResults([]);
      } finally {
        if (!ctrl.signal.aborted) setSearching(false);
      }
    }, 220);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [q, lat, lng]);

  async function pickCurrentLocation() {
    setLocating(true);
    try {
      const coords = await requestLocation();
      if (!coords) {
        toast.error("Couldn't get your location. Search for a place instead.");
        return;
      }
      let name = "Current location";
      let secondary: string | undefined;
      try {
        const r = await fetch(`/api/places?reverse=1&lat=${coords.lat}&lng=${coords.lng}`);
        const j = r.ok ? await r.json() : { places: [] };
        const p: Place | undefined = j.places?.[0];
        if (p) {
          name = p.name;
          secondary = p.secondary;
        }
      } catch {
        // keep the generic label
      }
      onPick({ name, secondary, lat: coords.lat, lng: coords.lng });
    } finally {
      setLocating(false);
    }
  }

  if (!mounted) return null;

  return <>{createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="loc"
          role="dialog"
          aria-modal="true"
          aria-label="Choose location"
          data-sheet-no-drag
          className="fixed inset-0 z-[80] flex flex-col bg-[#0b0b0c] text-white"
          initial={{ y: "100%", opacity: 0.6 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0.6 }}
          transition={{ type: "spring", stiffness: 380, damping: 40 }}
        >
          <div className="flex shrink-0 items-center gap-2 px-3 pb-2 pt-[max(env(safe-area-inset-top),0.75rem)]">
            <div className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-2xl bg-white/[0.08] px-3.5 ring-1 ring-white/10 focus-within:ring-[#0A84FF]">
              <Search className="h-[18px] w-[18px] shrink-0 text-white/50" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search area, street, city…"
                autoComplete="off"
                inputMode="search"
                className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-white/35"
              />
              {searching ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-white/50" />
              ) : (
                q && (
                  <button type="button" onClick={() => setQ("")} aria-label="Clear" className="text-white/50">
                    <X className="h-4 w-4" />
                  </button>
                )
              )}
            </div>
            <button type="button" onClick={onClose} className="h-12 px-2 text-[15px] text-white/80 active:opacity-60">
              Cancel
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[max(env(safe-area-inset-bottom),24px)]">
            <button type="button" onClick={() => void pickCurrentLocation()} className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-white/5">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-[#0A84FF]/15 text-[#64A8FF]">
                {locating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Crosshair className="h-5 w-5" />}
              </span>
              <span>
                <span className="block text-[15px] font-semibold text-[#64A8FF]">Use current location</span>
                <span className="block text-[12.5px] text-white/45">Using GPS</span>
              </span>
            </button>
            <div className="mx-4 h-px bg-white/[0.06]" />

            {results === null && recents.length > 0 && (
              <>
                <p className="px-4 pb-1 pt-4 text-[12px] font-semibold uppercase tracking-wider text-white/40">Recent</p>
                {recents.map((r, i) => (
                  <Row key={`${r.name}-${i}`} icon={Clock} title={r.name} subtitle={r.secondary} onClick={() => onPick(r)} index={i} />
                ))}
              </>
            )}

            {results !== null && results.length === 0 && !searching && (
              <div className="flex flex-col items-center px-8 py-14 text-center">
                <MapPin className="h-8 w-8 text-white/25" />
                <p className="mt-3 text-[15px] font-medium">No places found</p>
                <p className="mt-1 text-[13px] text-white/45">Try a nearby landmark, area or city.</p>
              </div>
            )}

            {results && results.length > 0 && (
              <ul className="pt-1">
                {results.map((p, i) => (
                  <li key={p.id}>
                    <Row
                      icon={/city|town|state|county|country|district|locality|suburb/.test(p.kind) ? Navigation : p.kind === "house" || p.kind === "street" ? MapPin : Building2}
                      title={<Highlight text={p.name} query={q.trim()} />}
                      subtitle={p.secondary}
                      index={i}
                      onClick={() => onPick({ name: p.name, secondary: p.secondary, lat: p.lat, lng: p.lng })}
                    />
                  </li>
                ))}
              </ul>
            )}
            {results && results.length > 0 && <p className="px-4 pt-4 text-center text-[11px] text-white/25">Map data © OpenStreetMap contributors</p>}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )}</>;
}

function Row({
  icon: Icon,
  title,
  subtitle,
  onClick,
  index,
}: {
  icon: typeof MapPin;
  title: React.ReactNode;
  subtitle?: string;
  onClick: () => void;
  index: number;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.025 }}
      className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-white/5"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[0.07] text-white/70">
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0 flex-1 border-b border-white/[0.05] pb-3 pt-0.5">
        <span className="block truncate text-[15px] text-white/85">{title}</span>
        {subtitle && <span className="block truncate text-[12.5px] text-white/45">{subtitle}</span>}
      </span>
    </motion.button>
  );
}
