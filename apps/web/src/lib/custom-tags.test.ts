import { test } from "node:test";
import assert from "node:assert/strict";
import { customTagError, normalizeTagInput } from "@/lib/custom-tags";
import { completionProfileFor } from "@/lib/completion-timeline";

test("custom tags are normalised like workbook tags", () => {
  assert.equal(normalizeTagInput("  Shopify-Plus   Expert "), "shopify plus expert");
});

test("reasonable custom tags pass", () => {
  for (const tag of ["shopify plus", "c++", "node.js", "r&d", "गृह प्रवेश", "web3"]) {
    assert.equal(customTagError(normalizeTagInput(tag)), null, tag);
  }
});

test("bad custom tags are rejected", () => {
  for (const tag of ["a", "x".repeat(31), "one two three four five", "buy now!!", "1234", "www.spam.com", "call 9876543210"]) {
    assert.notEqual(customTagError(normalizeTagInput(tag)), null, tag);
  }
});

test("completion profile follows the category flow", () => {
  assert.equal(completionProfileFor("25.1").id, "project");
  assert.equal(completionProfileFor("25.7").id, "session");
  assert.equal(completionProfileFor("23.1", "23").id, "dated");
  assert.equal(completionProfileFor("17.2", "17").id, "process");
  assert.equal(completionProfileFor(null, null).id, "project");
});
