import tagData from "./category-tags.data.json";
import { CATEGORIES_DATA, getSubCategoryById, resolveCategoryId } from "@/lib/categories";
import { categoryHref } from "@/lib/category-selection";

/**
 * Server-side index over the workbook's ~30k tags. Too large for the client
 * bundle, so only API routes and server components may import this file; the
 * browser reaches it through /api/tags.
 */

export const MAX_SELECTED_TAGS = 5;

type TagType = "core" | "provider" | "community" | "persona" | "format" | "lead" | "variant";

// Curated tags list first, machine-generated phrasing variants last.
const TYPE_RANK: Record<TagType, number> = { core: 0, provider: 1, community: 2, persona: 3, format: 4, lead: 5, variant: 6 };

/** Persona and format tags repeat across a whole main category, so they say nothing about who provides a service. */
const GENERIC_TYPES: ReadonlySet<TagType> = new Set(["persona", "format"]);

interface TagEntry {
  tag: string;
  rank: number;
  subIds: string[];
  specificSubIds: string[];
}

let index: Map<string, TagEntry> | null = null;

function getIndex(): Map<string, TagEntry> {
  if (index) return index;
  const built = new Map<string, TagEntry>();
  const bySub = tagData as unknown as Record<string, Partial<Record<TagType, string[]>>>;
  for (const [subId, groups] of Object.entries(bySub)) {
    for (const [type, tags] of Object.entries(groups) as [TagType, string[]][]) {
      for (const tag of tags) {
        let entry = built.get(tag);
        if (!entry) {
          entry = { tag, rank: TYPE_RANK[type], subIds: [], specificSubIds: [] };
          built.set(tag, entry);
        }
        entry.rank = Math.min(entry.rank, TYPE_RANK[type]);
        if (!entry.subIds.includes(subId)) entry.subIds.push(subId);
        if (!GENERIC_TYPES.has(type) && !entry.specificSubIds.includes(subId)) entry.specificSubIds.push(subId);
      }
    }
  }
  index = built;
  return built;
}

export function normalizeTag(value: string): string {
  return value.trim().toLowerCase().replace(/-/g, " ").replace(/\s+/g, " ");
}

/** 0 = exact, 1 = starts with, 2 = a later word starts with, null = no match. */
function matchStrength(text: string, q: string): 0 | 1 | 2 | null {
  if (text === q) return 0;
  if (text.startsWith(q)) return 1;
  if (text.includes(` ${q}`)) return 2;
  return null;
}

export function isKnownTag(tag: string): boolean {
  return getIndex().has(normalizeTag(tag));
}

/** Tags for the picker: the chosen sub category's first, best match and curated types on top. */
export function searchTags(query: string, options: { subId?: string; limit?: number } = {}): string[] {
  const q = normalizeTag(query);
  const limit = options.limit ?? 30;
  const subId = options.subId ? resolveCategoryId(options.subId) : undefined;
  const all = Array.from(getIndex().values());

  if (!q) {
    // Nothing typed yet: suggest the most relevant curated tags.
    const pool = subId ? all.filter((e) => e.subIds.includes(subId)) : all;
    return pool
      .filter((e) => e.rank === 0)
      .slice(0, limit)
      .map((e) => e.tag);
  }

  const scored: { tag: string; score: number }[] = [];
  for (const entry of all) {
    const strength = matchStrength(entry.tag, q);
    if (strength === null) continue;
    const inSub = subId && entry.subIds.includes(subId) ? 0 : 1;
    scored.push({ tag: entry.tag, score: inSub * 1000 + strength * 100 + entry.rank * 10 + Math.min(entry.tag.length / 10, 9) });
  }
  return scored
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((s) => s.tag);
}

/**
 * Sub categories a piece of free text is about: every 1–3 word phrase in it
 * that is a known, specific tag (generic words like "design" don't count).
 */
export function subIdsInText(text: string): string[] {
  const words = normalizeTag(text.replace(/[^\p{L}\p{N}\s-]/gu, " ")).split(" ").filter(Boolean);
  const idx = getIndex();
  const found = new Set<string>();
  for (let i = 0; i < words.length; i++) {
    for (let n = 1; n <= 3 && i + n <= words.length; n++) {
      const phrase = words.slice(i, i + n).join(" ");
      if (phrase.length < 4) continue;
      for (const subId of idx.get(phrase)?.specificSubIds ?? []) found.add(subId);
    }
  }
  return [...found];
}

/** Sub categories a set of selected tags belongs to. */
export function subIdsForTags(tags: string[]): string[] {
  const idx = getIndex();
  return Array.from(new Set(tags.flatMap((t) => idx.get(normalizeTag(t))?.subIds ?? [])));
}

export interface TaxonomyMatch {
  subIds: string[];
  providerIds: string[];
  problemIds: string[];
  /** The most relevant matches, for "related categories" links. */
  categories: { id: string; label: string; href: string }[];
}

const EMPTY_MATCH: TaxonomyMatch = { subIds: [], providerIds: [], problemIds: [], categories: [] };
const MAX_RELATED_CATEGORIES = 5;

/**
 * Resolves free text to the taxonomy: a query naming a main category, sub
 * category, provider type, problem or tag maps to the ids a provider stores on
 * their profile, which is how search finds who offers that service.
 */
export function matchTaxonomy(query: string): TaxonomyMatch {
  const q = normalizeTag(query);
  if (q.length < 2) return EMPTY_MATCH;

  const subs = new Map<string, number>(); // sub id -> best strength
  const providerIds = new Set<string>();
  const problemIds = new Set<string>();
  const note = (subId: string, strength: number) => {
    const current = subs.get(subId);
    if (current === undefined || strength < current) subs.set(subId, strength);
  };

  for (const parent of CATEGORIES_DATA) {
    const parentStrength = matchStrength(normalizeTag(parent.name), q);
    for (const sub of parent.subCategories) {
      const subStrength = matchStrength(normalizeTag(sub.name), q);
      if (subStrength !== null) note(sub.id, subStrength);
      else if (parentStrength !== null) note(sub.id, parentStrength + 1);
      for (const provider of sub.providers) {
        const providerStrength = matchStrength(normalizeTag(provider.name), q);
        if (providerStrength !== null) {
          providerIds.add(provider.id);
          note(sub.id, providerStrength);
        }
        for (const problem of provider.problems) {
          if (matchStrength(normalizeTag(problem.title), q) !== null) {
            problemIds.add(problem.id);
            note(sub.id, 2);
          }
        }
      }
    }
  }

  for (const entry of getIndex().values()) {
    if (entry.specificSubIds.length === 0) continue;
    const strength = matchStrength(entry.tag, q);
    if (strength === null) continue;
    for (const subId of entry.specificSubIds) note(subId, strength);
  }

  const ranked = Array.from(subs.entries()).sort((a, b) => a[1] - b[1]);
  const categories = ranked.slice(0, MAX_RELATED_CATEGORIES).flatMap(([subId]) => {
    const hit = getSubCategoryById(subId);
    const href = categoryHref(subId);
    return hit && href ? [{ id: subId, label: hit.sub.name, href }] : [];
  });

  return {
    subIds: ranked.map(([subId]) => subId),
    providerIds: Array.from(providerIds),
    problemIds: Array.from(problemIds),
    categories,
  };
}
