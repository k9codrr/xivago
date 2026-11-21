"use client";

import { useEffect } from "react";
import { haptic } from "@/lib/haptics";

/**
 * Platform-wide tap haptics: every press on an interactive element gets the
 * same heavy haptic as the bottom nav, without wiring each component.
 *
 * Opt out on any element (or subtree) with `data-no-haptic`.
 */
const INTERACTIVE_SELECTOR = [
  "button",
  "a[href]",
  "summary",
  "label",
  "select",
  'input[type="checkbox"]',
  'input[type="radio"]',
  'input[type="submit"]',
  'input[type="button"]',
  '[role="button"]',
  '[role="tab"]',
  '[role="switch"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="menuitem"]',
  '[role="option"]',
].join(",");

export function GlobalHaptics() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      const el = target?.closest?.(INTERACTIVE_SELECTOR);
      if (!el) return;
      if (el.closest("[data-no-haptic]")) return;
      if (
        (el as HTMLButtonElement).disabled ||
        el.getAttribute("aria-disabled") === "true"
      ) {
        return;
      }
      void haptic("heavy");
    };

    // Capture phase so this runs before React handlers — component-level
    // tap haptics are then deduped and every tap feels identical.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
