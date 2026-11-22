import { infiniteQueryOptions } from "@tanstack/react-query";
import type { DemandCardData } from "@/components/demand-card";

export interface FeedPage {
  demands: DemandCardData[];
  nextCursor: string | null;
}

export interface FeedFilters {
  category?: string | null;
  subCategory?: string | null;
  provider?: string | null;
  problem?: string | null;
  tags?: string[] | null;
  lat?: number | null;
  lng?: number | null;
  radiusKm?: number | "all" | null;
  timeFilter?: "24h" | "2d" | "all" | null;
  q?: string | null;
  /** Fresh per visit to the "All" feed: rotates which (max 6) featured posts sit on top. */
  seed?: string | null;
}

/** A new random feed seed, e.g. "k3j9x2ab". */
export function newFeedSeed(): string {
  return Math.random().toString(36).slice(2, 10).padEnd(8, "0");
}

export async function fetchFeedPage(
  cursor: string | null,
  filters: FeedFilters = {}
): Promise<FeedPage> {
  const url = new URL("/api/demands", window.location.origin);
  if (cursor) url.searchParams.set("cursor", cursor);
  if (filters.category) url.searchParams.set("category", filters.category);
  if (filters.subCategory) url.searchParams.set("subCategory", filters.subCategory);
  if (filters.provider) url.searchParams.set("provider", filters.provider);
  if (filters.problem) url.searchParams.set("problem", filters.problem);
  if (filters.tags?.length) url.searchParams.set("tags", filters.tags.join(","));
  if (filters.lat != null) url.searchParams.set("lat", filters.lat.toString());
  if (filters.lng != null) url.searchParams.set("lng", filters.lng.toString());
  if (filters.radiusKm != null) url.searchParams.set("radiusKm", filters.radiusKm.toString());
  if (filters.timeFilter) url.searchParams.set("timeFilter", filters.timeFilter);
  if (filters.q) url.searchParams.set("q", filters.q);
  if (filters.seed) url.searchParams.set("seed", filters.seed);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Failed to load feed");
  return res.json();
}

export function demandsFeedQueryOptions(filters: FeedFilters = {}) {
  return infiniteQueryOptions({
    queryKey: ["demands-feed", filters],
    queryFn: ({ pageParam }) => fetchFeedPage(pageParam, filters),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}