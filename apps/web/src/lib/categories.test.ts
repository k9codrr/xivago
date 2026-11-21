import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CATEGORIES_DATA,
  getAllIndustries,
  getAllTags,
  getCategoryFlowRows,
  getProblemById,
  getProviderById,
  LEGACY_CATEGORY_ALIASES,
  getRowsByTag,
  getSubCategoriesByIndustry,
  getSubCategoryById,
  searchCategoryFlow,
} from "@/lib/categories";

test("the workbook's 18 main categories come first, then the 2 additional ones", () => {
  assert.equal(CATEGORIES_DATA.length, 20);
  assert.deepEqual(
    CATEGORIES_DATA.slice(0, 2).map((c) => c.name),
    ["Health & Wellness", "Legal & Compliance"],
  );
  assert.deepEqual(
    CATEGORIES_DATA.slice(-2).map((c) => c.name),
    ["Customers", "Data & Analytics"],
  );
  // 120 workbook subs + 11 legacy subs moved in + 9 kept under Customers / Data & Analytics
  assert.equal(
    CATEGORIES_DATA.reduce((n, c) => n + c.subCategories.length, 0),
    140,
  );
});

test("similar names exist once: no sub category or main category is duplicated", () => {
  const mains = CATEGORIES_DATA.map((c) => c.name);
  assert.equal(new Set(mains).size, mains.length);
  const subs = CATEGORIES_DATA.flatMap((c) => c.subCategories.map((s) => s.name));
  assert.equal(new Set(subs).size, subs.length);
  for (const sub of CATEGORIES_DATA.flatMap((c) => c.subCategories)) {
    const providers = sub.providers.map((p) => p.name.toLowerCase());
    assert.equal(new Set(providers).size, providers.length, `duplicate provider in ${sub.name}`);
  }
});

test("every legacy id resolves to a live category at its own level", () => {
  for (const [legacy, current] of Object.entries(LEGACY_CATEGORY_ALIASES)) {
    const depth = legacy.split(".").length;
    assert.equal(current.split(".").length, depth, `${legacy} -> ${current}`);
    const found =
      depth === 1
        ? CATEGORIES_DATA.find((c) => c.id === current)
        : depth === 2
          ? getSubCategoryById(current)
          : depth === 3
            ? getProviderById(current)
            : getProblemById(current);
    assert.ok(found, `${legacy} -> ${current} is dead`);
  }
});

test("ids nest: sub -> provider -> problem, and are unique", () => {
  const seen = new Set<string>();
  for (const parent of CATEGORIES_DATA) {
    for (const sub of parent.subCategories) {
      assert.ok(sub.id.startsWith(`${parent.id}.`), `sub ${sub.id} under ${parent.id}`);
      assert.ok(sub.industries.length > 0, `sub ${sub.id} has industries`);
      assert.ok(sub.providers.length > 0, `sub ${sub.id} has providers`);
      for (const provider of sub.providers) {
        assert.ok(provider.id.startsWith(`${sub.id}.`), `provider ${provider.id} under ${sub.id}`);
        assert.ok(provider.problems.length > 0, `provider ${provider.id} has problems`);
        for (const problem of provider.problems) {
          assert.ok(problem.id.startsWith(`${provider.id}.`), `problem ${problem.id} under ${provider.id}`);
          assert.ok(!seen.has(problem.id), `duplicate problem id ${problem.id}`);
          seen.add(problem.id);
        }
      }
    }
  }
});

test("rates are gone from the sub category shape", () => {
  for (const parent of CATEGORIES_DATA) {
    for (const sub of parent.subCategories) {
      assert.equal("rates" in sub, false, `sub ${sub.id} still has rates`);
    }
  }
});

test("lookups resolve each level and its ancestors", () => {
  assert.equal(getSubCategoryById("13.1")?.sub.name, "Mental Health & Emotional Wellness");

  const provider = getProviderById("13.1.1");
  assert.equal(provider?.provider.name, "Licensed psychologists");
  assert.equal(provider?.sub.id, "13.1");
  assert.equal(provider?.parent.id, "13");

  const problem = getProblemById("13.1.1.1");
  assert.equal(problem?.problem.title, "Stigma, long waiting lists and high upfront costs for therapy");
  assert.equal(problem?.provider.id, "13.1.1");

  // Ids from before the workbook import land on their replacement
  assert.equal(getSubCategoryById("1.1")?.sub.name, "Corporate, Startup & Contract Law");
  assert.equal(getProviderById("1.1.1")?.provider.name, "Corporate lawyers");
  assert.equal(getProblemById("1.5.1.3")?.problem.title, "Get an Import Export Code for cross-border trade");
  assert.deepEqual(getProblemById("1.5.1.3")?.problem.tags, ["iec", "import export", "dgft"]);

  assert.equal(getProviderById("99.1.1"), undefined);
  assert.equal(getProblemById("1.1.1.99"), undefined);
});

test("flow rows: one per problem, carrying tags and sub industries", () => {
  const rows = getCategoryFlowRows();
  const problemCount = CATEGORIES_DATA.flatMap((c) => c.subCategories)
    .flatMap((s) => s.providers)
    .reduce((n, p) => n + p.problems.length, 0);
  assert.equal(rows.length, problemCount);
  const row = rows.find((r) => r.subCategory === "Corporate, Startup & Contract Law");
  assert.equal(row?.mainCategory, "Legal & Compliance");
  assert.ok(row?.industries.includes("FinTech"));
});

test("tags and industries are de-duplicated and sorted", () => {
  const tags = getAllTags();
  assert.deepEqual(tags, [...new Set(tags)].sort());
  const industries = getAllIndustries();
  assert.deepEqual(industries, [...new Set(industries)].sort());
  assert.ok(industries.includes("SaaS"));
});

test("industry, tag and free-text lookups", () => {
  const subs = getSubCategoriesByIndustry("venture capital");
  assert.ok(subs.some(({ sub }) => sub.name === "Corporate, Startup & Contract Law"));

  const tagged = getRowsByTag("TRADEMARK");
  assert.ok(tagged.length > 0);
  assert.ok(tagged.every((r) => r.tags.includes("trademark")));

  assert.ok(searchCategoryFlow("delaware").some((r) => r.subCategory === "Corporate, Startup & Contract Law"));
  assert.ok(searchCategoryFlow("therapist modality").length > 0);
  assert.deepEqual(searchCategoryFlow("   "), []);
});
