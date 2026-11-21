import type { Prisma } from "@slotbook/db";
import { getProblemById, getProviderById, getRowsByTag, getSubCategoryById } from "@/lib/categories";

/**
 * Helpers for storing a Main Category -> Sub Category -> Provider -> Problem
 * pick. IDs nest ("1.4" -> "1.4.2" -> "1.4.2.1"), so a child always belongs to
 * the parent whose id is its prefix. Every level below the sub category is
 * optional, which keeps records that only carry a sub category id valid.
 */

export interface DemandCategoryInput {
  categoryParentId?: string | null;
  categorySubId?: string | null;
  categoryName?: string | null;
  subCategoryName?: string | null;
  categoryProviderId?: string | null;
  categoryProblemIds?: string[] | null;
}

export interface DemandCategoryFields {
  categoryParentId: string | null;
  categorySubId: string | null;
  categoryName: string | null;
  subCategoryName: string | null;
  categoryProviderId: string | null;
  categoryProblemIds: string[];
}

export type CategorySelectionResult<T> = { ok: true; value: T } | { ok: false; message: string };

function unique(ids: string[]): string[] {
  return Array.from(new Set(ids));
}

/**
 * Validates a demand's category pick and fills in names from the taxonomy.
 * Unknown sub ids are passed through untouched (legacy/custom records); a
 * provider or problem must exist and belong to the chosen sub / provider.
 */
export function resolveDemandCategory(input: DemandCategoryInput): CategorySelectionResult<DemandCategoryFields> {
  const providerId = input.categoryProviderId || null;
  const problemIds = unique(input.categoryProblemIds ?? []);
  const subId = input.categorySubId || null;

  if (!subId) {
    if (providerId || problemIds.length > 0) {
      return { ok: false, message: "Pick a sub-category before choosing a service or common need." };
    }
    return {
      ok: true,
      value: {
        categoryParentId: input.categoryParentId || null,
        categorySubId: null,
        categoryName: input.categoryName || null,
        subCategoryName: input.subCategoryName || null,
        categoryProviderId: null,
        categoryProblemIds: [],
      },
    };
  }

  const found = getSubCategoryById(subId);
  if (!found) {
    if (providerId || problemIds.length > 0) {
      return { ok: false, message: "Unknown sub category." };
    }
    return {
      ok: true,
      value: {
        categoryParentId: input.categoryParentId || null,
        categorySubId: subId,
        categoryName: input.categoryName || null,
        subCategoryName: input.subCategoryName || null,
        categoryProviderId: null,
        categoryProblemIds: [],
      },
    };
  }

  if (problemIds.length > 0 && !providerId) {
    return { ok: false, message: "Pick a service before choosing common needs." };
  }
  if (providerId) {
    const provider = getProviderById(providerId);
    if (!provider || provider.sub.id !== found.sub.id) {
      return { ok: false, message: "That provider doesn't belong to the chosen sub category." };
    }
    for (const problemId of problemIds) {
      const problem = getProblemById(problemId);
      if (!problem || problem.provider.id !== providerId) {
        return { ok: false, message: "One of the chosen needs doesn't belong to that service." };
      }
    }
  }

  return {
    ok: true,
    value: {
      categoryParentId: found.parent.id,
      categorySubId: found.sub.id,
      categoryName: found.parent.name,
      subCategoryName: found.sub.name,
      categoryProviderId: providerId,
      categoryProblemIds: problemIds,
    },
  };
}

export interface ProfileCategoryInput {
  categorySubIds?: string[];
  categoryProviderIds?: string[];
  categoryProblemIds?: string[];
}

export interface ProfileCategoryFields {
  categorySubIds: string[];
  categoryProviderIds: string[];
  categoryProblemIds: string[];
}

/**
 * Normalizes what a provider offers: drops unknown ids and adds any missing
 * ancestors (picking problem "1.4.2.1" implies provider "1.4.2" and sub "1.4").
 */
