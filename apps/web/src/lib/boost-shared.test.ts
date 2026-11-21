import test from "node:test";
import assert from "node:assert/strict";
import { DAY_MS, DEFAULT_BOOST_CONFIG, boostCost, boostEndsAt, boostModeFor, clampBoostDays, isBoostActive } from "./boost-shared";

const cfg = DEFAULT_BOOST_CONFIG;

test("boost is priced per day: 3 days minimum = 90 credits", () => {
  assert.equal(boostCost(cfg, "new", 3), 90);
  assert.equal(boostCost(cfg, "new", 30), 900);
});

test("days are clamped to the admin's min..max", () => {
  assert.equal(clampBoostDays(cfg, "new", 1), 3);
  assert.equal(clampBoostDays(cfg, "new", 45), 30);
  assert.equal(clampBoostDays({ ...cfg, extendMinDays: 5 }, "extend", 2), 5);
});

test("a post featured before is extended, otherwise boosted new", () => {
  assert.equal(boostModeFor(null), "new");
  assert.equal(boostModeFor("2026-01-01T00:00:00.000Z"), "extend");
});

test("extending a running boost adds to its end; an ended one restarts from now", () => {
  const now = Date.UTC(2026, 10, 21);
  const running = new Date(now + 2 * DAY_MS);
  assert.equal(boostEndsAt(3, running, now).getTime(), now + 5 * DAY_MS);
  assert.equal(boostEndsAt(3, new Date(now - DAY_MS), now).getTime(), now + 3 * DAY_MS);
  assert.equal(isBoostActive(true, running, now), true);
  assert.equal(isBoostActive(true, new Date(now - 1), now), false);
});
