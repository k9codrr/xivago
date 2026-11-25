"use client";

import { useSyncExternalStore } from "react";

/**
 * Which look the demand detail drawer uses. Saved per device in localStorage.
 *
 * - "default": Current standard bottom sheet drawer
 * - "modern":  Pinterest-style drawer with image peeking 60-65% out,
 *              swipe up to full-screen with image inside gallery
 */
export type DrawerStyle = "default" | "modern";

export const DRAWER_STYLES: DrawerStyle[] = ["default", "modern"];

const STORAGE_KEY = "xivago:drawer-style";
const CHANGE_EVENT = "xivago:drawer-style-change";
const DEFAULT_STYLE: DrawerStyle = "default";

function read(): DrawerStyle {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return DRAWER_STYLES.includes(value as DrawerStyle) ? (value as DrawerStyle) : DEFAULT_STYLE;
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

export function setDrawerStyle(style: DrawerStyle) {
  try {
    window.localStorage.setItem(STORAGE_KEY, style);
  } catch {
    // Storage blocked (private mode): the choice just won't persist.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useDrawerStyle(): DrawerStyle {
  return useSyncExternalStore(subscribe, read, () => DEFAULT_STYLE);
}
