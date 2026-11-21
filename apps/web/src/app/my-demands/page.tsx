"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Zap } from "lucide-react";
import { CountdownBadge } from "@/components/countdown-badge";
import { PriorityBadge } from "@/components/priority-badge";
import { BoostDemandSheet } from "@/components/boost/boost-demand-sheet";
import { isBoostActive } from "@/lib/boost-shared";
import { formatBudgetRange } from "@/lib/money";
import { cn } from "@/lib/utils";

interface MyDemand {
  id: string;
  summary: string;
  budgetMin: number | null;
  budgetMax: number | null;
  timelineEnd: string;
  status: "OPEN" | "FILLED" | "EXPIRED" | "CANCELLED";
  isPriority: boolean;
  priorityExpiresAt: string | null;
  maxSlots: number;
  createdAt: string;
  _count: { bids: number };
}

type Tab = "active" | "expired";

const fmt = (iso: string) => new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

/** Can the author pay to feature / extend this post? Mirrors POST /api/demands/[id]/boost. */
function canBoost(d: MyDemand): boolean {
  const deadlinePassed = new Date(d.timelineEnd).getTime() <= Date.now();
  if (d.status === "OPEN" && !deadlinePassed) return true;
  // A post that expired on its own can be reopened by extending its earlier boost.
  return (
    d.priorityExpiresAt != null &&
    (d.status === "EXPIRED" || d.status === "OPEN") &&
    deadlinePassed &&
    d._count.bids < d.maxSlots
  );
}

export default function MyDemandsPage() {
  const [demands, setDemands] = useState<MyDemand[] | null>(null);
  const [tab, setTab] = useState<Tab>("active");
  const [boosting, setBoosting] = useState<MyDemand | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/my/demands");
    if (res.ok) setDemands((await res.json()).demands);
    else setDemands((prev) => prev ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const active = demands?.filter((d) => d.status === "OPEN") ?? [];
  const expired = demands?.filter((d) => d.status !== "OPEN") ?? [];
  const visible = tab === "active" ? active : expired;

  return (
    <main className="px-4 pt-[max(env(safe-area-inset-top),1.5rem)]">
      <h1 className="mb-4 text-xl font-bold">My posts</h1>

      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setTab("active")}
          className={cn(
            "flex-1 rounded-xl py-2 text-sm font-semibold",
            tab === "active" ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-500",
          )}
        >
          Open ({active.length})
        </button>
        <button
          onClick={() => setTab("expired")}
          className={cn(
            "flex-1 rounded-xl py-2 text-sm font-semibold",
            tab === "expired" ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-500",
          )}
        >
          Closed ({expired.length})
        </button>
      </div>

      {demands === null && (
        <div className="flex justify-center py-10 text-neutral-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      {demands !== null && visible.length === 0 && (
        <p className="card-shell p-6 text-center text-sm text-neutral-500">
          {tab === "active" ? "No open posts. Post a request or offer from the + tab." : "Nothing here yet."}
        </p>
      )}

      <div className="space-y-3">
        {visible.map((d) => {
          const budgetLabel = formatBudgetRange(d.budgetMin, d.budgetMax);
          const featured = isBoostActive(d.isPriority, d.priorityExpiresAt);
          const boostEnded = !featured && d.priorityExpiresAt != null;
          const boostable = canBoost(d);

          const card = (
            <div className={cn("card-shell p-4", d.status !== "OPEN" && "card-expired")}>
              <div className="mb-2 flex items-center justify-between gap-2">
                {featured ? <PriorityBadge /> : <span />}
                {d.status === "OPEN" ? (
                  <CountdownBadge timelineEnd={d.timelineEnd} />
                ) : (
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-400">
                    {"Closed"}
                  </span>
                )}
              </div>
              <p className="mb-2 line-clamp-2 text-sm font-medium text-neutral-900">{d.summary}</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
                {budgetLabel && <span className="font-semibold text-neutral-700">{budgetLabel}</span>}
                <span>
                  {d._count.bids}/{d.maxSlots} spots filled
                </span>
              </div>
            </div>
          );

          // Expired/filled cards are non-interactive per §3.8 (no navigation,
          // no text selection, no copy) — the detail route 410s for them
          // anyway, so linking would just be a dead click.
          const body =
            d.status === "OPEN" ? (
              <Link href={`/demands/${d.id}`} className="block">
                {card}
              </Link>
            ) : (
              card
            );

          return (
            <div key={d.id}>
              {body}
              {(featured || boostEnded || boostable) && (
                <div className="mt-1.5 flex items-center justify-between gap-2 px-1">
                  <span className={cn("text-xs", featured ? "text-amber-600" : "text-neutral-500")}>
                    {featured
                      ? `Featured until ${fmt(d.priorityExpiresAt!)}`
                      : boostEnded
                        ? `Featured boost ended ${fmt(d.priorityExpiresAt!)}`
                        : "Not featured"}
                  </span>
                  {boostable && (
                    <button
                      type="button"
                      onClick={() => setBoosting(d)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white transition active:scale-95 dark:bg-white dark:text-black"
                    >
                      <Zap className="h-3.5 w-3.5" />
                      {d.priorityExpiresAt ? "Extend featured" : "Feature"}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {boosting && (
        <BoostDemandSheet
          open
          onClose={() => setBoosting(null)}
          demandId={boosting.id}
          summary={boosting.summary}
          isPriority={boosting.isPriority}
          priorityExpiresAt={boosting.priorityExpiresAt}
          onDone={() => {
            setBoosting(null);
            void load();
          }}
        />
      )}
    </main>
  );
}
