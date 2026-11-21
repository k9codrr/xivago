import { test } from "node:test";
import assert from "node:assert/strict";
import { getCategoryFlowRows } from "@/lib/categories";
import { filterCategoryFlow, groupCategoryFlow } from "@/lib/category-flow-search";

test("no filters returns every row", () => {
  assert.equal(filterCategoryFlow({}).length, getCategoryFlowRows().length);
});

test("filters combine: search + category + industry + tag", () => {
  // 14 = Legal & Compliance; the legacy Licensing sub moved under it keeps its problem tags
  const rows = filterCategoryFlow({ q: "export", category: "14", tags: ["iec"] });
  assert.ok(rows.length > 0);
  for (const r of rows) {
    assert.equal(r.mainCategoryId, "14");
    assert.ok(r.tags.includes("iec"));
  }
  const fintech = filterCategoryFlow({ category: "14", industry: "FinTech" });
  assert.ok(fintech.length > 0);
  assert.ok(fintech.every((r) => r.industries.includes("FinTech")));
  assert.deepEqual(filterCategoryFlow({ category: "14", tags: ["tarot"] }), []);
});

test("server matches widen tag and text filters to whole sub categories", () => {
  assert.deepEqual(filterCategoryFlow({ tags: ["only known to the server"] }), []);
  const byTag = filterCategoryFlow({ tags: ["only known to the server"] }, { tagSubIds: ["13.1"] });
  assert.ok(byTag.length > 0);
  assert.ok(byTag.every((r) => r.subCategoryId === "13.1"));

  const byQuery = filterCategoryFlow({ q: "zzzz" }, { querySubIds: ["13.2"] });
  assert.ok(byQuery.length > 0);
  assert.ok(byQuery.every((r) => r.subCategoryId === "13.2"));
});

test("groupCategoryFlow nests rows as sub -> provider -> problems", () => {
  const groups = groupCategoryFlow(filterCategoryFlow({ category: "13" }));
  const first = groups[0];
  assert.equal(first?.subCategoryId, "13.1");
  assert.equal(first?.providers[0]?.providerId, "13.1.1");
  assert.deepEqual(
    first?.providers[0]?.problems.map((p) => p.problemId),
    ["13.1.1.1", "13.1.1.2", "13.1.1.3"],
  );
});
