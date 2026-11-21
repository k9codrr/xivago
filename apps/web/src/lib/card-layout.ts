"use client";

import { useSyncExternalStore } from "react";

/**
 * Which design the feed's demand cards use. Saved per device in localStorage;
 * every mounted card re-renders when it changes, including in other tabs.
 */
export type CardLayout = "classic" | "profile";

export const CARD_LAYOUTS: CardLayout[] = ["classic", "profile"];

const STORAGE_KEY = "xivago:card-layout";
const CHANGE_EVENT = "xivago:card-layout-change";
const DEFAULT_LAYOUT: CardLayout = "classic";

function read(): CardLayout {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "profile" || value === "classic" ? value : DEFAULT_LAYOUT;
  } catch {
    return DEFAULT_LAYOUT;
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

export function setCardLayout(layout: CardLayout) {
  try {
    window.localStorage.setItem(STORAGE_KEY, layout);
  } catch {
    // Storage blocked (private mode): the choice just won't persist.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useCardLayout(): CardLayout {
  return useSyncExternalStore(subscribe, read, () => DEFAULT_LAYOUT);
}
