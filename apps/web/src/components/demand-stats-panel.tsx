"use client";

import { useEffect, useRef, useState } from "react";
import { Bookmark, CalendarDays, Eye, MessageCircle, MousePointerClick, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface DemandStats {
  views: number;
  uniqueViewers: number;
  viewsToday: number;
  cardClicks: number;
  saves: number;
  chats: number;
}

const ANON_ID_KEY = "xivago-viewer-id";

/** A random id for this device, so a signed-out viewer counts once a day. Null if storage is blocked. */
function getAnonId(): string | null {
  try {
    let id = localStorage.getItem(ANON_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(ANON_ID_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

const TILES = [
  { key: "views", label: "Views", icon: Eye },
  { key: "uniqueViewers", label: "Viewers", icon: Users },
  { key: "viewsToday", label: "Today", icon: CalendarDays },
  { key: "cardClicks", label: "Card clicks", icon: MousePointerClick },
  { key: "saves", label: "Saves", icon: Bookmark },
  { key: "chats", label: "Chats", icon: MessageCircle },
] as const;

interface DemandStatsPanelProps {
  demandId: string;
  /** True when the panel opened because someone tapped this demand's card. */
  openedFromCard?: boolean;
  /** "glass" for the dark detail sheet, "page" for a page that follows the theme. */
  tone?: "glass" | "page";
  className?: string;
}

/** Counts this open as a view (and card click, if any), then shows the demand's statistics. */
export function DemandStatsPanel({ demandId, openedFromCard = false, tone = "page", className }: DemandStatsPanelProps) {
  const [stats, setStats] = useState<DemandStats | null>(null);
  const [failed, setFailed] = useState(false);
  const recordedFor = useRef<string | null>(null);

  useEffect(() => {
    // React runs effects twice in development; one open must count once.
    if (recordedFor.current === demandId) return;
    recordedFor.current = demandId;

    const anonId = getAnonId();
    fetch(`/api/demands/${demandId}/stats`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kinds: openedFromCard ? ["VIEW", "CARD_CLICK"] : ["VIEW"],
        ...(anonId ? { anonId } : {}),
      }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`stats ${res.status}`))))
      .then((data: { stats: DemandStats }) => setStats(data.stats))
      .catch(() => setFailed(true));
  }, [demandId, openedFromCard]);

  if (failed) return null;

  const glass = tone === "glass";

  return (
    <section aria-label="Post statistics" className={className}>
      <p
        className={cn(
          "mb-1.5 text-[13px] uppercase tracking-[0.02em]",
          glass ? "px-4 text-[#EBEBF5]/60" : "px-1 text-neutral-500",
        )}
      >
        Statistics
      </p>
      <dl className="grid grid-cols-3 gap-2">
        {TILES.map(({ key, label, icon: Icon }) => (
          <div
            key={key}
            className={cn(
              "rounded-[14px] px-3 py-2.5",
              glass ? "bg-white/[0.08]" : "bg-neutral-100 dark:bg-neutral-800/60",
            )}
          >
            <dt
              className={cn(
                "flex items-center gap-1 text-[11px] font-medium",
                glass ? "text-[#EBEBF5]/60" : "text-neutral-500 dark:text-neutral-400",
              )}
            >
              <Icon className="h-3 w-3 shrink-0" aria-hidden />
              <span className="truncate">{label}</span>
            </dt>
            <dd
              className={cn(
                "mt-1 text-[20px] font-semibold tabular-nums leading-none tracking-[-0.01em]",
                glass ? "text-white" : "text-neutral-900 dark:text-neutral-100",
              )}
            >
              {stats ? stats[key].toLocaleString("en-IN") : "–"}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
