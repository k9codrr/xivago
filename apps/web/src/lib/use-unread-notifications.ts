"use client";

import { useCallback, useEffect, useState } from "react";

/** Fired on window when notifications are read elsewhere in the app, so every badge updates. */
export const NOTIFICATIONS_READ_EVENT = "xivago:notifications-read";
/** Fired on window when the service worker reports an incoming push. */
export const PUSH_RECEIVED_EVENT = "xivago:push-received";

let swBridgeInstalled = false;

/** Relay service-worker "push" messages to a window event (installed once). */
function installServiceWorkerBridge() {
  if (swBridgeInstalled || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  swBridgeInstalled = true;
  navigator.serviceWorker.addEventListener("message", (event) => {
    if ((event.data as { type?: string } | null)?.type === "push") {
      window.dispatchEvent(new CustomEvent(PUSH_RECEIVED_EVENT));
    }
  });
}

/** Live unread-notification count for badges. */
export function useUnreadNotifications(): number {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/unread-count", { cache: "no-store" });
      if (res.ok) setCount((await res.json()).unreadCount ?? 0);
    } catch {
      // offline -- keep the last value
    }
  }, []);

  useEffect(() => {
    installServiceWorkerBridge();
    void refresh();

    const onVisible = () => document.visibilityState === "visible" && void refresh();
    const onRead = () => setCount(0);
    const onPush = () => void refresh();
    const timer = window.setInterval(refresh, 60_000);

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(NOTIFICATIONS_READ_EVENT, onRead);
    window.addEventListener(PUSH_RECEIVED_EVENT, onPush);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(NOTIFICATIONS_READ_EVENT, onRead);
      window.removeEventListener(PUSH_RECEIVED_EVENT, onPush);
    };
  }, [refresh]);

  return count;
}

/** Subscribe to incoming pushes (e.g. to refetch a list while it's open). */
export function useOnPushReceived(callback: () => void) {
  useEffect(() => {
    installServiceWorkerBridge();
    window.addEventListener(PUSH_RECEIVED_EVENT, callback);
    return () => window.removeEventListener(PUSH_RECEIVED_EVENT, callback);
  }, [callback]);
}
