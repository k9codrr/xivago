import { test } from "node:test";
import assert from "node:assert/strict";
import {
  categoryHref,
  demandCategoryWhere,
  describeDemandCategory,
  normalizeProfileCategories,
  resolveDemandCategory,
} from "@/lib/category-selection";

const SUB = "14.6"; // Corporate, Startup & Contract Law
const OTHER_SUB = "14.2"; // Tax, Accounting & CPA Compliance
const PROVIDER = "14.6.1"; // Corporate lawyers
const PROBLEM_A = "14.6.1.1";
const PROBLEM_B = "14.6.1.2";

test("resolveDemandCategory: sub-only pick works and names come from the taxonomy", () => {
  const res = resolveDemandCategory({ categoryParentId: "14", categorySubId: SUB, categoryName: "stale" });
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.deepEqual(res.value, {
    categoryParentId: "14",
    categorySubId: SUB,
    categoryName: "Legal & Compliance",
    subCategoryName: "Corporate, Startup & Contract Law",
    categoryProviderId: null,
    categoryProblemIds: [],
  });
});

test("resolveDemandCategory: a legacy sub id is stored as its current id", () => {
  const res = resolveDemandCategory({ categoryParentId: "1", categorySubId: "1.1" });
  assert.equal(res.ok, true);
  if (res.ok) assert.equal(res.value.categorySubId, SUB);
});

test("resolveDemandCategory: stores provider + problems and dedupes problems", () => {
  const res = resolveDemandCategory({
    categorySubId: SUB,
    categoryProviderId: PROVIDER,
    categoryProblemIds: [PROBLEM_A, PROBLEM_B, PROBLEM_A],
  });
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.value.categoryParentId, "14");
  assert.equal(res.value.categoryProviderId, PROVIDER);
  assert.deepEqual(res.value.categoryProblemIds, [PROBLEM_A, PROBLEM_B]);
});

test("resolveDemandCategory: custom demand with no category", () => {
  const res = resolveDemandCategory({});
  assert.equal(res.ok, true);
  if (res.ok) assert.equal(res.value.categorySubId, null);
});

test("resolveDemandCategory: rejects mismatched levels", () => {
  assert.equal(resolveDemandCategory({ categorySubId: SUB, categoryProviderId: `${OTHER_SUB}.1` }).ok, false);
  assert.equal(
    resolveDemandCategory({ categorySubId: SUB, categoryProviderId: PROVIDER, categoryProblemIds: [`${SUB}.2.1`] }).ok,
    false,
  );
  assert.equal(resolveDemandCategory({ categorySubId: SUB, categoryProblemIds: [PROBLEM_A] }).ok, false);
  assert.equal(resolveDemandCategory({ categoryProviderId: PROVIDER }).ok, false);
  assert.equal(resolveDemandCategory({ categorySubId: "nope", categoryProviderId: PROVIDER }).ok, false);
});

test("normalizeProfileCategories: fills ancestors and drops unknown ids", () => {
  const res = normalizeProfileCategories({
    categoryProblemIds: [PROBLEM_B, "bogus"],
    categoryProviderIds: ["13.1.1"],
    categorySubIds: ["15.1", "99.9"],
  });
  assert.deepEqual(res.categoryProblemIds, [PROBLEM_B]);
  assert.deepEqual(res.categoryProviderIds.sort(), ["13.1.1", PROVIDER].sort());
  assert.deepEqual(res.categorySubIds.sort(), ["13.1", "14.6", "15.1"].sort());
});

test("demandCategoryWhere: filters include shallower records at deeper levels", () => {
  assert.deepEqual(demandCategoryWhere({}), {});
  assert.deepEqual(demandCategoryWhere({ category: "14", subCategory: SUB }), {
    AND: [{ categoryParentId: "14" }, { categorySubId: SUB }],
  });
  assert.deepEqual(demandCategoryWhere({ provider: PROVIDER }), {
    AND: [{ OR: [{ categoryProviderId: PROVIDER }, { categorySubId: SUB, categoryProviderId: null }] }],
  });
  assert.deepEqual(demandCategoryWhere({ problem: PROBLEM_B }), {
    AND: [
      {
        OR: [
          { categoryProblemIds: { has: PROBLEM_B } },
          { categoryProviderId: PROVIDER, categoryProblemIds: { isEmpty: true } },
          { categorySubId: SUB, categoryProviderId: null },
        ],
      },
    ],
  });
});

test("demandCategoryWhere: tags match the demand's tags or its chosen problems", () => {
  const where = demandCategoryWhere({ tags: ["iec"] });
  const clause = (where.AND as { OR: { tags?: unknown; categoryProblemIds?: { hasSome: string[] } }[] }[])[0]!.OR;
  assert.deepEqual(clause[0], { tags: { hasSome: ["iec"] } });
  assert.ok(clause[1]?.categoryProblemIds?.hasSome.length);

  const unknown = demandCategoryWhere({ tags: ["no such tag"] });
  assert.deepEqual(unknown, { AND: [{ OR: [{ tags: { hasSome: ["no such tag"] } }] }] });
});

test("describeDemandCategory: labels known ids and skips unknown ones", () => {
  const { provider, problems } = describeDemandCategory(PROVIDER, [PROBLEM_A, "missing"]);
  assert.equal(provider?.name, "Corporate lawyers");
  assert.equal(problems.length, 1);
  assert.equal(describeDemandCategory(null, []).provider, null);
});

test("categoryHref: deep links each level", () => {
  assert.equal(categoryHref(SUB), `/niche/14/${SUB}`);
  assert.equal(categoryHref(PROVIDER), `/niche/14/${SUB}/${PROVIDER}`);
  assert.equal(categoryHref(PROBLEM_A), `/niche/14/${SUB}/${PROVIDER}/${PROBLEM_A}`);
  assert.equal(categoryHref("nope"), null);
});
