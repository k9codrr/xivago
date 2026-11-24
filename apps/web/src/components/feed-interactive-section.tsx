"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  LayoutGrid,
  Layers,
  MapPin,
  Clock,
  Loader2,
  Check,
  SlidersHorizontal,
  Tag,
} from "lucide-react";
import { CategoryIcon } from "@/components/category-icons/category-icon";
import { useCategoryIcons } from "@/lib/category-icons";
import { FeedList } from "@/components/feed-list";
import { SwipeDemandDeck } from "@/components/swipe-demand-deck";
import { BookmarksList } from "@/components/bookmarks-list";
import { CategoryFilterBar } from "@/components/category-filter-bar";
import { TagPicker } from "@/components/tag-picker";
import { useGeolocation } from "@/lib/use-geolocation";
import type { FeedFilters } from "@/lib/demands-feed";
import { cn } from "@/lib/utils";
import { getParentCategoryById } from "@/lib/categories";
import {
  HaloTabs,
  HaloTabsContent,
  HaloTabsIndicator,
  HaloTabsList,
  HaloTabsTrigger,
} from "@/components/ui/halo-tabs";
import { useHaptic } from "@/components/ui/haptic";

export interface CategoryCardItem {
  id: string;
  name: string;
}

const TABS = [
  { id: "all", label: "All requests", icon: LayoutGrid },
  { id: "swipe", label: "For you", icon: Layers },
  // { id: "saved", label: "Favourites", icon: Bookmark },
] as const;

/* iOS segmented-control styling shared by the filter rows */
const SEGMENT_TRACK = "flex rounded-[9px] bg-[#767680]/25 p-[2px]";
const SEGMENT_ITEM =
  "min-w-[46px] rounded-[7px] px-2.5 py-[5px] text-[13px] font-medium transition-all duration-200 disabled:opacity-50";
const SEGMENT_ACTIVE =
  "bg-[#636366] text-white shadow-[0_3px_8px_rgba(0,0,0,0.12),0_3px_1px_rgba(0,0,0,0.04)]";

interface FeedInteractiveSectionProps {
  categoryCards: CategoryCardItem[];
}

export function FeedInteractiveSection({ categoryCards }: FeedInteractiveSectionProps) {
  return (
    <React.Suspense fallback={<div className="h-40" />}>
      <FeedInteractiveContent categoryCards={categoryCards} />
    </React.Suspense>
  );
}

