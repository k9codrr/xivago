import { test } from "node:test";
import assert from "node:assert/strict";
import { demandCreateSchema, demandFeedQuerySchema } from "@/lib/validation/demand";

const base = {
  summary: "Need a trademark filed",
  timelineEnd: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  budget: 5000,
  completionTimeline: "FLEXIBLE",
};

test("older payloads without provider/problem still parse", () => {
  const parsed = demandCreateSchema.parse({ ...base, categoryParentId: "1", categorySubId: "1.3" });
  assert.equal(parsed.categoryProviderId, undefined);
  assert.deepEqual(parsed.categoryProblemIds, []);
});

test("provider and problem ids are accepted", () => {
  const parsed = demandCreateSchema.parse({
    ...base,
    categorySubId: "1.3",
    categoryProviderId: "1.3.1",
    categoryProblemIds: ["1.3.1.1"],
  });
  assert.equal(parsed.categoryProviderId, "1.3.1");
  assert.deepEqual(parsed.categoryProblemIds, ["1.3.1.1"]);
});

test("too many problems is rejected", () => {
  const ids = Array.from({ length: 11 }, (_, i) => `1.3.1.${i + 1}`);
  assert.equal(demandCreateSchema.safeParse({ ...base, categoryProblemIds: ids }).success, false);
});

test("a post defaults to PROMOTE and needs no role", () => {
  const parsed = demandCreateSchema.parse(base);
  assert.equal(parsed.postType, "PROMOTE");
  assert.equal(parsed.requirementRoleId, undefined);
});

test("a requirement's role is optional but kept when sent", () => {
  assert.equal(demandCreateSchema.safeParse({ ...base, postType: "REQUIREMENT" }).success, true);
  const parsed = demandCreateSchema.parse({ ...base, postType: "REQUIREMENT", requirementRoleId: "role1" });
  assert.equal(parsed.requirementRoleId, "role1");
});

test("a single budget is accepted", () => {
  assert.equal(demandCreateSchema.parse({ ...base, budget: "25000" }).budget, 25000);
  assert.equal(demandCreateSchema.safeParse({ ...base, budget: -1 }).success, false);
});

test("budget is required and must be positive", () => {
  const { budget: _omit, ...noBudget } = base;
  assert.equal(demandCreateSchema.safeParse(noBudget).success, false);
  assert.equal(demandCreateSchema.safeParse({ ...base, budget: 0 }).success, false);
});

test("connect window accepts 14 and 30 days but not 31", () => {
  const days = (n: number) => new Date(Date.now() + n * 86_400_000 - 60_000).toISOString();
  assert.equal(demandCreateSchema.safeParse({ ...base, timelineEnd: days(14) }).success, true);
  assert.equal(demandCreateSchema.safeParse({ ...base, timelineEnd: days(30) }).success, true);
  assert.equal(demandCreateSchema.safeParse({ ...base, timelineEnd: days(31.1) }).success, false);
});

test("completion timeline is required and must fit the category", () => {
  const { completionTimeline: _omit, ...noCompletion } = base;
  assert.equal(demandCreateSchema.safeParse(noCompletion).success, false);
  // Software (project): months are fine, same-day is not offered.
  assert.equal(demandCreateSchema.safeParse({ ...base, categorySubId: "25.1", completionTimeline: "MONTH_3" }).success, true);
  assert.equal(demandCreateSchema.safeParse({ ...base, categorySubId: "25.1", completionTimeline: "SAME_DAY" }).success, false);
  // Tech support is a session even though Software is a project category.
  assert.equal(demandCreateSchema.safeParse({ ...base, categorySubId: "25.7", completionTimeline: "SAME_DAY" }).success, true);
});

test("a specific-date completion needs a future date", () => {
  const event = { ...base, categorySubId: "23.1", completionTimeline: "DATE" };
  assert.equal(demandCreateSchema.safeParse(event).success, false);
  const inAMonth = new Date(Date.now() + 30 * 86_400_000).toISOString();
  assert.equal(demandCreateSchema.safeParse({ ...event, completionDate: inAMonth }).success, true);
  const past = new Date(Date.now() - 86_400_000).toISOString();
  assert.equal(demandCreateSchema.safeParse({ ...event, completionDate: past }).success, false);
});

test("feed query accepts provider and problem filters", () => {
  const parsed = demandFeedQuerySchema.parse({ provider: "1.3.1", problem: "1.3.1.1" });
  assert.equal(parsed.provider, "1.3.1");
  assert.equal(parsed.problem, "1.3.1.1");
});
