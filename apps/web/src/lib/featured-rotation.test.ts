import { test } from "node:test";
import assert from "node:assert/strict";
import { FEATURED_SLOTS, pickFeatured, type RotationCandidate } from "@/lib/featured-rotation";

const now = Date.UTC(2026, 0, 10);
const HOUR = 3_600_000;
const posts: RotationCandidate[] = Array.from({ length: 20 }, (_, i) => ({
  id: `post${i}`,
  createdAt: new Date(now - 48 * HOUR),
  priorityExpiresAt: new Date(now + 5 * 24 * HOUR),
  views: 10,
}));

test("shows at most 6 featured posts, no repeats", () => {
  const picked = pickFeatured(posts, "abcd1234", FEATURED_SLOTS, now);
  assert.equal(picked.length, 6);
  assert.equal(new Set(picked).size, 6);
  assert.equal(pickFeatured(posts.slice(0, 2), "abcd1234", FEATURED_SLOTS, now).length, 2);
});

test("same seed gives the same pick; new seeds rotate", () => {
  assert.deepEqual(pickFeatured(posts, "seed0001", 6, now), pickFeatured(posts, "seed0001", 6, now));
  const sets = new Set(Array.from({ length: 20 }, (_, i) => pickFeatured(posts, `visit${i}x`, 6, now).join(",")));
  assert.ok(sets.size > 15, `expected rotation, got ${sets.size} distinct sets`);
});

test("every featured post gets its turn", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) pickFeatured(posts, `v${i}zz`, 6, now).forEach((id) => seen.add(id));
  assert.equal(seen.size, posts.length);
});

test("less-seen posts win more often", () => {
  const mixed = posts.map((p, i) => ({ ...p, views: i < 10 ? 0 : 1000 }));
  let fresh = 0;
  for (let i = 0; i < 300; i++) fresh += pickFeatured(mixed, `r${i}qq`, 6, now).filter((id) => Number(id.slice(4)) < 10).length;
  assert.ok(fresh / (300 * 6) > 0.75, `low-view share ${fresh / 1800}`);
});
