"use client";

import { useEffect } from "react";
import { syncPushSubscription } from "@/lib/push-client";

/**
 * Registers public/sw.js once, client-side only, after the page is
 * interactive, then re-syncs any existing push subscription with the server
 * (no permission prompt -- that only happens from the settings toggle).
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    // Skip SW registration in dev to avoid caching hot-reloaded assets. (Push
    // can still be tested in dev: enabling it from settings registers the SW.)
    const registered =
      process.env.NODE_ENV === "production"
        ? navigator.serviceWorker.register("/sw.js").catch((err) => {
            console.error("Service worker registration failed", err);
          })
        : Promise.resolve();

    void registered.then(() => syncPushSubscription());
  }, []);

  return null;
}
