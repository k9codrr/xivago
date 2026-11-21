"use client";

import { useEffect } from "react";

/**
 * Inside the Capacitor app on iOS, hides the bar above the keyboard (the ✓ /
 * Done button with the up/down arrows). Does nothing in a normal browser:
 * Safari doesn't let a web page remove that bar.
 */
export function NativeKeyboard() {
  useEffect(() => {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string } }).Capacitor;
    if (!cap?.isNativePlatform?.() || cap.getPlatform?.() !== "ios") return;
    import("@capacitor/keyboard")
      .then(({ Keyboard }) => Keyboard.setAccessoryBarVisible({ isVisible: false }))
      .catch(() => {}); // plugin missing from an older native build: keep the default bar
  }, []);
  return null;
}