export function normalizeProfileCategories(input: ProfileCategoryInput): ProfileCategoryFields {
  const subs = new Set<string>();
  const providers = new Set<string>();
  const problems = new Set<string>();

  for (const id of input.categoryProblemIds ?? []) {
    const hit = getProblemById(id);
    if (!hit) continue;
    problems.add(hit.problem.id);
    providers.add(hit.provider.id);
    subs.add(hit.sub.id);
  }
  for (const id of input.categoryProviderIds ?? []) {
    const hit = getProviderById(id);
    if (!hit) continue;
    providers.add(hit.provider.id);
    subs.add(hit.sub.id);
  }
  for (const id of input.categorySubIds ?? []) {
    const hit = getSubCategoryById(id);
    if (hit) subs.add(hit.sub.id);
  }

  return {
    categorySubIds: Array.from(subs),
    categoryProviderIds: Array.from(providers),
    categoryProblemIds: Array.from(problems),
  };
}

export interface DemandCategoryFilter {
  category?: string;
  subCategory?: string;
  provider?: string;
  problem?: string;
  tags?: string[];
}

/**
 * Prisma `where` fragment for a category filter. Deeper filters also match
 * older demands that stopped at a shallower level (e.g. a provider filter
 * still returns demands in that sub category that never picked a provider),
 * so records without provider/problem ids stay discoverable.
 */
export function demandCategoryWhere(filter: DemandCategoryFilter): Prisma.DemandWhereInput {
  const and: Prisma.DemandWhereInput[] = [];
  if (filter.category) and.push({ categoryParentId: filter.category });
  if (filter.subCategory) and.push({ categorySubId: filter.subCategory });

  if (filter.problem) {
    const hit = getProblemById(filter.problem);
    and.push(
      hit
        ? {
            OR: [
              { categoryProblemIds: { has: hit.problem.id } },
              { categoryProviderId: hit.provider.id, categoryProblemIds: { isEmpty: true } },
              { categorySubId: hit.sub.id, categoryProviderId: null },
            ],
          }
        : { categoryProblemIds: { has: filter.problem } },
    );
  } else if (filter.provider) {
    const hit = getProviderById(filter.provider);
    and.push(
      hit
        ? { OR: [{ categoryProviderId: hit.provider.id }, { categorySubId: hit.sub.id, categoryProviderId: null }] }
        : { categoryProviderId: filter.provider },
    );
  }

  if (filter.tags?.length) {
    // Demands posted before tags existed still match through their chosen problems.
    const problemIds = Array.from(new Set(filter.tags.flatMap((tag) => getRowsByTag(tag).map((r) => r.problemId))));
    and.push({
      OR: [
        { tags: { hasSome: filter.tags } },
        ...(problemIds.length ? [{ categoryProblemIds: { hasSome: problemIds } }] : []),
      ],
    });
  }

  return and.length > 0 ? { AND: and } : {};
}

/** Human-readable labels for a demand's provider/problem ids (unknown ids are skipped). */
export function describeDemandCategory(providerId?: string | null, problemIds?: string[] | null) {
  const provider = providerId ? getProviderById(providerId)?.provider ?? null : null;
  const problems = (problemIds ?? [])
    .map((id) => getProblemById(id)?.problem)
    .filter((p): p is NonNullable<typeof p> => p != null);
  return { provider, problems };
}

/** Canonical deep link for a category level, or null if the id is unknown. */
export function categoryHref(id: string): string | null {
  const problem = getProblemById(id);
  if (problem) return `/niche/${problem.parent.id}/${problem.sub.id}/${problem.provider.id}/${problem.problem.id}`;
  const provider = getProviderById(id);
  if (provider) return `/niche/${provider.parent.id}/${provider.sub.id}/${provider.provider.id}`;
  const sub = getSubCategoryById(id);
  if (sub) return `/niche/${sub.parent.id}/${sub.sub.id}`;
  return null;
}
