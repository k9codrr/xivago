"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Search, SearchX, X } from "lucide-react";
import {
  filterCategoryFlow,
  groupCategoryFlow,
  type CategoryFlowFilters,
  type CategoryFlowServerMatches,
} from "@/lib/category-flow-search";
import { TagPicker } from "@/components/tag-picker";
import { IndustryBadges, TagChips } from "@/components/category-flow/chips";

type Filters = Required<CategoryFlowFilters>;

const PAGE_SIZE = 20;

const selectClass =
  "h-10 min-w-0 flex-1 rounded-xl border border-white/10 bg-[#1C1C1E] px-3 text-[13px] text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A84FF]";

export function CategoryExplorer({
  initial,
  serverMatches,
  categories,
  industries,
}: {
  initial: Filters;
  serverMatches: CategoryFlowServerMatches;
  categories: { id: string; name: string }[];
  industries: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [filters, setFilters] = useState<Filters>(initial);
  const [visible, setVisible] = useState(PAGE_SIZE);

  function update(patch: Partial<Filters>) {
    const next = { ...filters, ...patch };
    setFilters(next);
    setVisible(PAGE_SIZE);
    const params = new URLSearchParams();
    if (next.q) params.set("q", next.q);
    if (next.category) params.set("category", next.category);
    if (next.industry) params.set("industry", next.industry);
    if (next.tags.length) params.set("tag", next.tags.join(","));
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const groups = useMemo(
    () => groupCategoryFlow(filterCategoryFlow(filters, serverMatches)),
    [filters, serverMatches],
  );
  const problemCount = groups.reduce((n, g) => n + g.providers.reduce((m, p) => m + p.problems.length, 0), 0);
  const hasFilters = Boolean(filters.q || filters.category || filters.industry || filters.tags.length);

  return (
    <div className="relative mt-5 space-y-4 px-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#EBEBF5]/50" />
        <input
          type="search"
          value={filters.q}
          onChange={(e) => update({ q: e.target.value })}
          placeholder="e.g. trademark, cold email, Shopify"
          aria-label="Search categories"
          className="h-11 w-full rounded-xl border border-white/10 bg-[#1C1C1E] pl-9 pr-3 text-[15px] text-white placeholder:text-[#EBEBF5]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A84FF]"
        />
      </div>

      <div className="flex gap-2">
        <select
          aria-label="Main category"
          value={filters.category}
          onChange={(e) => update({ category: e.target.value })}
          className={selectClass}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Industry"
          value={filters.industry}
          onChange={(e) => update({ industry: e.target.value })}
          className={selectClass}
        >
          <option value="">All industries</option>
          {industries.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>
      </div>

      <TagPicker value={filters.tags} onChange={(tags) => update({ tags })} placeholder="Filter by tag" />

      {hasFilters && (
        <button
          type="button"
          onClick={() => update({ q: "", category: "", industry: "", tags: [] })}
          className="flex h-10 items-center gap-1 rounded-xl bg-[#1C1C1E] px-3 text-[13px] text-[#EBEBF5]/70 hover:text-white"
        >
          <X className="h-3.5 w-3.5" /> Reset
        </button>
      )}

      <p className="text-[13px] text-[#EBEBF5]/50">
        {problemCount} problems in {groups.length} sub categories
      </p>

      {groups.length === 0 ? (
        <div className="rounded-[20px] bg-[#1C1C1E] px-8 py-10 text-center">
          <SearchX className="mx-auto mb-3 h-6 w-6 text-[#EBEBF5]/60" />
          <p className="text-[15px] font-semibold">No matches</p>
          <p className="mt-1 text-[13px] text-[#EBEBF5]/60">Try a broader search or clear a filter.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.slice(0, visible).map((g) => (
            <div key={g.subCategoryId} className="rounded-[20px] border border-white/[0.06] bg-[#1C1C1E] p-4">
              <p className="text-[12px] text-[#EBEBF5]/50">
                <Link href={`/niche/${g.mainCategoryId}`} className="hover:text-white">
                  {g.mainCategory}
                </Link>
              </p>
              <Link
                href={`/niche/${g.mainCategoryId}/${g.subCategoryId}`}
                className="text-[16px] font-semibold hover:text-[#0A84FF]"
              >
                {g.subCategory}
              </Link>
              <IndustryBadges
                industries={g.industries}
                tone="dark"
                className="mt-2"
                onSelect={(industry) => update({ industry })}
              />
              <div className="mt-3 space-y-3 border-t border-white/[0.08] pt-3">
                {g.providers.map((p) => (
                  <div key={p.providerId}>
                    <Link
                      href={`/niche/${g.mainCategoryId}/${g.subCategoryId}/${p.providerId}`}
                      className="text-[13px] font-semibold text-[#EBEBF5]/80 hover:text-white"
                    >
                      {p.provider}
                    </Link>
                    <ul className="mt-1.5 space-y-2">
                      {p.problems.map((row) => (
                        <li key={row.problemId}>
                          <Link
                            href={`/niche/${g.mainCategoryId}/${g.subCategoryId}/${p.providerId}/${row.problemId}`}
                            className="text-[14px] hover:text-[#0A84FF]"
                          >
                            {row.problem}
                          </Link>
                          <TagChips tags={row.tags} tone="dark" className="mt-1" onSelect={(tag) => {
                              if (!filters.tags.includes(tag) && filters.tags.length < 5) update({ tags: [...filters.tags, tag] });
                            }}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {visible < groups.length && (
            <button
              type="button"
              onClick={() => setVisible((v) => v + PAGE_SIZE)}
              className="h-11 w-full rounded-xl bg-[#1C1C1E] text-[14px] font-semibold text-[#0A84FF]"
            >
              Show more
            </button>
          )}
        </div>
      )}
    </div>
  );
}
