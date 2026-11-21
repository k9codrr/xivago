"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { io, type Socket } from "socket.io-client";
import { publicEnv } from "@/lib/env";
import { socketAuth } from "@/lib/use-conversation-socket";

/**
 * App-wide presence. While a signed-in user has the app open anywhere, one
 * socket stays connected: that's what makes them "online" (green dot) for
 * the people they chat with, and what turns messages sent to them into
 * double ticks (delivered) the moment they arrive.
 *
 * `usePresence(ids)` subscribes to live online / last-seen for chat partners.
 */

export interface Presence {
  online: boolean;
  lastSeenAt: string | null;
}

let socket: Socket | null = null;
let refs = 0;
const statuses = new Map<string, Presence>();
const watched = new Set<string>();
const listeners = new Set<() => void>();
let version = 0;

function notify() {
  version++;
  listeners.forEach((l) => l());
}

function watch(ids: string[]) {
  const fresh = ids.filter((id) => !watched.has(id));
  if (fresh.length === 0 || !socket?.connected) {
    fresh.forEach((id) => watched.add(id));
    return;
  }
  fresh.forEach((id) => watched.add(id));
  socket.emit("presence:watch", { userIds: fresh }, (res: { ok: boolean; statuses?: Record<string, Presence> }) => {
    if (!res?.ok || !res.statuses) return;
    for (const [id, p] of Object.entries(res.statuses)) statuses.set(id, p);
    notify();
  });
}

function connect() {
  if (socket || typeof window === "undefined") return;
  socket = io(publicEnv.NEXT_PUBLIC_SOCKET_URL, { auth: socketAuth, transports: ["websocket"] });
  socket.on("connect", () => {
    // Re-subscribe everything after a reconnect.
    const all = [...watched];
    watched.clear();
    watch(all);
  });
  socket.on("presence", (p: { userId: string; online: boolean; lastSeenAt: string | null }) => {
    statuses.set(p.userId, { online: p.online, lastSeenAt: p.lastSeenAt });
    notify();
  });
}

/** Mount once for a signed-in user (see <PresenceConnector/>). */
export function usePresenceConnection(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    refs++;
    connect();
    // Background tab on a phone: drop the socket so "online" means actually looking at the app.
    const onVisibility = () => {
      if (!socket) return;
      if (document.visibilityState === "hidden") socket.disconnect();
      else if (!socket.connected) socket.connect();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (--refs === 0) {
        socket?.disconnect();
        socket = null;
      }
    };
  }, [enabled]);
}

/** Live presence for the given users (only chat partners resolve; others stay unknown). */
export function usePresence(userIds: string[]): Map<string, Presence> {
  const key = useMemo(() => [...new Set(userIds)].sort().join(","), [userIds]);
  useEffect(() => {
    if (key) watch(key.split(","));
  }, [key]);
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => version,
    () => 0,
  );
  return statuses;
}

/** Seed from REST data (e.g. the chat list's lastSeenAt) without overriding live values. */
export function seedPresence(userId: string, lastSeenAt: string | null) {
  if (statuses.has(userId)) return;
  statuses.set(userId, { online: false, lastSeenAt });
}

export function formatLastSeen(p: Presence | undefined): string | null {
  if (!p) return null;
  if (p.online) return "online";
  if (!p.lastSeenAt) return null;
  const d = new Date(p.lastSeenAt);
  const diff = Date.now() - d.getTime();
  const time = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  if (diff < 60_000) return "last seen just now";
  if (diff < 60 * 60_000) return `last seen ${Math.floor(diff / 60_000)} min ago`;
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return `last seen today at ${time}`;
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (d.toDateString() === yesterday.toDateString()) return `last seen yesterday at ${time}`;
  return `last seen ${d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;
}
