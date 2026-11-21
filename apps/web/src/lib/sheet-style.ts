"use client";

import { useSyncExternalStore } from "react";

/**
 * Which look the post drawer uses. Saved per device in localStorage; the
 * drawer re-renders when it changes, including in other tabs.
 */
export type SheetStyle = "default" | "spotify" | "glass";

export const SHEET_STYLES: SheetStyle[] = ["default", "spotify", "glass"];

const STORAGE_KEY = "xivago:sheet-style";
const CHANGE_EVENT = "xivago:sheet-style-change";
const DEFAULT_STYLE: SheetStyle = "default";

function read(): SheetStyle {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return SHEET_STYLES.includes(value as SheetStyle) ? (value as SheetStyle) : DEFAULT_STYLE;
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

export function setSheetStyle(style: SheetStyle) {
  try {
    window.localStorage.setItem(STORAGE_KEY, style);
  } catch {
    // Storage blocked (private mode): the choice just won't persist.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useSheetStyle(): SheetStyle {
  return useSyncExternalStore(subscribe, read, () => DEFAULT_STYLE);
}