function FeedInteractiveContent({ categoryCards }: FeedInteractiveSectionProps) {
  const searchParams = useSearchParams();
  const iconPrefs = useCategoryIcons();
  const initialCategory = searchParams.get("category");
  const initialLocal = searchParams.get("local") === "true";

  const [selectedCategory, setSelectedCategory] = React.useState<string | null>(initialCategory);
  const [selectedSub, setSelectedSub] = React.useState<string | null>(searchParams.get("subCategory"));
  const selectedParent = selectedCategory ? getParentCategoryById(selectedCategory) : undefined;
  const [distanceFilter, setDistanceFilter] = React.useState<"all" | 25 | 50>(
    initialLocal ? 25 : "all"
  );
  const [timeFilter, setTimeFilter] = React.useState<"all" | "24h" | "2d">("all");
  const [selectedTags, setSelectedTags] = React.useState<string[]>(() =>
    (searchParams.get("tags") ?? "").split(",").map((t) => t.trim()).filter(Boolean).slice(0, 5),
  );

  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const filterMenuRef = React.useRef<HTMLDivElement>(null);

  // Close the filter dropdown on outside tap
  React.useEffect(() => {
    if (!filtersOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (!filterMenuRef.current?.contains(e.target as Node)) setFiltersOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [filtersOpen]);

  const activeFilterCount = (distanceFilter !== "all" ? 1 : 0) + (timeFilter !== "all" ? 1 : 0) + (selectedTags.length > 0 ? 1 : 0);

  const { lat, lng, loading: isLocating, error: locationError, requestLocation, clearLocation } = useGeolocation();

  // If initialLocal was set in URL, request location on mount
  React.useEffect(() => {
    if (initialLocal && !lat && !lng) {
      void requestLocation();
    }
  }, [initialLocal, lat, lng, requestLocation]);

  const triggerHaptic = useHaptic("light");

  const handleSelectCategory = React.useCallback(
    (categoryId: string | null) => {
      void triggerHaptic();
      setSelectedCategory(categoryId);
      setSelectedSub(null);
    },
    [triggerHaptic]
  );

  const activeFilters = React.useMemo<FeedFilters>(() => {
    const filters: FeedFilters = {};
    if (selectedCategory) {
      filters.category = selectedCategory;
      if (selectedSub) filters.subCategory = selectedSub;
    }
    if (timeFilter !== "all") {
      filters.timeFilter = timeFilter;
    }
    if (selectedTags.length > 0) {
      filters.tags = selectedTags;
    }
    if (distanceFilter !== "all" && lat != null && lng != null) {
      filters.lat = lat;
      filters.lng = lng;
      filters.radiusKm = distanceFilter;
    }
    return filters;
  }, [selectedCategory, selectedSub, timeFilter, selectedTags, distanceFilter, lat, lng]);

  return (
    <div className="space-y-7 pb-4">
      {/* ── Categories: App Store style icon shelf ── */}
      <section className="relative">
        <div className="mb-3 flex items-end justify-between px-5">
          <div>
            <h2 className="text-[22px] font-bold leading-none tracking-[-0.02em] text-white">
              {selectedCategory ? `${selectedSub ? 2 : 1} filter${selectedSub ? "s" : ""} applied` : "Browse by categories"}
            </h2>
            
          </div>
          {selectedCategory && (
            <button
              onClick={() => handleSelectCategory(null)}
              className="text-[15px] text-[#0A84FF] transition-opacity active:opacity-50"
            >
              Show All
            </button>
          )}
        </div>

        <div className="no-scrollbar flex snap-x snap-mandatory scroll-pl-5 gap-[18px] overflow-x-auto px-5 pb-2 pt-2">
          {categoryCards.map((cat, i) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleSelectCategory(isSelected ? null : cat.id)}
                style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                className="group flex w-[84px] shrink-0 snap-start flex-col items-center gap-2 text-center transition-transform duration-200 animate-in fade-in slide-in-from-right-4 fill-mode-both active:scale-90"
              >
                <span className="relative">
                  {/* App-icon squircle */}
                  <span
                    className={cn(
                      "flex h-[80px] w-[80px] items-center justify-center overflow-hidden rounded-[20px] border border-neutral-800 bg-[#111] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
                      "shadow-[inset_0_-2px_0_rgba(0,0,0,0.06),0_8px_20px_rgba(0,0,0,0.55)]",
                      isSelected ? "scale-[1.06] ring-[3px] ring-[#0A84FF] ring-offset-[3px] ring-offset-black" : "opacity-90 group-hover:opacity-100"
                    )}
                  >
                    <CategoryIcon
                      categoryId={cat.id}
                      style={iconPrefs.style}
                      variant={iconPrefs.picks[cat.id] ?? 0}
                      className={iconPrefs.style === "lucide" ? "h-10 w-10" : "h-[64px] w-[64px]"}
                    />
                  </span>
                  {isSelected && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-black bg-[#0A84FF] animate-in zoom-in-50 duration-200">
                      <Check className="h-3 w-3 text-white" strokeWidth={3.5} />
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    "line-clamp-1 w-full text-[12px] leading-tight tracking-[0.01em] transition-colors",
                    isSelected ? "font-semibold text-white" : "font-medium text-[#EBEBF5]/60"
                  )}
                >
                  {cat.name}
                </span>
              </button>
            );
          })}
        </div>

        {/* Sub categories of the selected main category */}
        {selectedParent && (
          <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto px-5">
            {[{ id: null as string | null, name: "All" }, ...selectedParent.subCategories].map((sub) => (
              <button
                key={sub.id ?? "all"}
                type="button"
                onClick={() => {
                  void triggerHaptic();
                  setSelectedSub(sub.id);
                }}
                className={cn(
                  "shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors",
                  selectedSub === sub.id ? "bg-white text-black" : "bg-[#1C1C1E] text-[#EBEBF5]/70",
                )}
              >
                {sub.name}
              </button>
            ))}
            <Link
              href={selectedSub ? `/niche/${selectedParent.id}/${selectedSub}` : `/niche/${selectedParent.id}`}
              className="shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold text-[#0A84FF]"
            >
              Browse providers →
            </Link>
          </div>
        )}
      </section>

      {/* ── Filters & Demands ── */}
      <div className="relative space-y-5 px-4">
        {/* Demands Tabs: floating liquid-glass segmented control, pinned while scrolling */}
        <HaloTabs className="w-full gap-4" defaultValue="all">
          <div className="relative z-50 -mb-1 flex items-center justify-between px-1">
            <h2 className="text-[22px] font-bold leading-none tracking-[-0.02em] text-white">Requests</h2>
            
          </div>
          <div className="sticky top-[max(env(safe-area-inset-top),0.5rem)] z-40 flex items-center gap-2">
             
            <HaloTabsList
              variant="pill"
              className="w-full rounded-full border border-white/[0.12] bg-[#1C1C1E]/0 p-1 shadow-[0_6px_20px_rgb(0_0_0/0.10),0_0_0_1px_rgb(0_0_0/0.04),inset_0_1px_0_rgb(255_255_255/0.8)] backdrop-blur-2xl backdrop-saturate-[1.8] dark:border-white/[0.12] dark:bg-[#1C1C1E]/0"
            >
              {TABS.map(({ id, label, icon: Icon }) => (
                <HaloTabsTrigger
                  value={id}
                  key={id}
                  className="min-h-[38px] max-h-none flex-1 gap-1.5 text-[14px] font-semibold tracking-[-0.01em] text-white/60 data-active:text-black "
                >
                  <Icon className="h-[16px] w-[16px]" strokeWidth={2.4} />
                  {label}
                </HaloTabsTrigger>
              ))}
              <HaloTabsIndicator
                variant="pill"
                className="rounded-full bg-white shadow-[0_4px_14px_rgba(255,255,255,0.18)] [&>span]:hidden"
              />
            </HaloTabsList>
          
            <div ref={filterMenuRef} className="relative">
              <button
                type="button"
                aria-label="Filters"
                aria-expanded={filtersOpen}
                onClick={() => {
                  void triggerHaptic();
                  setFiltersOpen((open) => !open);
                }}
                className={cn(
                  "relative rounded-full border border-white/[0.12] bg-[#1C1C1E]/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_12px_32px_rgba(0,0,0,0.6)] backdrop-blur-2xl backdrop-saturate-[1.8] dark:border-white/[0.12] dark:bg-[#1C1C1E]/70 ",
                  filtersOpen ? "bg-white text-black" : "bg-[#1C1C1E] text-white"
                )}
              >
                <SlidersHorizontal className="h-[16px] w-[16px]" strokeWidth={2.4} />
                {activeFilterCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-black bg-[#0A84FF] px-1 text-[10px] font-bold text-white">
                    {activeFilterCount}
                  </span>
                )}
              </button>
              {filtersOpen && (
                <div className="absolute right-0 top-[calc(100%+8px)] w-[min(340px,calc(100vw-2rem))] animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-150">
                <div className="overflow-hidden rounded-[14px] border border-white/[0.08] bg-[#1C1C1E] shadow-[0_16px_40px_rgba(0,0,0,0.7)]">
                  {/* Distance row */}
                  <div className="flex items-center gap-3 py-2.5 pl-4 pr-3">
                    <span className="flex h-[29px] w-[29px] shrink-0 items-center justify-center rounded-[7px] bg-[#30D158]">
                      <MapPin className="h-[17px] w-[17px] text-white" strokeWidth={2.4} />
                    </span>
                    <span className="shrink-0 text-[15px] text-white">Distance</span>
                    <div className="ml-auto flex items-center gap-2">
                      {isLocating && <Loader2 className="h-4 w-4 animate-spin text-[#EBEBF5]/60" />}
                      <div className={SEGMENT_TRACK}>
                        {(["all", 25, 50] as const).map((dist) => {
                          const isSelected = distanceFilter === dist;
                          return (
                            <button
                              key={String(dist)}
                              type="button"
                              disabled={isLocating}
                              onClick={async () => {
                                void triggerHaptic();
                                if (dist === "all") {
                                  setDistanceFilter("all");
                                } else {
                                  if (lat != null && lng != null) {
                                    setDistanceFilter(dist);
                                  } else {
                                    const coords = await requestLocation();
                                    if (coords) setDistanceFilter(dist);
                                  }
                                }
                              }}
                              className={cn(SEGMENT_ITEM, isSelected ? SEGMENT_ACTIVE : "text-white/80")}
                            >
                              {dist === "all" ? "All" : `${dist} km`}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="ml-[57px] h-px bg-[#545458]/60" />

                  {/* Posted row */}
                  <div className="flex items-center gap-3 py-2.5 pl-4 pr-3">
                    <span className="flex h-[29px] w-[29px] shrink-0 items-center justify-center rounded-[7px] bg-[#FF9F0A]">
                      <Clock className="h-[17px] w-[17px] text-white" strokeWidth={2.4} />
                    </span>
                    <span className="shrink-0 text-[15px] text-white">Posted</span>
                    <div className={cn(SEGMENT_TRACK, "ml-auto")}>
                      {[
                        { id: "all", label: "All" },
                        { id: "24h", label: "24h" },
                        { id: "2d", label: "2 days" },
                      ].map((item) => {
                        const isSelected = timeFilter === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              void triggerHaptic();
                              setTimeFilter(item.id as "all" | "24h" | "2d");
                            }}
                            className={cn(SEGMENT_ITEM, isSelected ? SEGMENT_ACTIVE : "text-white/80")}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="ml-[57px] h-px bg-[#545458]/60" />

                  {/* Tags row */}
                  <div className="space-y-2 py-2.5 pl-4 pr-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-[29px] w-[29px] shrink-0 items-center justify-center rounded-[7px] bg-[#0A84FF]">
                        <Tag className="h-[17px] w-[17px] text-white" strokeWidth={2.4} />
                      </span>
                      <span className="text-[15px] text-white">Tags</span>
                    </div>
                    <TagPicker value={selectedTags} onChange={setSelectedTags} subId={selectedSub} allowCustom />
                  </div>
                </div>
                </div>
              )}
            </div>
          </div>
          <HaloTabsContent value="all">
            <FeedList filters={activeFilters} />
          </HaloTabsContent>
          <HaloTabsContent value="swipe">
            <SwipeDemandDeck filters={activeFilters} />
          </HaloTabsContent>
          <HaloTabsContent value="saved">
            <BookmarksList />
          </HaloTabsContent>
        </HaloTabs>
      </div>
    </div>
  );
}
