// Minimal service worker: caches the app shell so the last-visited pages
// stay reachable offline. Deliberately simple (no Workbox) -- this is PWA
// polish (§9 M7), not a full offline-first data-sync architecture.
const CACHE_NAME = "slotbook-shell-v4";
const SHELL_ASSETS = ["/", "/manifest.json", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).catch(() => {
      // Best-effort -- a failed precache shouldn't block install (e.g. offline first load).
    }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Never cache API calls or auth routes -- this app is data-fresh by
  // design (feeds, prices, chat), and stale cached JSON would be actively
  // wrong, not just outdated.
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached ?? caches.match("/"))),
  );
});

// ── Web Push ────────────────────────────────────────────────────────────────
// Payload shape comes from packages/push sendWeb(): { title, body, url, tag }.

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Xivago";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    // Android draws badges from alpha only, so this must stay transparent.
    badge: "/icons/badge-96.png",
    data: { url: data.url || "/" },
    // Same tag replaces the previous notification (one per conversation, etc.)
    // and `renotify` still buzzes for the replacement.
    ...(data.tag ? { tag: data.tag, renotify: true } : {}),
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      // Tell open tabs so badges / the activity list refresh instantly.
      self.clients
        .matchAll({ type: "window", includeUncontrolled: true })
        .then((windows) => windows.forEach((client) => client.postMessage({ type: "push", tag: data.tag || null }))),
    ]),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin);

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      // Reuse an open app tab if there is one, otherwise open a new window.
      for (const client of windows) {
        if (new URL(client.url).origin === target.origin && "focus" in client) {
          return client.focus().then((focused) => (focused && "navigate" in focused ? focused.navigate(target.href) : focused));
        }
      }
      return self.clients.openWindow(target.href);
    }),
  );
});

// The browser can rotate a subscription; re-register the new one.
self.addEventListener("pushsubscriptionchange", (event) => {
  const options = event.oldSubscription && event.oldSubscription.options;
  if (!options) return;
  event.waitUntil(
    self.registration.pushManager.subscribe(options).then((subscription) =>
      fetch("/api/users/me/push-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token: JSON.stringify(subscription), platform: "web" }),
      }),
    ),
  );
});
