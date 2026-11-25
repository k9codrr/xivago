"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { MapPin, ChevronDown, ChevronLeft, Crosshair, Loader2, Check, Search, X } from "lucide-react";
import { useGeolocation } from "@/lib/use-geolocation";
import { useUserLocation, setUserLocation } from "@/lib/user-location";
import { getRememberedPermission } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { PickedLocation } from "@/components/location-picker";

const POPULAR_CITIES: Array<{ name: string; slug: string; secondary: string; lat: number; lng: number }> = [
  { name: "Delhi NCR", slug: "delhi-ncr", secondary: "National Capital Region", lat: 28.6139, lng: 77.209 },
  { name: "Bangalore", slug: "bangalore", secondary: "Karnataka", lat: 12.9716, lng: 77.5946 },
  { name: "Mumbai", slug: "mumbai", secondary: "Maharashtra", lat: 19.076, lng: 72.8777 },
  { name: "Hyderabad", slug: "hyderabad", secondary: "Telangana", lat: 17.385, lng: 78.4867 },
  { name: "Ahmedabad", slug: "ahmedabad", secondary: "Gujarat", lat: 23.0225, lng: 72.5714 },
  { name: "Chennai", slug: "chennai", secondary: "Tamil Nadu", lat: 13.0827, lng: 80.2707 },
  { name: "Pune", slug: "pune", secondary: "Maharashtra", lat: 18.5204, lng: 73.8567 },
  { name: "New Delhi", slug: "new-delhi", secondary: "Delhi", lat: 28.6139, lng: 77.209 },
  { name: "Gurgaon", slug: "gurgaon", secondary: "Haryana", lat: 28.4595, lng: 77.0266 },
  { name: "Noida", slug: "noida", secondary: "Uttar Pradesh", lat: 28.5355, lng: 77.391 },
  { name: "Ghaziabad", slug: "ghaziabad", secondary: "Uttar Pradesh", lat: 28.6692, lng: 77.4538 },
  { name: "Lucknow", slug: "lucknow", secondary: "Uttar Pradesh", lat: 26.8467, lng: 80.9462 },
  { name: "Jaipur", slug: "jaipur", secondary: "Rajasthan", lat: 26.9124, lng: 75.7873 },
  { name: "Kolkata", slug: "kolkata", secondary: "West Bengal", lat: 22.5726, lng: 88.3639 },
  { name: "Kochi", slug: "kochi", secondary: "Kerala", lat: 9.9312, lng: 76.2673 },
  { name: "Nashik", slug: "nashik", secondary: "Maharashtra", lat: 19.9975, lng: 73.7898 },
  { name: "Nagpur", slug: "nagpur", secondary: "Maharashtra", lat: 21.1458, lng: 79.0882 },
  { name: "Coimbatore", slug: "coimbatore", secondary: "Tamil Nadu", lat: 11.0168, lng: 76.9558 },
];

/**
 * Replaces "What do you need?" above the home hero with the user's location.
 * - Prompts once for location permission if not yet answered (and remembers
 *   both allow and reject so it never nags on refresh or errors when unset).
 * - Tapping opens the full-screen city & GPS picker matching the reference UI.
 */
