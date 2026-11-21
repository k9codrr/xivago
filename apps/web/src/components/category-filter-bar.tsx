"use client";

import * as React from "react";
import { MapPin, Loader2, X, Compass } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORIES_DATA } from "@/lib/categories";
import { toast } from "sonner";

export interface CategoryFilterBarProps {
  selectedCategory: string | null;
  onSelectCategory: (categoryId: string | null) => void;
  isLocalActive: boolean;
  onToggleLocal: () => void;
  isLocating?: boolean;
  locationError?: string | null;
}

export function CategoryFilterBar({
  selectedCategory,
  onSelectCategory,
  isLocalActive,
  onToggleLocal,
  isLocating = false,
  locationError,
}: CategoryFilterBarProps) {
  React.useEffect(() => {
    if (locationError) {
      toast.error(locationError);
    }
  }, [locationError]);

  return (
    <div className="w-full">
      <div className="no-scrollbar flex items-center gap-2 overflow-x-auto py-2 px-1">
        {/* 'All' button */}
        <button
          type="button"
          onClick={() => onSelectCategory(null)}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all active:scale-95",
            selectedCategory === null
              ? "bg-white text-black shadow-md shadow-white/10 font-semibold"
              : "border border-neutral-800 bg-neutral-900/80 text-neutral-400 hover:border-neutral-700 hover:text-white"
          )}
        >
          All
        </button>

        {/* 'Local (25km)' button */}
        <button
          type="button"
          onClick={onToggleLocal}
          disabled={isLocating}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all active:scale-95",
            isLocalActive
              ? "bg-emerald-500 text-black font-semibold shadow-md shadow-emerald-500/25 ring-2 ring-emerald-400/50"
              : "border border-neutral-800 bg-neutral-900/80 text-neutral-400 hover:border-neutral-700 hover:text-emerald-400"
          )}
        >
          {isLocating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-neutral-300" />
          ) : (
            <MapPin className={cn("h-3.5 w-3.5", isLocalActive ? "text-black fill-current" : "text-emerald-400")} />
          )}
          <span>{isLocalActive ? "Within 25km" : "Local (25km)"}</span>
          {isLocalActive && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onToggleLocal();
              }}
              className="ml-0.5 rounded-full p-0.5 hover:bg-black/20"
              title="Remove local filter"
            >
              <X className="h-3 w-3" />
            </span>
          )}
        </button>

        <div className="h-4 w-px bg-neutral-800 shrink-0 mx-0.5" />

        {/* Categories list */}
        {CATEGORIES_DATA.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(isSelected ? null : cat.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all active:scale-95",
                isSelected
                  ? "bg-amber-400 text-black shadow-md shadow-amber-400/20 font-semibold"
                  : "border border-neutral-800 bg-neutral-900/80 text-neutral-400 hover:border-neutral-700 hover:text-white"
              )}
            >
              <span>{cat.name}</span>
              {isSelected && (
                <X
                  className="h-3 w-3 ml-0.5 hover:opacity-75"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectCategory(null);
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Active filter summary pill */}
      {(selectedCategory || isLocalActive) && (
        <div className="mt-1 flex items-center justify-between px-1 text-[11px] text-neutral-400">
          <div className="flex items-center gap-1.5">
            <Compass className="h-3.5 w-3.5 text-neutral-500" />
            <span>
              Showing:{" "}
              <strong className="text-neutral-200">
                {selectedCategory
                  ? CATEGORIES_DATA.find((c) => c.id === selectedCategory)?.name ?? "Category"
                  : "All categories"}
              </strong>
              {isLocalActive && (
                <>
                  {" · "}
                  <span className="text-emerald-400 font-medium">📍 25km radius</span>
                </>
              )}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              onSelectCategory(null);
              if (isLocalActive) onToggleLocal();
            }}
            className="text-[11px] text-neutral-500 hover:text-neutral-300 underline underline-offset-2"
          >
            Reset all
          </button>
        </div>
      )}
    </div>
  );
}
