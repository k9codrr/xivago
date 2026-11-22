// "use client";

// import Link from "next/link";
// import { ArrowRight, MapPin, Wallet, Clock } from "lucide-react";
// import { CountdownBadge } from "@/components/countdown-badge";
// import { PriorityBadge } from "@/components/priority-badge";
// import { SlotStrip } from "@/components/slot-strip";
// import { formatBudgetRange } from "@/lib/money";
// import { cn } from "@/lib/utils";

// export interface DemandCardData {
//   id: string;
//   summary: string;
//   budgetMin: number | null;
//   budgetMax: number | null;
//   timelineEnd: string;
//   status: string;
//   createdAt?: string;
//   isPriority: boolean;
//   shareContact: boolean;
//   categoryParentId?: string | null;
//   categorySubId?: string | null;
//   categoryName?: string | null;
//   subCategoryName?: string | null;
//   selectedTechInputs?: Record<string, any> | null;
//   mediaUrls?: string[];
//   author: {
//     id: string;
//     name: string;
//     avatarUrl: string | null;
//     companyName: string | null;
//     location: string | null;
//   };
//   bids: Array<{ slot: number; bidder: { id: string; name: string; avatarUrl: string | null } }>;
// }

// function initials(name: string): string {
//   return name
//     .split(" ")
//     .map((p) => p[0])
//     .slice(0, 2)
//     .join("")
//     .toUpperCase();
// }

// export function DemandCard({ demand }: { demand: DemandCardData }) {
//   const budgetLabel = formatBudgetRange(demand.budgetMin, demand.budgetMax);
//   const isOpen = demand.status === "OPEN";
//   const displayName = demand.author.companyName ?? demand.author.name;

//   return (
//     <div
//       className={cn(
//         "group relative overflow-hidden rounded-2xl border bg-white transition-all duration-200",
//         "hover:-translate-y-0.5 hover:shadow-md hover:shadow-neutral-900/5",
//         "dark:bg-neutral-900",
//         demand.isPriority
//           ? "border-amber-200 dark:border-amber-900/50"
//           : "border-neutral-200 hover:border-neutral-300 dark:border-neutral-800 dark:hover:border-neutral-700",
//         !isOpen && "opacity-60",
//       )}
//     >
//       {/* Priority accent bar on the left edge */}
//       {demand.isPriority && (
//         <span className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-amber-400 to-amber-500" />
//       )}

//       <div className={cn("p-4", demand.isPriority && "pl-5")}>
//         {/* ── Top row: author identity + badges ── */}
//         <div className="mb-2.5 flex items-start justify-between gap-3">
//           <Link
//             href={`/u/${demand.author.id}`}
//             className="flex min-w-0 items-center gap-2.5"
//             onClick={(e) => e.stopPropagation()}
//           >
//             {demand.author.avatarUrl ? (
//               // eslint-disable-next-line @next/next/no-img-element
//               <img
//                 src={demand.author.avatarUrl}
//                 alt={displayName}
//                 className="h-9 w-9 shrink-0 rounded-full bg-neutral-100 object-cover dark:bg-neutral-800"
//               />
//             ) : (
//               <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-bold text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
//                 {initials(displayName)}
//               </span>
//             )}
//             <div className="min-w-0 leading-tight">
//               <p className="truncate text-sm font-semibold text-neutral-900 group-hover:text-brand-600 dark:text-neutral-100 dark:group-hover:text-brand-400">
//                 {displayName}
//               </p>
//               <p className="truncate text-xs text-neutral-400">{demand.author.name}</p>
//             </div>
//           </Link>

//           <div className="flex shrink-0 items-center gap-1.5">
//             {demand.isPriority && <PriorityBadge />}
//             <CountdownBadge timelineEnd={demand.timelineEnd} />
//           </div>
//         </div>

//         {/* ── Category badge if set ── */}
//         {demand.subCategoryName && (
//           <div className="mb-2 flex flex-wrap gap-1">
//             <span className="rounded-full bg-brand-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-brand-600 dark:text-brand-400">
//               {demand.categoryName ? `${demand.categoryName} › ${demand.subCategoryName}` : demand.subCategoryName}
//             </span>
//           </div>
//         )}

