"use client";

import { publicEnv } from "@/lib/env";

/**
 * Client-side push registration.
 *
 * - Browser / installed PWA → Web Push via the service worker (public/sw.js).
 * - Capacitor native shell  → @capacitor/push-notifications (FCM/APNs), used
 *   only if the native app has that plugin installed. It's reached through
 *   the global Capacitor bridge so the web bundle doesn't depend on it.
 *
 * The resulting token is stored server-side via /api/users/me/push-token.
 */

export type PushState = "unsupported" | "denied" | "enabled" | "disabled";

const TOKEN_ENDPOINT = "/api/users/me/push-token";
const NATIVE_TOKEN_KEY = "xivago:native-push-token";

interface NativePushPlugin {
  checkPermissions(): Promise<{ receive: string }>;
  requestPermissions(): Promise<{ receive: string }>;
  register(): Promise<void>;
  unregister?(): Promise<void>;
  addListener(event: string, cb: (arg: { value?: string; error?: string }) => void): Promise<{ remove(): void }>;
}

interface CapacitorGlobal {
  isNativePlatform?(): boolean;
  getPlatform?(): string;
  Plugins?: { PushNotifications?: NativePushPlugin };
}

function getNative(): { plugin: NativePushPlugin; platform: "ios" | "android" } | null {
  if (typeof window === "undefined") return null;
  const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  if (!cap?.isNativePlatform?.()) return null;
  const plugin = cap.Plugins?.PushNotifications;
  const platform = cap.getPlatform?.();
  if (!plugin || (platform !== "ios" && platform !== "android")) return null;
  return { plugin, platform };
}

function webPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    Boolean(publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY)
  );
}

export function isPushSupported(): boolean {
  return Boolean(getNative()) || webPushSupported();
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function saveToken(token: string, platform: "ios" | "android" | "web"): Promise<boolean> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, platform }),
  });
  return res.ok;
}

async function deleteToken(token: string): Promise<void> {
  await fetch(TOKEN_ENDPOINT, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  }).catch(() => {});
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) return existing;
  await navigator.serviceWorker.register("/sw.js");
  return navigator.serviceWorker.ready;
}

// ── Native ──────────────────────────────────────────────────────────────────

function registerNative(plugin: NativePushPlugin): Promise<string> {
  return new Promise((resolve, reject) => {
    const handles: Array<Promise<{ remove(): void }>> = [];
    const cleanup = () => handles.forEach((h) => h.then((x) => x.remove()).catch(() => {}));
    handles.push(
      plugin.addListener("registration", (t) => {
        cleanup();
        if (t.value) resolve(t.value);
        else reject(new Error("No push token"));
      }),
      plugin.addListener("registrationError", (e) => {
        cleanup();
        reject(new Error(e.error ?? "Push registration failed"));
      }),
    );
    plugin.register().catch((err) => {
      cleanup();
      reject(err);
    });
  });
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function getPushState(): Promise<PushState> {
  const native = getNative();
  if (native) {
    const { receive } = await native.plugin.checkPermissions();
    if (receive === "denied") return "denied";
    return receive === "granted" && localStorage.getItem(NATIVE_TOKEN_KEY) ? "enabled" : "disabled";
  }

  if (!webPushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission !== "granted") return "disabled";
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  return sub ? "enabled" : "disabled";
}

/** Ask for permission (if needed), subscribe this device and store its token. */
export async function enablePush(): Promise<PushState> {
  const native = getNative();
  if (native) {
    const perm = await native.plugin.requestPermissions();
    if (perm.receive !== "granted") return "denied";
    const token = await registerNative(native.plugin);
    if (!(await saveToken(token, native.platform))) throw new Error("Could not save push token");
    localStorage.setItem(NATIVE_TOKEN_KEY, token);
    return "enabled";
  }

  if (!webPushSupported()) return "unsupported";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "disabled";

  const reg = await getRegistration();
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
    }));

  if (!(await saveToken(JSON.stringify(sub), "web"))) throw new Error("Could not save push subscription");
  return "enabled";
}

/** Stop push on this device and forget its token server-side. */
export async function disablePush(): Promise<PushState> {
  const native = getNative();
  if (native) {
    const token = localStorage.getItem(NATIVE_TOKEN_KEY);
    if (token) await deleteToken(token);
    localStorage.removeItem(NATIVE_TOKEN_KEY);
    await native.plugin.unregister?.().catch(() => {});
    return "disabled";
  }

  if (!webPushSupported()) return "unsupported";
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await deleteToken(JSON.stringify(sub));
    await sub.unsubscribe().catch(() => {});
  }
  return "disabled";
}

/**
 * Re-send an existing subscription so the server's copy is linked to the
 * currently signed-in user and its lastSeenAt stays fresh. Never prompts and
 * never throws -- safe to call on every app load.
 */
export async function syncPushSubscription(): Promise<void> {
  try {
    const native = getNative();
    if (native) {
      const { receive } = await native.plugin.checkPermissions();
      if (receive !== "granted" || !localStorage.getItem(NATIVE_TOKEN_KEY)) return;
      const token = await registerNative(native.plugin);
      if (await saveToken(token, native.platform)) localStorage.setItem(NATIVE_TOKEN_KEY, token);
      return;
    }

    if (!webPushSupported() || Notification.permission !== "granted") return;
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) await saveToken(JSON.stringify(sub), "web");
  } catch {
    // Best-effort.
  }
}

/** Call before signing out so this device stops getting the old account's pushes. */
export async function forgetPushTokenOnSignOut(): Promise<void> {
  try {
    const native = getNative();
    if (native) {
      // Local token is kept (like the web subscription below) so the next
      // sign-in on this device re-links it via syncPushSubscription().
      const token = localStorage.getItem(NATIVE_TOKEN_KEY);
      if (token) await deleteToken(token);
      return;
    }
    if (!webPushSupported()) return;
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) await deleteToken(JSON.stringify(sub));
  } catch {
    // Best-effort.
  }
}
