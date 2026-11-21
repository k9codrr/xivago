"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, LocateFixed, SearchX } from "lucide-react";
import { cn } from "@/lib/utils";
import { DemandCard, type DemandCardData } from "@/components/demand-card";
import { useGeolocation } from "@/lib/use-geolocation";

type FilterParam = "sub" | "provider" | "problem";

/**
 * Every open demand in the niche, closest first once the user shares location.
 * `fixed` pins deeper levels (sub / provider / problem) for the category flow
 * pages; `filter` renders the chip row for the next level down.
 */
export function NicheDemands({
  nicheId,
  filter,
  fixed,
  initialFilterId = null,
  excludeIds,
}: {
  nicheId: string;
  filter?: { param: FilterParam; options: { id: string; name: string }[] };
  fixed?: Partial<Record<FilterParam, string>>;
  initialFilterId?: string | null;
  excludeIds: string[];
}) {
  const [selected, setSelected] = useState<string | null>(initialFilterId);
  const { lat, lng, loading: locating, requestLocation } = useGeolocation();

  const { data, isLoading } = useQuery({
    queryKey: ["niche-demands", nicheId, fixed, filter?.param, selected, lat, lng],
    queryFn: async (): Promise<DemandCardData[]> => {
      const params = new URLSearchParams();
      for (const [key, val] of Object.entries(fixed ?? {})) if (val) params.set(key, val);
      if (filter && selected) params.set(filter.param, selected);
      if (lat != null && lng != null) {
        params.set("lat", String(lat));
        params.set("lng", String(lng));
      }
      const res = await fetch(`/api/niches/${nicheId}/demands?${params}`);
      if (!res.ok) throw new Error("Could not load requests");
      return (await res.json()).demands;
    },
  });

  const exclude = new Set(excludeIds);
  const demands = (data ?? []).filter((d) => !exclude.has(d.id));
  const hasGeo = lat != null && lng != null;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[22px] font-bold tracking-[-0.02em]">{hasGeo ? "Closest to you" : "All requests"}</h2>
        {!hasGeo && (
          <button
            onClick={() => void requestLocation()}
            disabled={locating}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#0A84FF] px-3 py-1.5 text-[13px] font-semibold text-white disabled:opacity-60"
          >
            {locating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LocateFixed className="h-3.5 w-3.5" />}
            Sort by distance
          </button>
        )}
      </div>

      {filter && filter.options.length > 0 && (
        <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {[{ id: null, name: "All" }, ...filter.options].map((s) => (
            <button
              key={s.id ?? "all"}
              onClick={() => setSelected(s.id)}
              title={s.name}
              className={cn(
                "max-w-[16rem] shrink-0 truncate rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors",
                selected === s.id ? "bg-white text-black" : "bg-[#1C1C1E] text-[#EBEBF5]/70",
              )}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[#EBEBF5]/60" />
        </div>
      ) : demands.length === 0 ? (
        <div className="rounded-[20px] bg-[#1C1C1E] px-8 py-10 text-center">
          <SearchX className="mx-auto mb-3 h-6 w-6 text-[#EBEBF5]/60" />
          <p className="text-[15px] font-semibold">No open requests here yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {demands.map((d) => (
            <DemandCard key={d.id} demand={d} />
          ))}
        </div>
      )}
    </div>
  );
}
