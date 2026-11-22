/**
 * Which featured posts the "All" feed shows on this visit.
 *
 * The feed shows at most FEATURED_SLOTS featured posts at the top. Each visit
 * gets a new random seed from the client, so the set and order change every
 * time someone comes back, and two devices rarely see the same set. The pick
 * is a weighted random sample without replacement (Efraimidis–Spirakis): every
 * featured post can win, but some are more likely to:
 *
 *   - fewer views so far       → more likely (spreads paid exposure fairly)
 *   - boost ends soon          → a bit more likely (gets its paid days' worth)
 *   - posted recently          → a bit more likely
 *   - closer to the viewer     → more likely, when the viewer shared a location
 *
 * The same seed always gives the same pick, so every page of one visit agrees
 * on which posts were lifted to the top.
 */

export const FEATURED_SLOTS = 6;
/** How many live featured posts are considered for the slots on each visit. */
export const FEATURED_CANDIDATES = 120;

export interface RotationCandidate {
  id: string;
  createdAt: Date;
  priorityExpiresAt: Date | null;
  views: number;
  /** Distance to the viewer in km, when known. */
  distanceKm?: number | null;
}

/** 32-bit FNV-1a hash. */
function hash(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic number in (0, 1) for this seed + post. */
function unitRandom(seed: string, id: string): number {
  // mulberry32 step over the hash, so similar ids don't give similar numbers
  let t = (hash(`${seed}:${id}`) + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return Math.min(Math.max(r, 1e-9), 1 - 1e-9);
}

const HOUR = 60 * 60 * 1000;

export function rotationWeight(c: RotationCandidate, now = Date.now()): number {
  // Exposure: a post with 0 views weighs 1, with 200 views about 0.2.
  const exposure = 1 / (1 + c.views / 50);
  // Ending within 24h: up to 1.5x.
  const left = c.priorityExpiresAt ? c.priorityExpiresAt.getTime() - now : Infinity;
  const urgency = left < 24 * HOUR ? 1.5 : left < 72 * HOUR ? 1.2 : 1;
  // Posted in the last 24h: 1.3x.
  const fresh = now - c.createdAt.getTime() < 24 * HOUR ? 1.3 : 1;
  // Closer is better, never below 0.4x.
  const near = c.distanceKm == null ? 1 : Math.max(0.4, 1 / (1 + c.distanceKm / 50));
  return exposure * urgency * fresh * near;
}

/** Up to `slots` ids, in display order. */
export function pickFeatured(
  candidates: RotationCandidate[],
  seed: string,
  slots = FEATURED_SLOTS,
  now = Date.now(),
): string[] {
  return candidates
    .map((c) => ({ id: c.id, key: Math.pow(unitRandom(seed, c.id), 1 / Math.max(rotationWeight(c, now), 1e-6)) }))
    .sort((a, b) => b.key - a.key)
    .slice(0, slots)
    .map((c) => c.id);
}
