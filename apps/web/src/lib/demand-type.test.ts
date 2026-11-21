import { test } from "node:test";
import assert from "node:assert/strict";
import { demandTypeLabel } from "@/lib/demand-type";
import { formatBudgetRange } from "@/lib/money";

test("labels each post type", () => {
  assert.equal(demandTypeLabel({ postType: "PROMOTE" }), "Promotion");
  assert.equal(demandTypeLabel({ postType: "REQUIREMENT", requirementRole: { name: "Analyst" } }), "Seeking Analyst");
  assert.equal(demandTypeLabel({ postType: "REQUIREMENT", requirementRole: null }), "Requirement");
  assert.equal(demandTypeLabel({}), null);
});

test("a single price shows as one amount and older ranges still show as a range", () => {
  assert.equal(formatBudgetRange(25000, 25000), "₹25,000");
  assert.equal(formatBudgetRange(15000, 25000), "₹15,000–₹25,000");
  assert.equal(formatBudgetRange(null, null), null);
});
