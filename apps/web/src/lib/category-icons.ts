"use client";

import { useSyncExternalStore } from "react";

/**
 * How the home page category shelf draws its icons. Saved per device in
 * localStorage; every reader re-renders when it changes, including in other tabs.
 *
 * - style: one of four 3D metal finishes, or "lucide" (flat line icons in each
 *   category's own colour).
 * - picks: which of the 9 designs each category shows, by category id.
 *   Missing ids use design 0.
 */
export type CategoryIconStyle = "blue-gold" | "chrome-gold" | "white-blue-gold" | "black-gold" | "lucide";

export const CATEGORY_ICON_STYLES: CategoryIconStyle[] = [
  "blue-gold",
  "chrome-gold",
  "white-blue-gold",
  "black-gold",
  "lucide",
];

/** Every category has this many designs to choose from, in every style. */
export const CATEGORY_ICON_VARIANTS = 9;

export interface CategoryIconPrefs {
  style: CategoryIconStyle;
  picks: Record<string, number>;
}

const STORAGE_KEY = "xivago:category-icons";
const CHANGE_EVENT = "xivago:category-icons-change";
const DEFAULT_PREFS: CategoryIconPrefs = { style: "blue-gold", picks: {} };

function parse(raw: string | null): CategoryIconPrefs {
  if (!raw) return DEFAULT_PREFS;
  try {
    const value = JSON.parse(raw) as Partial<CategoryIconPrefs>;
    const style = CATEGORY_ICON_STYLES.includes(value.style as CategoryIconStyle)
      ? (value.style as CategoryIconStyle)
      : DEFAULT_PREFS.style;
    const picks: Record<string, number> = {};
    if (value.picks && typeof value.picks === "object") {
      for (const [id, n] of Object.entries(value.picks)) {
        if (Number.isInteger(n) && n >= 0 && n < CATEGORY_ICON_VARIANTS) picks[id] = n;
      }
    }
    return { style, picks };
  } catch {
    return DEFAULT_PREFS;
  }
}

// useSyncExternalStore needs the same object back while storage is unchanged.
let cachedRaw: string | null = null;
let cachedPrefs: CategoryIconPrefs = DEFAULT_PREFS;

function read(): CategoryIconPrefs {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return DEFAULT_PREFS;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedPrefs = parse(raw);
  }
  return cachedPrefs;
}

function write(prefs: CategoryIconPrefs) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage blocked (private mode): the choice just won't persist.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
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

export function setCategoryIconStyle(style: CategoryIconStyle) {
  write({ ...read(), style });
}

export function setCategoryIconPick(categoryId: string, variant: number) {
  const current = read();
  write({ ...current, picks: { ...current.picks, [categoryId]: variant } });
}

/** Replace the whole preference (style + every pick) in one write. */
export function setCategoryIcons(prefs: CategoryIconPrefs) {
  write({ style: prefs.style, picks: { ...prefs.picks } });
}

export function resetCategoryIconPicks() {
  write({ ...read(), picks: {} });
}

export function useCategoryIcons(): CategoryIconPrefs {
  return useSyncExternalStore(subscribe, read, () => DEFAULT_PREFS);
}