//         {/* ── Summary — the clickable core ── */}
//         <Link href={`/demands/${demand.id}`} className="block">
//           <p className="mb-3 line-clamp-3 text-[15px] font-medium leading-relaxed text-neutral-900 dark:text-neutral-100">
//             {demand.summary}
//           </p>
//         </Link>

//         {/* ── Media previews if present ── */}
//         {demand.mediaUrls && demand.mediaUrls.length > 0 && (
//           <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
//             {demand.mediaUrls.map((url, i) => {
//               const isVideo = /\.(mp4|webm|mov)(\?.*)?$/i.test(url);
//               return (
//                 <div key={url} className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-800">
//                   {isVideo ? (
//                     <video src={url} className="h-full w-full object-cover" muted />
//                   ) : (
//                     // eslint-disable-next-line @next/next/no-img-element
//                     <img src={url} alt={`Attachment ${i + 1}`} className="h-full w-full object-cover" />
//                   )}
//                 </div>
//               );
//             })}
//           </div>
//         )}

//         {/* ── Meta chips row ── */}
//         <div className="mb-3 flex flex-wrap items-center gap-1.5">
//           {budgetLabel && (
//             <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
//               <Wallet className="h-3 w-3" /> {budgetLabel}
//             </span>
//           )}
//           {demand.author.location && (
//             <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
//               <MapPin className="h-3 w-3" /> {demand.author.location}
//             </span>
//           )}
//           {!isOpen && (
//             <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-400 dark:bg-neutral-800">
//               <Clock className="h-3 w-3" /> Closed
//             </span>
//           )}
//         </div>

//         {/* <SlotStrip demandId={demand.id} bids={demand.bids} disabled={!isOpen} /> */}

//         {/* ── Footer action ── */}
//         <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3 dark:border-neutral-800">
//           <Link
//             href={`/demands/${demand.id}`}
//             className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 transition-colors hover:text-brand-700 dark:text-brand-400"
//           >
//             View demand
//             <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
//           </Link>
//           <span className="text-xs text-neutral-400">
//             {demand.bids.length > 0
//               ? `${demand.bids.length} slot${demand.bids.length > 1 ? "s" : ""} taken`
//               : "No bids yet"}
//           </span>
//         </div>
//       </div>
//     </div>
//   );
// }

"use client";

import { ScreenshotGuard } from "@/components/screenshot-guard";

import Link from "next/link";
import { useState } from "react";
import { X, MapPin, Wallet, Clock, ChevronRight, ChevronDown, ImageIcon } from "lucide-react";
import type { CardLayout } from "@/lib/card-layout";
import { CountdownBadge } from "@/components/countdown-badge";
import { PriorityBadge } from "@/components/priority-badge";
import { formatBudgetRange } from "@/lib/money";
import { withPriceUnit } from "@/lib/price-units";
import { serviceAreaLabel } from "@/lib/service-area";
import { cn } from "@/lib/utils";
import {
  FamilyDrawerAnimatedContent,
  FamilyDrawerAnimatedWrapper,
  FamilyDrawerClose,
  FamilyDrawerContent,
  FamilyDrawerHandle,
  FamilyDrawerOverlay,
  FamilyDrawerPortal,
  FamilyDrawerRoot,
  FamilyDrawerTitle,
  FamilyDrawerTrigger,
  FamilyDrawerViewContent,
  LIQUID_GLASS_SHEET,
  useFamilyDrawer,
} from "@/components/ui/family-drawer";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"

import { SlotStrip } from "@/components/slot-strip";
import { TierMark } from "@/components/tier-mark";
import type { TrustTierCode } from "@/lib/trust-labels";
import { calculateSlotPrice } from "@/lib/slot-pricing";
import { describeDemandCategory } from "@/lib/category-selection";
import { TagChips } from "@/components/category-flow/chips";
import { DemandStatsPanel } from "@/components/demand-stats-panel";
import { demandTypeLabel } from "@/lib/demand-type";

