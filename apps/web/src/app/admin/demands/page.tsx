"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminDemand {
  id: string;
  summary: string;
  status: string;
  isPriority: boolean;
  timelineEnd: string;
  createdAt: string;
  author: { id: string; name: string; email: string };
  _count: { bids: number };
}

interface AdminReport {
  id: string;
  reference: string;
  targetType: "DEMAND" | "USER";
  reason: string;
  details: string | null;
  createdAt: string;
  demand: { id: string; summary: string; status: string } | null;
  reportedUser: { id: string; name: string; email: string; isBanned: boolean } | null;
  reporter: { id: string; name: string };
}

export default function AdminDemandsPage() {
  const [demands, setDemands] = useState<AdminDemand[] | null>(null);
  const [reports, setReports] = useState<AdminReport[] | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/demands");
      setDemands(res.ok ? (await res.json()).demands : []);
    })();
    (async () => {
      const res = await fetch("/api/admin/reports");
      setReports(res.ok ? (await res.json()).reports : []);
    })();
  }, []);

  async function resolveReport(id: string, action: "resolve" | "dismiss") {
    const res = await fetch(`/api/admin/reports/${id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) { toast.error("Could not update this report."); return; }
    setReports((prev) => prev?.filter((r) => r.id !== id) ?? null);
    toast.success(action === "resolve" ? "Report marked resolved." : "Report dismissed.");
  }

  async function forceExpire(id: string) {
    const res = await fetch(`/api/admin/demands/${id}/force-expire`, { method: "POST" });
    if (!res.ok) { toast.error("Could not close this post."); return; }
    setDemands((prev) => prev?.map((d) => (d.id === id ? { ...d, status: "EXPIRED" } : d)) ?? null);
  }

  async function deleteDemand(id: string) {
    if (!window.confirm("Permanently delete this post and all its responses and chats? This can't be undone.")) return;
    const res = await fetch(`/api/admin/demands/${id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Could not delete this post."); return; }
    setDemands((prev) => prev?.filter((d) => d.id !== id) ?? null);
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold dark:text-neutral-100">Posts</h1>

      <h2 className="mb-2 text-sm font-semibold text-neutral-500">
        Open reports {reports && `(${reports.length})`}
      </h2>
      {reports === null ? (
        <div className="mb-6 flex justify-center py-6 text-neutral-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : reports.length === 0 ? (
        <p className="card-shell mb-6 p-4 text-sm text-neutral-400">No open reports.</p>
      ) : (
        <div className="card-shell mb-6 divide-y divide-neutral-100 dark:divide-neutral-800">
          {reports.map((r) => (
            <div key={r.id} className="space-y-1.5 p-3.5">
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 font-bold",
                    r.targetType === "USER" ? "bg-purple-100 text-purple-700" : "bg-red-100 text-red-700",
                  )}
                >
                  {r.targetType === "USER" ? "USER" : "POST"}
                </span>
                <span className="font-mono text-neutral-500">{r.reference}</span>
                <span className="text-neutral-400">
                  by {r.reporter.name} · {new Date(r.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="text-sm font-semibold dark:text-neutral-100">{r.reason}</p>
              {r.details && <p className="text-xs text-neutral-600 dark:text-neutral-400">{r.details}</p>}
              <p className="text-xs text-neutral-500">
                {r.demand ? (
                  <Link href={`/demands/${r.demand.id}`} className="text-brand-600 hover:underline">
                    {r.demand.summary.slice(0, 80)}
                  </Link>
                ) : (
                  "Post deleted"
                )}
                {r.reportedUser && (
                  <>
                    {" · "}
                    <Link href={`/u/${r.reportedUser.id}`} className="hover:underline">
                      {r.reportedUser.name} ({r.reportedUser.email})
                    </Link>
                    {r.reportedUser.isBanned && <span className="ml-1 font-semibold text-red-600">banned</span>}
                  </>
                )}
              </p>
              <div className="flex gap-3 pt-1">
                <button onClick={() => resolveReport(r.id, "resolve")} className="text-xs font-medium text-brand-600 hover:underline">
                  Mark resolved
                </button>
                <button onClick={() => resolveReport(r.id, "dismiss")} className="text-xs font-medium text-neutral-500 hover:underline">
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="mb-2 text-sm font-semibold text-neutral-500">All posts</h2>

      {demands === null ? (
        <div className="flex justify-center py-10 text-neutral-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="card-shell divide-y divide-neutral-100 dark:divide-neutral-800">
          {demands.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-3 p-3.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium dark:text-neutral-100">{d.summary}</p>
                <p className="text-xs text-neutral-400">
                  {d.author.name} · {d._count.bids}/3 slots ·{" "}
                  <span
                    className={cn(
                      "font-semibold",
                      d.status === "OPEN" ? "text-brand-600" : "text-neutral-400",
                    )}
                  >
                    {d.status}
                  </span>
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                {d.status === "OPEN" && (
                  <button onClick={() => forceExpire(d.id)} className="text-xs font-medium text-amber-600 hover:underline">
                    Force-expire
                  </button>
                )}
                <button onClick={() => deleteDemand(d.id)} className="text-xs font-medium text-red-600 hover:underline">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
