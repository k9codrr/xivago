import { test } from "node:test";
import assert from "node:assert/strict";
import { isKnownTag, matchTaxonomy, normalizeTag, searchTags, subIdsForTags } from "@/lib/category-tags.server";
import { getProviderById, getSubCategoryById } from "@/lib/categories";

test("normalizeTag: case, hyphens and spacing don't matter", () => {
  assert.equal(normalizeTag("  Cap-Table   Advisory "), "cap table advisory");
});

test("isKnownTag: workbook and legacy tags are known, others aren't", () => {
  assert.equal(isKnownTag("anxiety"), true);
  assert.equal(isKnownTag("PANIC ATTACKS"), true);
  assert.equal(isKnownTag("cap-table"), true);
  assert.equal(isKnownTag("definitely not a tag"), false);
});

test("searchTags: exact and prefix matches rank first, whole words only", () => {
  const results = searchTags("anxiety");
  assert.equal(results[0], "anxiety");
  assert.ok(results.length <= 30);
  assert.ok(results.includes("social anxiety"));

  // "art" must find "art therapy", not "heart" or "smart"
  const art = searchTags("art", { limit: 200 });
  assert.ok(art.includes("art therapy"));
  assert.ok(art.every((t) => /(^| )art/.test(t)));
});

test("searchTags: the chosen sub category's tags come first", () => {
  const pets = searchTags("training", { subId: "28.2" });
  const rest = searchTags("training");
  assert.notDeepEqual(pets, rest);
  assert.ok(subIdsForTags([pets[0]!]).includes("28.2"));
});

test("searchTags: with no query, suggests curated tags, scoped when a sub is given", () => {
  const scoped = searchTags("", { subId: "13.1" });
  assert.ok(scoped.includes("anxiety"));
  assert.ok(scoped.every((t) => subIdsForTags([t]).includes("13.1")));
  assert.ok(searchTags("").length > 0);
});

test("matchTaxonomy: a tag finds the sub categories whose providers offer it", () => {
  const match = matchTaxonomy("panic attacks");
  assert.ok(match.subIds.includes("13.1"));
  assert.equal(getSubCategoryById(match.subIds[0]!)?.sub.name, "Mental Health & Emotional Wellness");
  assert.ok(match.categories.length > 0 && match.categories.length <= 5);
  assert.equal(match.categories[0]?.href, "/niche/13/13.1");
});

test("matchTaxonomy: a provider type resolves to provider ids and their sub", () => {
  const match = matchTaxonomy("dermatologists");
  assert.ok(match.providerIds.length > 0);
  const hit = getProviderById(match.providerIds[0]!);
  assert.equal(hit?.provider.name, "Dermatologists");
  assert.ok(match.subIds.includes(hit!.sub.id));
});

test("matchTaxonomy: main and sub category names match", () => {
  const main = matchTaxonomy("pets & veterinary");
  for (const id of ["28.1", "28.2", "28.3", "28.4"]) assert.ok(main.subIds.includes(id));
  assert.equal(matchTaxonomy("online vet consultation").subIds[0], "28.1");
});

test("matchTaxonomy: generic format/persona tags don't pull in every provider", () => {
  const match = matchTaxonomy("video consultation");
  assert.ok(match.subIds.length < 120, `matched ${match.subIds.length} sub categories`);
});

test("matchTaxonomy: too-short or unmatched text returns nothing", () => {
  assert.deepEqual(matchTaxonomy("a").subIds, []);
  assert.deepEqual(matchTaxonomy("zzzzqqq"), { subIds: [], providerIds: [], problemIds: [], categories: [] });
});