export function LocationHeader({ greeting }: { greeting: string }) {
  const geo = useGeolocation();
  const savedLocation = useUserLocation();
  const [pickerOpen, setPickerOpen] = useState(false);
  const promptedRef = useRef(false);

  // Auto-resolve city name when GPS fix arrives and user hasn't picked one yet
  useEffect(() => {
    if (savedLocation || !geo.lat || !geo.lng) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/places?reverse=1&lat=${geo.lat}&lng=${geo.lng}`);
        const j = r.ok ? await r.json() : { places: [] };
        const p = j.places?.[0];
        if (!cancelled && p) {
          setUserLocation({
            name: p.name,
            secondary: p.secondary,
            lat: geo.lat!,
            lng: geo.lng!,
          });
        }
      } catch {
        // Silently ignore reverse geocode errors
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [geo.lat, geo.lng, savedLocation]);

  // Ask location permission at most once if never answered before
  useEffect(() => {
    if (promptedRef.current) return;
    promptedRef.current = true;
    const perm = getRememberedPermission("location");
    if (perm !== "unknown" || savedLocation) return;
    void geo.requestLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePicked = useCallback((loc: PickedLocation) => {
    setUserLocation({
      name: loc.name,
      secondary: loc.secondary,
      lat: loc.lat,
      lng: loc.lng,
    });
    setPickerOpen(false);
  }, []);

  const displayName = savedLocation?.name ?? (geo.lat ? "Current location" : "Set your location");

  return (
    <div className="mt-3 px-1 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[#EBEBF5]/55">{greeting}</p> */}
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className=" flex items-center gap-2 text-left active:opacity-70"
      >
        <MapPin className="h-5 w-5 shrink-0 text-[#0A84FF]" />
        <span className="truncate text-[28px] font-bold leading-[1.1] tracking-[-0.025em] text-white">
          {displayName}
        </span>
        <ChevronDown className="h-5 w-5 shrink-0 text-white/50" />
      </button>
      {savedLocation?.secondary && (
        <p className=" pl-7 text-[13px] text-[#EBEBF5]/45">{savedLocation.secondary}</p>
      )}

      <CityPickerModal
        open={pickerOpen}
        selectedName={savedLocation?.name}
        onClose={() => setPickerOpen(false)}
        onPick={handlePicked}
      />
    </div>
  );
}

function CityPickerModal({
  open,
  selectedName,
  onClose,
  onPick,
}: {
  open: boolean;
  selectedName?: string;
  onClose: () => void;
  onPick: (loc: PickedLocation) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Array<{ id: string; name: string; secondary: string; lat: number; lng: number }> | null>(null);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const { lat, lng, requestLocation } = useGeolocation();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) {
      setQ("");
      setResults(null);
    }
  }, [open]);

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
      if (!coords) return; // Don't show error if user rejected
      let name = "Current location";
      let secondary: string | undefined;
      try {
        const r = await fetch(`/api/places?reverse=1&lat=${coords.lat}&lng=${coords.lng}`);
        const j = r.ok ? await r.json() : { places: [] };
        const p = j.places?.[0];
        if (p) {
          name = p.name;
          secondary = p.secondary;
        }
      } catch {
        // Keep generic label
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
          role="dialog"
          aria-modal="true"
          aria-label="Select your city"
          initial={{ y: "100%", opacity: 0.7 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0.7 }}
          transition={{ type: "spring", stiffness: 380, damping: 40 }}
          className="fixed inset-0 z-[80] mx-auto flex max-w-md flex-col bg-[#0b0b0c] text-white"
          style={{ paddingTop: "max(env(safe-area-inset-top), 0.75rem)" }}
        >
          {/* Top search header */}
          <div className="flex shrink-0 items-center gap-2 px-3 pb-3">
            <button
              type="button"
              onClick={onClose}
              aria-label="Back"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/90 active:bg-white/10"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3.5 focus-within:border-[#4F46E5]">
              <Search className="h-4 w-4 shrink-0 text-white/40" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search your city"
                autoComplete="off"
                inputMode="search"
                className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-white/45"
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
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(env(safe-area-inset-bottom),24px)]">
            {results === null ? (
              <>
                {/* Subtle street-map backdrop + centered pin */}
                <div className="relative mb-5 overflow-hidden rounded-2xl bg-[#131316] pt-5 pb-4 text-center">
                  <svg
                    aria-hidden
                    viewBox="0 0 360 170"
                    className="pointer-events-none absolute inset-0 h-full w-full opacity-25"
                    fill="none"
                  >
                    <path d="M-20 40 L150 -10 L380 120" stroke="#ffffff" strokeWidth="10" strokeOpacity="0.18" />
                    <path d="M40 180 L190 10 L260 180" stroke="#ffffff" strokeWidth="8" strokeOpacity="0.14" />
                    <path d="M-10 120 L380 50" stroke="#ffffff" strokeWidth="6" strokeOpacity="0.12" />
                    <path d="M90 -10 L130 180" stroke="#ffffff" strokeWidth="5" strokeOpacity="0.1" />
                  </svg>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#131316] to-transparent" />

                  <div className="relative mx-auto mb-3 flex h-14 w-14 items-center justify-center">
                    <span className="absolute bottom-0 h-3 w-9 rounded-full bg-[#FF6B00]/35 blur-[2px]" />
                    <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-[#FF6B00] shadow-lg shadow-[#FF6B00]/40">
                      <MapPin className="h-5 w-5 text-white" />
                    </span>
                  </div>

                  <h2 className="relative px-6 text-[19px] font-bold leading-[1.25] tracking-[-0.015em] text-white">
                    Find what you need right around the corner
                  </h2>
                  <p className="relative mx-auto mt-1.5 max-w-[270px] text-[12.5px] leading-relaxed text-white/55">
                    For best experience, click <span className="font-semibold text-white/80">&apos;always allow location&apos;</span> on your device. Your data is safe with us.
                  </p>
                </div>

                {/* Primary CTA */}
                <button
                  type="button"
                  onClick={() => void pickCurrentLocation()}
                  disabled={locating}
                  className="mb-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#4F46E5] text-[15px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
                >
                  {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
                  Use your current location
                </button>

                {/* Popular Cities 3-column grid with authentic landmark photos */}
                <p className="mb-3 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-white/50">
                  Popular Cities
                </p>
                <div className="grid grid-cols-3 gap-x-3 gap-y-4">
                  {POPULAR_CITIES.map((city) => {
                    const isSelected = selectedName === city.name;
                    return (
                      <button
                        key={city.name}
                        type="button"
                        onClick={() =>
                          onPick({
                            name: city.name,
                            secondary: city.secondary,
                            lat: city.lat,
                            lng: city.lng,
                          })
                        }
                        className="group flex flex-col items-center text-center transition-transform active:scale-95"
                      >
                        <div className="relative aspect-[1.45/1] w-full overflow-hidden rounded-xl bg-neutral-900">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`/cities/${city.slug}.jpg`}
                            alt={city.name}
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                          {isSelected && (
                            <span className="absolute inset-0 flex items-center justify-center bg-[#4F46E5]/55">
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-[#4F46E5] shadow">
                                <Check className="h-3.5 w-3.5" strokeWidth={3} />
                              </span>
                            </span>
                          )}
                        </div>
                        <span
                          className={cn(
                            "mt-1.5 text-[12px] font-medium leading-tight",
                            isSelected ? "text-[#818CF8]" : "text-white/90",
                          )}
                        >
                          {city.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : results.length === 0 && !searching ? (
              <div className="flex flex-col items-center px-8 py-14 text-center">
                <MapPin className="h-8 w-8 text-white/25" />
                <p className="mt-3 text-[15px] font-medium">No cities found</p>
                <p className="mt-1 text-[13px] text-white/45">Try another city or area name.</p>
              </div>
            ) : (
              <ul className="pt-1">
                {results.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => onPick({ name: p.name, secondary: p.secondary, lat: p.lat, lng: p.lng })}
                      className="flex w-full items-center gap-3 py-3 text-left active:bg-white/5"
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[0.07] text-white/70">
                        <MapPin className="h-[18px] w-[18px]" />
                      </span>
                      <span className="min-w-0 flex-1 border-b border-white/[0.05] pb-3 pt-0.5">
                        <span className="block truncate text-[15px] text-white/90">{p.name}</span>
                        {p.secondary && <span className="block truncate text-[12.5px] text-white/45">{p.secondary}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )}</>;
}