export interface DemandCardData {
  id: string;
  postType?: "PROMOTE" | "REQUIREMENT";
  requirementRole?: { id: string; name: string } | null;
  summary: string;
  budgetMin: number | null;
  budgetMax: number | null;
  timelineEnd: string;
  status: string;
  createdAt?: string;
  isPriority: boolean;
  shareContact: boolean;
  maxSlots?: number | null;
  categoryParentId?: string | null;
  categorySubId?: string | null;
  categoryName?: string | null;
  subCategoryName?: string | null;
  categoryProviderId?: string | null;
  categoryProblemIds?: string[];
  tags?: string[];
  selectedTechInputs?: Record<string, unknown> | null;
  mediaUrls?: string[];
  lat?: number | null;
  lng?: number | null;
  /** Place picked when posting (e.g. "Koramangala, Bengaluru"). */
  locationName?: string | null;
  /** Offers: how the price is charged and where the service is available. */
  priceUnit?: string | null;
  serviceAreaType?: string | null;
  serviceAreas?: unknown;
  serviceRadiusKm?: number | null;
  serviceOnline?: boolean | null;
  distanceKm?: number | null;
  /** The viewer has no slot on this demand, so the server sent no identity in `author`. */
  authorHidden?: boolean;
  author: {
    id: string;
    name: string;
    avatarUrl: string | null;
    companyName: string | null;
    location: string | null;
    trust?: Array<{ tier: TrustTierCode }>;
  };
  bids: Array<{ slot: number; bidder: { id: string; name: string; avatarUrl: string | null } }>;
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const isVideoUrl = (url: string) => /\.(mp4|webm|mov)(\?.*)?$/i.test(url);

/* Rich fallback artwork for demands without media, picked deterministically per id */
const FALLBACK_GRADIENTS = [
  "from-[#0A84FF] via-[#5E5CE6] to-[#1C1C1E]",
  "from-[#BF5AF2] via-[#FF375F] to-[#1C1C1E]",
  "from-[#30D158] via-[#0A84FF] to-[#1C1C1E]",
  "from-[#FF9F0A] via-[#FF375F] to-[#1C1C1E]",
  "from-[#64D2FF] via-[#5E5CE6] to-[#1C1C1E]",
  "from-[#FFD60A] via-[#FF9F0A] to-[#1C1C1E]",
];

function fallbackGradient(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return FALLBACK_GRADIENTS[h % FALLBACK_GRADIENTS.length] ?? FALLBACK_GRADIENTS[0]!;
}

/* ══════════════════════ COMPACT CARD (2-col grid) ══════════════════════ */
function CompactCard({ demand, onOpen }: { demand: DemandCardData; onOpen?: () => void }) {
  const budgetLabel = withPriceUnit(formatBudgetRange(demand.budgetMin, demand.budgetMax), demand.priceUnit);
  const isOpen = demand.status === "OPEN";
  const displayName = demand.author.companyName ?? demand.author.name;
  const cover = demand.mediaUrls?.[0];
  const maxSlots = demand.maxSlots ?? 3;
  const filled = Math.min(demand.bids.length / maxSlots, 1);
  const typeLabel = demandTypeLabel(demand);

  return (
    <DrawerTrigger
      className={cn(
        "group relative flex aspect-[3/4.4] h-auto w-full flex-col justify-between overflow-hidden rounded-[22px] bg-[#1C1C1E] p-0 text-left",
        "shadow-[0_18px_40px_-12px_rgba(0,0,0,0.85)] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.96]",
        "animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500",
        !isOpen && "opacity-55 saturate-50",
      )}
    >
      {/* ── Artwork ── */}
      <div className="absolute inset-0">
        {cover ? (
          isVideoUrl(cover) ? (
            <video src={cover} className="h-full w-full object-cover" muted playsInline preload="metadata" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105" />
          )
        ) : (
          <div className={cn("relative h-full w-full bg-gradient-to-br", fallbackGradient(demand.id))}>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_55%)]" />
            {!demand.authorHidden && (
              <span className="absolute right-3 top-12 text-[64px] font-bold leading-none tracking-[-0.05em] text-white/15">
                {initials(displayName)}
              </span>
            )}
          </div>
        )}
        <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/45 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-[68%] bg-gradient-to-t from-black via-black/80 to-transparent" />
      </div>

