"use client";

import { useSyncExternalStore } from "react";

/**
 * Remembers the user's chosen location name (city / area) for the home page
 * header. This is separate from the geolocation coords: it stores the
 * human-readable place name the user selected, or what reverse geocoding
 * resolved to.
 */

const STORAGE_KEY = "xivago:user-location-name";
const CHANGE_EVENT = "xivago:user-location-name-change";

export interface SavedLocation {
  name: string;
  secondary?: string;
  lat: number;
  lng: number;
}

let cachedRaw: string | null | undefined;
let cachedValue: SavedLocation | null = null;

function read(): SavedLocation | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === cachedRaw) return cachedValue;
    cachedRaw = raw;
    if (!raw) {
      cachedValue = null;
      return null;
    }
    const parsed = JSON.parse(raw) as SavedLocation;
    cachedValue = typeof parsed.name === "string" && typeof parsed.lat === "number" ? parsed : null;
    return cachedValue;
  } catch {
    cachedRaw = undefined;
    cachedValue = null;
    return null;
  }
}

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => e.key === STORAGE_KEY && onChange();
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

export function setUserLocation(loc: SavedLocation | null) {
  try {
    if (loc) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Storage blocked
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useUserLocation(): SavedLocation | null {
  return useSyncExternalStore(subscribe, read, () => null);
}
