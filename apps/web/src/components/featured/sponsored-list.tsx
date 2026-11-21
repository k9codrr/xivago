"use client";

import { useEffect } from "react";
import { DemandCard, type DemandCardData } from "@/components/demand-card";
import { trackFeatured } from "@/components/featured/track";

export interface SponsoredItem {
  placementId: string;
  displayRank: number;
  demand: DemandCardData;
}

/** Sponsored placements for one niche: #1 is the hero, the rest carry rank badges. */
export function SponsoredList({ items }: { items: SponsoredItem[] }) {
  useEffect(() => {
    for (const i of items) trackFeatured(i.placementId, "impression");
  }, [items]);

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-[22px] font-bold tracking-[-0.02em]">Featured</h2>
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#EBEBF5]/45">Sponsored</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {items.map((item) => (
          <div
            key={item.placementId}
            className={item.displayRank === 1 ? "relative col-span-2" : "relative"}
            onClickCapture={() => trackFeatured(item.placementId, "click")}
          >
            <span className="absolute left-2.5 top-10 z-20 rounded-full bg-[#FF9F0A] px-2 py-[3px] text-[10px] font-bold text-black shadow">
              #{item.displayRank} · Sponsored
            </span>
            <DemandCard demand={item.demand} />
          </div>
        ))}
      </div>
    </div>
  );
}