      {/* hairline edge + priority glow */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-10 rounded-[22px]",
          demand.isPriority
            ? "shadow-[inset_0_0_0_1.5px_rgba(255,159,10,0.75),inset_0_0_24px_rgba(255,159,10,0.25)]"
            : "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08),inset_0_1px_0_rgba(255,255,255,0.15)]",
        )}
      />

      {/* ── Top: countdown + media count ── */}
      <div className="relative z-10 flex items-start justify-between gap-1 p-2.5">
        <div className="[&>span]:border [&>span]:border-white/15 [&>span]:bg-black/35 [&>span]:px-2 [&>span]:py-[3px] [&>span]:text-[10px] [&>span]:font-semibold [&>span]:text-white [&>span]:backdrop-blur-xl">
          <CountdownBadge timelineEnd={demand.timelineEnd} />
        </div>
        {demand.mediaUrls && demand.mediaUrls.length > 1 && (
          <span className="rounded-full border border-white/15 bg-black/35 px-2 py-[3px] text-[10px] font-semibold text-white backdrop-blur-xl">
            +{demand.mediaUrls.length - 1}
          </span>
        )}
      </div>

      {/* ── Bottom: content ── */}
      <div className="relative z-10 p-3">
        <div className="mb-1.5 flex min-w-0 items-center gap-1.5">
          {demand.author.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={demand.author.avatarUrl} alt="" className="h-[18px] w-[18px] shrink-0 rounded-full object-cover ring-1 ring-white/30" />
          ) : (
            <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-white/20 text-[8px] font-bold text-white backdrop-blur">
              {initials(displayName)}
            </span>
          )}
          <span className="truncate text-[11px] font-medium text-white/70">{displayName}</span>
          {demand.isPriority && (
            <span className="ml-auto shrink-0 [&>span]:bg-[#FF9F0A] [&>span]:px-1.5 [&>span]:py-[1px] [&>span]:text-[9px] [&>span]:text-black [&_svg]:h-2.5 [&_svg]:w-2.5 [&_svg]:fill-black [&_svg]:text-black">
              <PriorityBadge />
            </span>
          )}
        </div>

        <p className="line-clamp-2 text-[14.5px] font-semibold leading-[1.22] tracking-[-0.015em] text-white">
          {demand.summary}
        </p>

        {(typeLabel || demand.subCategoryName || demand.distanceKm != null) && (
          <p className="mt-1 flex min-w-0 items-center gap-1 text-[11px] font-medium text-white/55">
            {typeLabel && <span className="shrink-0 font-semibold text-white/85">{typeLabel}</span>}
            {typeLabel && (demand.distanceKm != null || demand.subCategoryName) && <span className="shrink-0">·</span>}
            {demand.distanceKm != null && (
              <span className="inline-flex shrink-0 items-center gap-0.5 text-[#30D158]">
                <MapPin className="h-2.5 w-2.5" /> {demand.distanceKm} km
              </span>
            )}
            {demand.distanceKm != null && demand.subCategoryName && <span className="shrink-0">·</span>}
            {demand.subCategoryName && <span className="truncate">{demand.subCategoryName}</span>}
          </p>
        )}

        {/* price + budget */}
        <div className="mt-2.5 flex items-center justify-between gap-1.5">
          {budgetLabel ? (
            <span className="truncate text-[12px] font-semibold text-[#30D158]">{budgetLabel}</span>
          ) : !isOpen ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-white/55">
              <Clock className="h-2.5 w-2.5" /> Closed
            </span>
          ) : (
            <span />
          )}
          {/* <span className="shrink-0 rounded-full bg-white px-2.5 py-[5px] text-[11px] font-bold tracking-[-0.01em] text-black shadow-[0_4px_12px_rgba(255,255,255,0.2)]">
            ₹{calculateSlotPrice(demand.budgetMax, demand.budgetMin).rupees}
          </span> */}
        </div>

        {/* slot progress */}
        <div className="mt-2.5 flex items-center gap-2">
          <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-white transition-[width] duration-700" style={{ width: `${filled * 100}%` }} />
          </div>
          <span className="shrink-0 text-[10px] font-medium tabular-nums text-white/55">
            {demand.bids.length}/{maxSlots}
          </span>
        </div>
      </div>
    </DrawerTrigger>
  );
}

