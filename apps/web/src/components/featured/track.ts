"use client";

const SEEN_KEY = "xivago_featured_seen";

/** Fire-and-forget impression/click counter, deduped per browser session. */
export function trackFeatured(placementId: string | undefined, event: "impression" | "click") {
  if (!placementId || typeof window === "undefined") return;
  const key = `${event}:${placementId}`;
  try {
    const seen = new Set<string>(JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? "[]"));
    if (seen.has(key)) return;
    seen.add(key);
    sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
  } catch {
    // storage unavailable — still count it
  }
  void fetch("/api/featured/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ placementId, event }),
    keepalive: true,
  }).catch(() => {});
}
