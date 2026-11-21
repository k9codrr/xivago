"use client";

import { useSyncExternalStore } from "react";

/**
 * Which design the home page's featured hero uses. Saved per device in
 * localStorage; the hero re-renders when it changes, including in other tabs.
 */
export type HeroStyle = "classic" | "stack";

export const HERO_STYLES: HeroStyle[] = ["classic", "stack"];

const STORAGE_KEY = "xivago:hero-style";
const CHANGE_EVENT = "xivago:hero-style-change";
const DEFAULT_STYLE: HeroStyle = "classic";

function read(): HeroStyle {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "stack" || value === "classic" ? value : DEFAULT_STYLE;
  } catch {
    return DEFAULT_STYLE;
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

export function setHeroStyle(style: HeroStyle) {
  try {
    window.localStorage.setItem(STORAGE_KEY, style);
  } catch {
    // Storage blocked (private mode): the choice just won't persist.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useHeroStyle(): HeroStyle {
  return useSyncExternalStore(subscribe, read, () => DEFAULT_STYLE);
}