/* ══════════════════════ PROFILE CARD (2-col grid, photo + footer) ══════════════════════ */
function ProfileCard({ demand }: { demand: DemandCardData }) {
  const budgetLabel = withPriceUnit(formatBudgetRange(demand.budgetMin, demand.budgetMax), demand.priceUnit);
  const isOpen = demand.status === "OPEN";
  const displayName = demand.author.companyName ?? demand.author.name;
  const cover = demand.mediaUrls?.[0];
  const maxSlots = demand.maxSlots ?? 3;
  const typeLabel = demandTypeLabel(demand);
  const subtitle = demand.subCategoryName ?? demand.categoryName ?? typeLabel;
  const area = demand.serviceAreaType && demand.serviceAreaType !== "NEARBY" ? serviceAreaLabel(demand, 1) : null;
  const place =
    area ??
    (demand.distanceKm != null
      ? `${demand.distanceKm} km away${demand.locationName ? ` · ${demand.locationName}` : ""}`
      : (demand.locationName ?? demand.author.location));
  const slotPrice = calculateSlotPrice(demand.budgetMax, demand.budgetMin).rupees;

  return (
    <DrawerTrigger
      className={cn(
        "group border-none relative flex h-auto w-full flex-col overflow-hidden bg-transparent p-0 text-left",
        "transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.97]",
        "animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500",
      )}
    >
      {/* ── Photo ── */}
      <div className={cn("relative aspect-[1/1.08] w-full overflow-hidden rounded-lg")}>
        {cover ? (
          isVideoUrl(cover) ? (
            <video src={cover} className="h-full w-full object-cover" muted playsInline preload="metadata" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105" />
          )
        ) : demand.author.avatarUrl && !demand.authorHidden ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={demand.author.avatarUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className={cn("relative h-full w-full bg-gradient-to-br", fallbackGradient(demand.id))}>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_55%)]" />
            {!demand.authorHidden && (
              <span className="absolute inset-0 flex items-center justify-center text-[56px] font-bold tracking-[-0.05em] text-white/25">
                {initials(displayName)}
              </span>
            )}
          </div>
        )}
        <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-black/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/70 to-transparent" />

        <div className="absolute inset-x-2 top-2 flex items-start justify-between gap-1">
          <span className="[&>span]:border [&>span]:border-white/15 [&>span]:bg-black/35 [&>span]:px-2 [&>span]:py-[3px] [&>span]:text-[10px] [&>span]:font-semibold [&>span]:text-white [&>span]:backdrop-blur-xl">
            <CountdownBadge timelineEnd={demand.timelineEnd} />
          </span>
          {demand.isPriority && (
            <span className="shrink-0 [&>span]:bg-[#FF9F0A] [&>span]:px-1.5 [&>span]:py-[1px] [&>span]:text-[9px] [&>span]:text-black [&_svg]:h-2.5 [&_svg]:w-2.5 [&_svg]:fill-black [&_svg]:text-black">
              <PriorityBadge />
            </span>
          )}
        </div>

        {place && (
          <span className="absolute bottom-2 left-2 right-2 flex min-w-0 items-center gap-1 text-[10.5px] font-semibold text-white">
            <MapPin className="h-2.5 w-2.5 shrink-0 text-[#30D158]" />
            <span className="truncate">{place}</span>
          </span>
        )}
      </div>

      {/* ── Identity ── */}
      <div className="px-1.5 pt-2">
        <p className="flex min-w-0 items-center gap-1 text-[14px] font-semibold leading-tight tracking-[-0.01em] text-white">
          <span className="truncate">{demand.summary}</span>
        </p>
        <p className="mt-0.5 flex min-w-0 items-center gap-1 text-[11.5px] text-white/55">
          <span className="truncate">{demand.authorHidden ? subtitle ?? "Request" : displayName}</span>
          {!demand.authorHidden && <TierMark tier={demand.author.trust?.[0]?.tier} className="shrink-0" />}
        </p>

        {/* bidders + slot count, like "9 in common" */}
        <div className="mt-1.5 flex items-center gap-1.5">
          <span className="flex -space-x-1.5">
            {Array.from({ length: maxSlots }).map((_, i) => {
              const bid = demand.bids[i];
              return bid?.bidder.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={bid.bidder.avatarUrl} alt="" className="h-4 w-4 rounded-full object-cover ring-2 ring-[#1C1C1E]" />
              ) : (
                <span
                  key={i}
                  className={cn("h-4 w-4 rounded-full ring-2 ring-[#1C1C1E]", bid ? "bg-[#0A84FF]" : "bg-white/15")}
                />
              );
            })}
          </span>
          <span className="truncate text-[11px] font-medium text-white/70">
            {demand.bids.length}/{maxSlots} slots
            {budgetLabel && <span className="text-[#30D158]"> · {budgetLabel}</span>}
          </span>
        </div>
      </div>

      {/* ── Actions (visual only: the whole card opens the sheet) ── */}
      <div className="mt-2 flex items-center gap-1.5">
        <span className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[12px] bg-white/[0.09] text-[13px] font-semibold text-white">
          {isOpen ? <>Bid · ₹{slotPrice}</> : <><Clock className="h-3.5 w-3.5" /> Closed</>}
        </span>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-white/[0.09] text-white/80">
          <ChevronDown className="h-4 w-4" />
        </span>
      </div>
    </DrawerTrigger>
  );
}

