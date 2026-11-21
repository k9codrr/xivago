import {
  getCategoryFlowRows,
  getRowsByTag,
  getSubCategoriesByIndustry,
  searchCategoryFlow,
  type CategoryFlowRow,
} from "@/lib/categories";

export interface CategoryFlowFilters {
  q?: string;
  category?: string;
  industry?: string;
  tags?: string[];
}

/** Sub categories matched by the server-only tag index (the browser only has each problem's display tags). */
export interface CategoryFlowServerMatches {
  querySubIds?: string[];
  tagSubIds?: string[];
}

/** Search + industry + tag + main-category filter over the flattened category flow. */
export function filterCategoryFlow(filters: CategoryFlowFilters, server: CategoryFlowServerMatches = {}): CategoryFlowRow[] {
  const q = filters.q?.trim();
  let rows = getCategoryFlowRows();
  if (q) {
    const direct = new Set(searchCategoryFlow(q).map((r) => r.problemId));
    const subIds = new Set(server.querySubIds ?? []);
    rows = rows.filter((r) => direct.has(r.problemId) || subIds.has(r.subCategoryId));
  }

  if (filters.category) rows = rows.filter((r) => r.mainCategoryId === filters.category);
  if (filters.industry) {
    const subIds = new Set(getSubCategoriesByIndustry(filters.industry).map(({ sub }) => sub.id));
    rows = rows.filter((r) => subIds.has(r.subCategoryId));
  }
  if (filters.tags?.length) {
    const problemIds = new Set(filters.tags.flatMap((tag) => getRowsByTag(tag).map((r) => r.problemId)));
    const subIds = new Set(server.tagSubIds ?? []);
    rows = rows.filter((r) => problemIds.has(r.problemId) || subIds.has(r.subCategoryId));
  }
  return rows;
}

export interface GroupedFlow {
  mainCategoryId: string;
  mainCategory: string;
  subCategoryId: string;
  subCategory: string;
  industries: string[];
  providers: { providerId: string; provider: string; problems: CategoryFlowRow[] }[];
}

/** Regroups flat rows into Sub Category -> Provider -> Problem for display, keeping taxonomy order. */
export function groupCategoryFlow(rows: CategoryFlowRow[]): GroupedFlow[] {
  const subs = new Map<string, GroupedFlow>();
  for (const row of rows) {
    let sub = subs.get(row.subCategoryId);
    if (!sub) {
      sub = {
        mainCategoryId: row.mainCategoryId,
        mainCategory: row.mainCategory,
        subCategoryId: row.subCategoryId,
        subCategory: row.subCategory,
        industries: row.industries,
        providers: [],
      };
      subs.set(row.subCategoryId, sub);
    }
    let provider = sub.providers.find((p) => p.providerId === row.providerId);
    if (!provider) {
      provider = { providerId: row.providerId, provider: row.provider, problems: [] };
      sub.providers.push(provider);
    }
    provider.problems.push(row);
  }
  return Array.from(subs.values());
}
