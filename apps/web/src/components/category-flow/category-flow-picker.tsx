"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORIES_DATA, getSubCategoryById } from "@/lib/categories";
import { MAX_CATEGORY_PROBLEMS, MAX_CATEGORY_PROVIDERS, MAX_CATEGORY_SUBS } from "@/lib/validation/profile";
import { IndustryBadges, TagChips } from "@/components/category-flow/chips";

export interface CategoryFlowValue {
  categorySubIds: string[];
  categoryProviderIds: string[];
  categoryProblemIds: string[];
}

export const EMPTY_CATEGORY_FLOW_VALUE: CategoryFlowValue = {
  categorySubIds: [],
  categoryProviderIds: [],
  categoryProblemIds: [],
};

interface CategoryFlowPickerProps {
  value: CategoryFlowValue;
  onChange: (next: CategoryFlowValue) => void;
}

const isUnder = (childId: string, parentId: string) => childId.startsWith(`${parentId}.`);

/**
 * Multi-select for what a provider offers:
 * Main Category -> Sub Category -> Provider type -> Problem(s).
 * Deselecting a level clears everything picked beneath it.
 */
export function CategoryFlowPicker({ value, onChange }: CategoryFlowPickerProps) {
  const [activeParentId, setActiveParentId] = useState<string>(() => {
    const firstSub = value.categorySubIds[0];
    return (firstSub && getSubCategoryById(firstSub)?.parent.id) ?? CATEGORIES_DATA[0]?.id ?? "";
  });
  const activeParent = CATEGORIES_DATA.find((c) => c.id === activeParentId);

  function toggleSub(subId: string) {
    if (value.categorySubIds.includes(subId)) {
      onChange({
        categorySubIds: value.categorySubIds.filter((id) => id !== subId),
        categoryProviderIds: value.categoryProviderIds.filter((id) => !isUnder(id, subId)),
        categoryProblemIds: value.categoryProblemIds.filter((id) => !isUnder(id, subId)),
      });
      return;
    }
    if (value.categorySubIds.length >= MAX_CATEGORY_SUBS) return;
    onChange({ ...value, categorySubIds: [...value.categorySubIds, subId] });
  }

  function toggleProvider(providerId: string) {
    if (value.categoryProviderIds.includes(providerId)) {
      onChange({
        ...value,
        categoryProviderIds: value.categoryProviderIds.filter((id) => id !== providerId),
        categoryProblemIds: value.categoryProblemIds.filter((id) => !isUnder(id, providerId)),
      });
      return;
    }
    if (value.categoryProviderIds.length >= MAX_CATEGORY_PROVIDERS) return;
    onChange({ ...value, categoryProviderIds: [...value.categoryProviderIds, providerId] });
  }

  function toggleProblem(problemId: string) {
    if (value.categoryProblemIds.includes(problemId)) {
      onChange({ ...value, categoryProblemIds: value.categoryProblemIds.filter((id) => id !== problemId) });
      return;
    }
    if (value.categoryProblemIds.length >= MAX_CATEGORY_PROBLEMS) return;
    onChange({ ...value, categoryProblemIds: [...value.categoryProblemIds, problemId] });
  }

  const selectedSubs = value.categorySubIds
    .map((id) => getSubCategoryById(id))
    .filter((hit): hit is NonNullable<typeof hit> => hit != null);

  return (
    <div className="space-y-3">
      {selectedSubs.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedSubs.map(({ sub }) => (
            <span
              key={sub.id}
              className="flex items-center gap-1 rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-700"
            >
              {sub.name}
              <button
                type="button"
                onClick={() => toggleSub(sub.id)}
                aria-label={`Remove ${sub.name}`}
                className="rounded-full hover:bg-brand-200"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* 1. Main category */}
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
        {CATEGORIES_DATA.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setActiveParentId(cat.id)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1 text-xs font-medium",
              activeParentId === cat.id
                ? "bg-neutral-900 text-white dark:bg-white dark:text-black"
                : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
            )}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* 2. Sub category -> 3. Provider -> 4. Problems */}
      <div className="space-y-2">
        {activeParent?.subCategories.map((sub) => {
          const subSelected = value.categorySubIds.includes(sub.id);
          return (
            <div key={sub.id} className={cn("card-shell p-3", subSelected && "border-brand-500")}>
              <button
                type="button"
                onClick={() => toggleSub(sub.id)}
                disabled={!subSelected && value.categorySubIds.length >= MAX_CATEGORY_SUBS}
                aria-pressed={subSelected}
                className="flex w-full items-start justify-between gap-2 text-left disabled:opacity-40"
              >
                <span>
                  <span className="block text-sm font-semibold">{sub.name}</span>
                  <span className="block text-xs text-neutral-500">{sub.subtitle}</span>
                </span>
                {subSelected && <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />}
              </button>
              <IndustryBadges industries={sub.industries} className="mt-2" />

              {subSelected && (
                <div className="mt-3 space-y-2 border-t border-neutral-200 pt-3 dark:border-neutral-800">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Provider type</p>
                  <div className="flex flex-wrap gap-1.5">
                    {sub.providers.map((provider) => {
                      const selected = value.categoryProviderIds.includes(provider.id);
                      return (
                        <button
                          key={provider.id}
                          type="button"
                          onClick={() => toggleProvider(provider.id)}
                          disabled={!selected && value.categoryProviderIds.length >= MAX_CATEGORY_PROVIDERS}
                          aria-pressed={selected}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40",
                            selected
                              ? "border-brand-500 bg-brand-500 text-white"
                              : "border-neutral-200 bg-white text-neutral-600 hover:border-brand-300 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300",
                          )}
                        >
                          {provider.name}
                        </button>
                      );
                    })}
                  </div>

                  {sub.providers
                    .filter((p) => value.categoryProviderIds.includes(p.id))
                    .map((provider) => (
                      <div key={provider.id} className="space-y-1.5 pt-1">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                          {provider.name} · problems you solve
                        </p>
                        {provider.problems.map((problem) => {
                          const selected = value.categoryProblemIds.includes(problem.id);
                          return (
                            <button
                              key={problem.id}
                              type="button"
                              onClick={() => toggleProblem(problem.id)}
                              disabled={!selected && value.categoryProblemIds.length >= MAX_CATEGORY_PROBLEMS}
                              aria-pressed={selected}
                              className={cn(
                                "flex w-full flex-col gap-1.5 rounded-xl border p-2.5 text-left text-xs transition-colors disabled:opacity-40",
                                selected
                                  ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10"
                                  : "border-neutral-200 dark:border-neutral-700",
                              )}
                            >
                              <span className="flex items-start justify-between gap-2 font-medium">
                                {problem.title}
                                {selected && <Check className="h-3.5 w-3.5 shrink-0 text-brand-600" />}
                              </span>
                              <TagChips tags={problem.tags} />
                            </button>
                          );
                        })}
                      </div>
                    ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-neutral-400">
        {value.categorySubIds.length}/{MAX_CATEGORY_SUBS} sub categories · {value.categoryProviderIds.length} provider
        types · {value.categoryProblemIds.length} problems
      </p>
    </div>
  );
}