/** The poster's profile link, or plain content when their identity is hidden. */
function AuthorLink({ demand, className, children }: { demand: DemandCardData; className: string; children: React.ReactNode }) {
  if (demand.authorHidden) return <div className={className}>{children}</div>;
  return (
    <Link href={`/u/${demand.author.id}`} className={className} onClick={(e) => e.stopPropagation()}>
      {children}
    </Link>
  );
}

/* ══════════════════════ FULL DETAIL SHEET ══════════════════════ */
function DetailSheet({ demand, onClose }: { demand: DemandCardData; onClose?: () => void }) {
  const budgetLabel = withPriceUnit(formatBudgetRange(demand.budgetMin, demand.budgetMax), demand.priceUnit);
  const isOpen = demand.status === "OPEN";
  const displayName = demand.author.companyName ?? demand.author.name;
  const { provider, problems } = describeDemandCategory(demand.categoryProviderId, demand.categoryProblemIds);
  const providerName = provider?.name;
  const typeLabel = demandTypeLabel(demand);

  return (
    <FamilyDrawerPortal>
      <FamilyDrawerOverlay className="z-[55]" />
      {/* Only the handle, X or Escape close this, so taps and swipes in the sheet can't dismiss it. */}
      <FamilyDrawerContent
        disableOutsideDismiss
        className={cn("z-[60] flex max-h-[86dvh] min-h-[85dvh] w-full flex-col overflow-hidden mb-3 text-white sm:mb-4 sm:max-w-md", LIQUID_GLASS_SHEET)}
      >
      <FamilyDrawerTitle className="sr-only">{demand.summary}</FamilyDrawerTitle>
      <div className="relative h-[30px] shrink-0 px-4 pt-3">
        <FamilyDrawerHandle className="!h-1.5 !w-12 !bg-white/30 !opacity-100" />
        {/* <FamilyDrawerClose className="right-4 top-2 h-9 w-9 border border-white/10 bg-white/[0.08]">
          <X className="h-4 w-4 text-neutral-300" />
        </FamilyDrawerClose> */}
      </div>
      {/* scrollable content */}
      <ScreenshotGuard className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 pb-8 pt-2">
        {/* ── author block ── */}
        <div className="flex items-center justify-between gap-3">
          <AuthorLink demand={demand} className="flex min-w-0 items-center gap-3 transition-opacity active:opacity-60">
            {demand.author.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={demand.author.avatarUrl} alt={displayName} className="h-11 w-11 shrink-0 rounded-full bg-white/[0.08] object-cover" />
            ) : (
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#0A84FF]/20 text-sm font-semibold text-[#0A84FF]">
                {initials(displayName)}
              </span>
            )}
            <div className="min-w-0 leading-tight">
              <p className="truncate text-[17px] font-semibold tracking-[-0.01em] text-white">
                {displayName}
                <TierMark tier={demand.author.trust?.[0]?.tier} className="ml-1.5 align-middle" />
              </p>
              <p className="truncate text-[13px] text-[#EBEBF5]/60">
                {demand.authorHidden ? "Take a response spot to see who posted" : demand.author.name}
              </p>
            </div>
          </AuthorLink>
          <div className="flex shrink-0 items-center gap-1.5 [&>span]:bg-[#767680]/25 [&>span]:text-white/85">
            {demand.isPriority && <PriorityBadge />}
            <CountdownBadge timelineEnd={demand.timelineEnd} />
          </div>
        </div>

        {/* ── category + summary ── */}
        <div>
          {typeLabel && <p className="mb-1 text-[13px] font-semibold text-white/85">{typeLabel}</p>}
          {demand.subCategoryName && (
            <p className="mb-1.5 text-[13px] font-semibold uppercase tracking-[0.04em] text-[#0A84FF]">
              {demand.categoryName ? `${demand.categoryName} › ${demand.subCategoryName}` : demand.subCategoryName}
              {providerName && ` › ${providerName}`}
            </p>
          )}
          <p className="text-[20px] font-semibold leading-[1.3] tracking-[-0.015em] text-white">
            {demand.summary}
          </p>
          {problems.length > 0 && (
            <ul className="mt-3 space-y-2">
              {problems.map((problem) => (
                <li key={problem.id} className="text-[14px] text-white/80">
                  {problem.title}
                  <TagChips tags={problem.tags} tone="dark" className="mt-1" />
                </li>
              ))}
            </ul>
          )}
        </div>

        {demand.tags && demand.tags.length > 0 && <TagChips tags={demand.tags} tone="dark" />}

        {/* ── all media ── */}
        {demand.mediaUrls && demand.mediaUrls.length > 0 && (
          <div className="grid grid-cols-3 gap-1.5 overflow-hidden rounded-[16px]">
            {demand.mediaUrls.map((url, i) => (
              <div key={url} className="aspect-square overflow-hidden rounded-[10px] bg-white/[0.08]">
                {isVideoUrl(url) ? (
                  <video src={url} controls muted className="h-full w-full object-cover" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt={`Attachment ${i + 1}`} className="h-full w-full object-cover" />
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── details: inset grouped list ── */}
        <div>
          <p className="mb-1.5 px-4 text-[13px] uppercase tracking-[0.02em] text-[#EBEBF5]/60">Details</p>
          <div className="divide-y divide-white/10 overflow-hidden rounded-[14px] bg-white/[0.08]">
            {budgetLabel && (
              <div className="flex items-center justify-between px-4 py-3 text-[15px]">
                <span className="flex items-center gap-2.5 text-white"><Wallet className="h-4 w-4 text-[#30D158]" /> Budget</span>
                <span className="text-[#EBEBF5]/60">{budgetLabel}</span>
              </div>
            )}
            {(serviceAreaLabel(demand) || demand.locationName || demand.author.location) && (
              <div className="flex items-center justify-between gap-4 px-4 py-3 text-[15px]">
                <span className="flex shrink-0 items-center gap-2.5 text-white">
                  <MapPin className="h-4 w-4 text-[#0A84FF]" /> {serviceAreaLabel(demand) ? "Serves" : "Location"}
                </span>
                <span className="truncate text-[#EBEBF5]/60">
                  {serviceAreaLabel(demand, 3) ?? demand.locationName ?? demand.author.location}
                </span>
              </div>
            )}
            {demand.createdAt && (
              <div className="flex items-center justify-between px-4 py-3 text-[15px]">
                <span className="flex items-center gap-2.5 text-white"><Clock className="h-4 w-4 text-[#FF9F0A]" /> Posted</span>
                <span className="text-[#EBEBF5]/60">{new Date(demand.createdAt).toLocaleDateString()}</span>
              </div>
            )}
            {!isOpen && (
              <div className="flex items-center justify-between px-4 py-3 text-[15px]">
                <span className="flex items-center gap-2.5 text-white"><Clock className="h-4 w-4 text-[#EBEBF5]/60" /> Status</span>
                <span className="text-[#EBEBF5]/60">Closed</span>
              </div>
            )}
          </div>
        </div>

        {/* ── tech inputs ── */}
        {demand.selectedTechInputs && Object.keys(demand.selectedTechInputs).length > 0 && (
          <div>
            <p className="mb-1.5 px-4 text-[13px] uppercase tracking-[0.02em] text-[#EBEBF5]/60">Specifications</p>
            <dl className="divide-y divide-white/10 overflow-hidden rounded-[14px] bg-white/[0.08]">
              {Object.entries(demand.selectedTechInputs).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 px-4 py-3 text-[15px]">
                  <dt className="text-white">{k}</dt>
                  <dd className="text-right text-[#EBEBF5]/60">{String(v)}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {/* ── bids & slot strip ── */}
        <div>
          <div className="mb-1.5 flex items-center justify-between px-4">
            <p className="text-[13px] uppercase tracking-[0.02em] text-[#EBEBF5]/60">
              Bids · {demand.bids.length} of {demand.maxSlots ?? 3}
            </p>
            <span className="text-[13px] font-semibold text-[#FF9F0A]">
              ₹{calculateSlotPrice(demand.budgetMax, demand.budgetMin).rupees} / slot
            </span>
          </div>
          <div className="rounded-[14px] bg-white/[0.08] p-3">
            <SlotStrip
              demandId={demand.id}
              bids={demand.bids}
              maxSlots={demand.maxSlots ?? 3}
              budgetMax={demand.budgetMax}
              budgetMin={demand.budgetMin}
              disabled={!isOpen}
            />
          </div>
        </div>

        {/* ── CTA ── */}
        <Link
          href={`/demands/${demand.id}`}
          onClick={onClose}
          className={cn(
            "flex h-[50px] w-full items-center justify-center gap-1 rounded-[14px] bg-[#0A84FF] text-[17px] font-semibold tracking-[-0.01em] text-white transition-opacity active:opacity-70",
            !isOpen && "pointer-events-none bg-[#3A3A3C] text-[#EBEBF5]/45",
          )}
        >
          View Full Demand <ChevronRight className="h-5 w-5" />
        </Link>

        <DemandStatsPanel demandId={demand.id} openedFromCard tone="glass" />
      </div>
      </ScreenshotGuard>
      </FamilyDrawerContent>
    </FamilyDrawerPortal>
  );
}

/* ══════════════════════ MAIN EXPORT ══════════════════════ */
export function DemandCard({ demand, layout = "classic" }: { demand: DemandCardData; layout?: CardLayout }) {
  // Controlled so "View Full Demand" can close the sheet as it navigates.
  const [sheetOpen, setSheetOpen] = useState(false);
  return (
    <FamilyDrawerRoot handleOnly open={sheetOpen} onOpenChange={setSheetOpen}>
      {layout === "profile" ? <ProfileCard demand={demand} /> : <CompactCard demand={demand} />}
      <DetailSheet demand={demand} onClose={() => setSheetOpen(false)} />
    </FamilyDrawerRoot>
  );
}