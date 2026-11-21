"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, Clock, MapPin, MessageCircle, User, Wallet, X } from "lucide-react";
import type { DemandCardData } from "@/components/demand-card";
import { CountdownBadge } from "@/components/countdown-badge";
import { formatBudgetRange } from "@/lib/money";
import { cn } from "@/lib/utils";
import { DemandProviderProblems } from "@/components/category-flow/demand-provider-problems";
import { DemandStatsPanel } from "@/components/demand-stats-panel";
import { demandTypeLabel } from "@/lib/demand-type";
import { ScreenshotGuard } from "@/components/screenshot-guard";

export function DemandDetailSheet({ demand, onClose }: { demand: DemandCardData; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const budgetLabel = formatBudgetRange(demand.budgetMin, demand.budgetMax);
  const postedLabel = demand.createdAt
    ? new Date(demand.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
    : "Recently";
  const authorLabel = demand.author.companyName ?? demand.author.name;
  const typeLabel = demandTypeLabel(demand);

  return (
    <div
      className={cn("fixed inset-0 z-50 flex items-end justify-center transition-opacity sm:items-center", mounted ? "opacity-100" : "opacity-0")}
      role="dialog"
      aria-modal="true"
      aria-label="Request details"
    >
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <ScreenshotGuard className={cn(
        "relative w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl transition-transform duration-300 dark:bg-neutral-900 sm:rounded-3xl",
        mounted ? "translate-y-0" : "translate-y-8",
      )}>
        {/* <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 rounded-full p-1.5 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800">
          <X className="h-4 w-4" />
        </button> */}

        {typeLabel && <p className="mb-2 pr-8 text-xs font-semibold text-neutral-500">{typeLabel}</p>}

        {/* Category badge */}
        {demand.subCategoryName && (
          <div className="mb-2 flex flex-wrap gap-1">
            <span className="rounded-full bg-brand-500/10 px-2.5 py-0.5 text-xs font-semibold text-brand-600 dark:text-brand-400">
              {demand.categoryName ? `${demand.categoryName} › ${demand.subCategoryName}` : demand.subCategoryName}
            </span>
          </div>
        )}
        <DemandProviderProblems
          providerId={demand.categoryProviderId}
          problemIds={demand.categoryProblemIds}
          className="mb-3"
        />

        <p className="mb-3 text-base font-medium text-neutral-900 dark:text-neutral-100">{demand.summary}</p>

        {/* Media attachments */}
        {demand.mediaUrls && demand.mediaUrls.length > 0 && (
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            {demand.mediaUrls.map((url, i) => {
              const isVideo = /\.(mp4|webm|mov)(\?.*)?$/i.test(url);
              return (
                <div key={url} className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                  {isVideo ? (
                    <video src={url} controls className="h-full w-full object-cover" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt={`Media ${i + 1}`} className="h-full w-full object-cover" />
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="space-y-3 border-t border-neutral-200 pt-4 dark:border-neutral-800">
          <Row icon={User} label="Posted by" value={authorLabel} />
          <Row icon={MapPin} label="Location" value={demand.author.location ?? "Not specified"} />
          <Row icon={CalendarDays} label="Posted on" value={postedLabel} />
          <Row icon={Wallet} label="Budget" value={budgetLabel ?? "Not specified"} />
          <Row icon={Clock} label="Response spots filled" value={`${demand.bids.length}/3`} />
        </div>

        <Link
          href={`/demands/${demand.id}`}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-teal-700"
        >
          <MessageCircle className="h-4 w-4" aria-hidden /> Open chat
        </Link>

        <DemandStatsPanel demandId={demand.id} openedFromCard className="mt-5" />
      </ScreenshotGuard>
    </div>
  );
}

function Row({ icon: Icon, label, value }: { icon: typeof User; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <Icon className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
      <span className="w-24 shrink-0 text-neutral-500">{label}</span>
      <span className="font-medium text-neutral-900 dark:text-neutral-100">{value}</span>
    </div>
  );
}