"use client";

import { useSyncExternalStore } from "react";

/**
 * Which bottom navigation design the app uses. Saved per device in
 * localStorage; the nav re-renders when it changes, including in other tabs.
 *
 * - "glass":  floating liquid-glass bar, icons stay put (default)
 * - "modern": sliding centered track
 */
export type NavStyle = "glass" | "modern";

export const NAV_STYLES: NavStyle[] = ["glass", "modern"];

const STORAGE_KEY = "xivago:nav-style";
const CHANGE_EVENT = "xivago:nav-style-change";
const DEFAULT_STYLE: NavStyle = "glass";

function read(): NavStyle {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "glass" || value === "modern" ? value : DEFAULT_STYLE;
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

export function setNavStyle(style: NavStyle) {
  try {
    window.localStorage.setItem(STORAGE_KEY, style);
  } catch {
    // Storage blocked (private mode): the choice just won't persist.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useNavStyle(): NavStyle {
  return useSyncExternalStore(subscribe, read, () => DEFAULT_STYLE);
}
