"use client";

/**
 * Remembers, per device, how the user answered each permission prompt, so the
 * app never asks again for something already allowed (or keeps nagging after
 * a "no"). The browser / OS keeps the real grant; this is our memory of it,
 * used to decide whether to prompt, to refresh silently, or to skip.
 *
 * Only "granted" and "denied" are stored -- a dismissed prompt stays unknown
 * so the next deliberate tap can ask again.
 */

export type PermissionName = "location" | "camera" | "microphone" | "notifications" | "media";
export type RememberedPermission = "granted" | "denied" | "unknown";

const KEY = "xivago:permissions";

function readAll(): Partial<Record<PermissionName, "granted" | "denied">> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function getRememberedPermission(name: PermissionName): RememberedPermission {
  if (typeof window === "undefined") return "unknown";
  return readAll()[name] ?? "unknown";
}

export function rememberPermission(name: PermissionName, value: "granted" | "denied") {
  try {
    const all = readAll();
    if (all[name] === value) return;
    all[name] = value;
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // storage blocked: we'll just ask again next time
  }
}

/** Re-sync our memory with the browser's own answer (e.g. after the user changed it in site settings). */
export async function syncPermission(name: PermissionName): Promise<RememberedPermission> {
  const browserName: Record<PermissionName, string | null> = {
    location: "geolocation",
    camera: "camera",
    microphone: "microphone",
    notifications: "notifications",
    media: null,
  };
  const query = browserName[name];
  if (!query || typeof navigator === "undefined" || !navigator.permissions) return getRememberedPermission(name);
  try {
    const status = await navigator.permissions.query({ name: query as never });
    if (status.state === "granted" || status.state === "denied") rememberPermission(name, status.state);
    return status.state === "prompt" ? getRememberedPermission(name) : status.state;
  } catch {
    return getRememberedPermission(name);
  }
}
