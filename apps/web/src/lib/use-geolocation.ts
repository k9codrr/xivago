"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { Geolocation } from "@capacitor/geolocation";
import { getRememberedPermission, rememberPermission } from "@/lib/permissions";

export interface GeoLocationState {
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  loading: boolean;
  error: string | null;
  isPermissionGranted: boolean;
}

/**
 * One location store shared by every component, persisted per device.
 *
 * Once the user has allowed location we remember it (localStorage, not
 * sessionStorage), reuse the last fix straight away and refresh it silently
 * in the background -- so no screen ever asks again or shows a spinner just
 * to learn where the user is. A denial is remembered too, so nothing nags;
 * an explicit tap on a "use my location" control still tries again.
 */

const STORAGE_KEY = "xivago:geo";
/** A fix younger than this is used as-is; older ones are shown while a fresh one loads. */
const FRESH_MS = 10 * 60 * 1000;

type Cached = { lat: number; lng: number; accuracy: number | null; at: number };

const EMPTY: GeoLocationState = {
  lat: null,
  lng: null,
  accuracy: null,
  loading: false,
  error: null,
  isPermissionGranted: false,
};

let state: GeoLocationState = EMPTY;
let hydrated = false;
let inflight: Promise<{ lat: number; lng: number } | null> | null = null;
const listeners = new Set<() => void>();

function readCache(): Cached | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Cached;
    return typeof parsed.lat === "number" && typeof parsed.lng === "number" ? parsed : null;
  } catch {
    return null;
  }
}

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  const cached = readCache();
  if (cached) {
    state = {
      ...EMPTY,
      lat: cached.lat,
      lng: cached.lng,
      accuracy: cached.accuracy,
      isPermissionGranted: getRememberedPermission("location") !== "denied",
    };
  }
}

function set(next: Partial<GeoLocationState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function snapshot() {
  hydrate();
  return state;
}

function save(lat: number, lng: number, accuracy: number | null) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ lat, lng, accuracy, at: Date.now() } satisfies Cached));
  } catch {
    // storage blocked: the fix just won't survive a reload
  }
  rememberPermission("location", "granted");
  set({ lat, lng, accuracy, loading: false, error: null, isPermissionGranted: true });
}

function fail(message: string, denied: boolean) {
  if (denied) rememberPermission("location", "denied");
  set({ loading: false, error: message, isPermissionGranted: !denied && state.isPermissionGranted });
}

function browserFix(): Promise<{ lat: number; lng: number } | null> {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
    fail("Location is not supported on this device/browser.", false);
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        save(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        const denied = err.code === err.PERMISSION_DENIED;
        fail(
          denied
            ? "Location permission was denied. Enable location in device settings."
            : err.code === err.TIMEOUT
              ? "Location request timed out. Please try again."
              : "Could not obtain location.",
          denied,
        );
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 5 * 60 * 1000 },
    );
  });
}

function isNative(): boolean {
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

async function fetchFix(silent: boolean): Promise<{ lat: number; lng: number } | null> {
  if (!silent) set({ loading: true, error: null });

  // Native shell: the OS keeps the grant; only prompt when it hasn't been answered.
  if (isNative()) {
    try {
      let perm = await Geolocation.checkPermissions();
      if (perm.location !== "granted" && perm.coarseLocation !== "granted") {
        if (silent) return null;
        perm = await Geolocation.requestPermissions({ permissions: ["location", "coarseLocation"] });
      }
      if (perm.location === "granted" || perm.coarseLocation === "granted") {
        const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 12000, maximumAge: 5 * 60 * 1000 });
        save(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
        return { lat: pos.coords.latitude, lng: pos.coords.longitude };
      }
      fail("Location permission was denied. Enable location in device settings.", true);
      return null;
    } catch {
      // fall through to the browser API
    }
  }

  // Browser: if the Permissions API says it was never granted, a silent refresh must not prompt.
  if (silent) {
    try {
      const status = await navigator.permissions?.query({ name: "geolocation" as PermissionName });
      if (status && status.state !== "granted") return null;
    } catch {
      // Permissions API missing (older Safari): rely on our remembered grant instead.
      if (getRememberedPermission("location") !== "granted") return null;
    }
  }
  return browserFix();
}

function request(opts: { silent?: boolean; force?: boolean } = {}): Promise<{ lat: number; lng: number } | null> {
  hydrate();
  const cached = readCache();
  if (!opts.force && cached && Date.now() - cached.at < FRESH_MS) {
    if (state.lat !== cached.lat) save(cached.lat, cached.lng, cached.accuracy);
    return Promise.resolve({ lat: cached.lat, lng: cached.lng });
  }
  // Have an older fix? Hand it back now and refresh behind the scenes.
  if (!opts.force && cached && !opts.silent) {
    void (inflight ??= fetchFix(true).finally(() => (inflight = null)));
    return Promise.resolve({ lat: cached.lat, lng: cached.lng });
  }
  inflight ??= fetchFix(Boolean(opts.silent)).finally(() => (inflight = null));
  return inflight;
}

/** Last known location without asking for anything (null if never allowed). */
export function getRememberedLocation(): { lat: number; lng: number } | null {
  const c = typeof window === "undefined" ? null : readCache();
  return c ? { lat: c.lat, lng: c.lng } : null;
}

export function useGeolocation() {
  const current = useSyncExternalStore(subscribe, snapshot, () => EMPTY);

  // Previously allowed → keep the fix fresh without a prompt.
  useEffect(() => {
    if (getRememberedPermission("location") === "granted") void request({ silent: true });
  }, []);

  const requestLocation = useCallback(() => request(), []);
  const refreshLocation = useCallback(() => request({ force: true }), []);

  const clearLocation = useCallback(() => {
    // Clears the fix in use on this screen; the remembered permission stays.
    set({ lat: null, lng: null, accuracy: null, loading: false, error: null });
  }, []);

  return { ...current, requestLocation, refreshLocation, clearLocation };
}
