"use client";

import { useSyncExternalStore } from "react";

/**
 * Which 3D icon set the Explore page cards use. Saved per device in
 * localStorage; the page re-renders when it changes, including in other tabs.
 *
 * - "color":     colourful 3D icons            (public/explore)
 * - "metal":     chrome / gold metallic icons  (public/explore/metal)
 * - "pinterest": Pinterest picks, bg removed   (public/explore/pinterest) — default
 */
export type ExploreIconSet = "color" | "metal" | "pinterest";

export const EXPLORE_ICON_SETS: ExploreIconSet[] = ["color", "metal", "pinterest"];

export const EXPLORE_ICON_BASE: Record<ExploreIconSet, string> = {
  color: "/explore",
  metal: "/explore/metal",
  pinterest: "/explore/pinterest",
};

/** Flip to true once public/explore/pinterest/*.png is filled in (same file names as the other sets). */
export const PINTEREST_ICONS_READY = true;

const STORAGE_KEY = "xivago:explore-icons";
const CHANGE_EVENT = "xivago:explore-icons-change";
const DEFAULT_SET: ExploreIconSet = "pinterest";

function read(): ExploreIconSet {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (value === "color" || value === "metal") return value;
    if (value === "pinterest" && PINTEREST_ICONS_READY) return value;
    return DEFAULT_SET;
  } catch {
    return DEFAULT_SET;
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

export function setExploreIcons(set: ExploreIconSet) {
  try {
    window.localStorage.setItem(STORAGE_KEY, set);
  } catch {
    // Storage blocked (private mode): the choice just won't persist.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useExploreIcons(): ExploreIconSet {
  return useSyncExternalStore(subscribe, read, () => DEFAULT_SET);
}
