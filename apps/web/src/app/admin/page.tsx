"use client";

import { useEffect, useState } from "react";
import {
  Users,
  Store,
  Building2,
  CalendarPlus,
  Package,
  Ticket,
  TicketCheck,
  Crown,
  IndianRupee,
  Flag,
  Paperclip,
  type LucideIcon,
} from "lucide-react";
import { formatPaise } from "@/lib/money";

interface Stats {
  users: { total: number; vendors: number; businesses: number };
  demands: { today: number; open: number };
  slots: { total: number; today: number };
  pro: { subscribers: number; mrrPaise: number };
  moderation: { openReports: number; pendingAttachments: number };
}

function StatCard({
  label,
  value,
  icon: Icon,
  alert,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  alert?: boolean;
}) {
  return (
    <div className="card-shell flex items-start justify-between gap-3 p-4 transition-colors hover:border-neutral-300 dark:hover:border-neutral-700">
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-neutral-500 dark:text-neutral-400">{label}</p>
        <p className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums text-neutral-900 dark:text-neutral-100">
          {value}
        </p>
      </div>
      <div
        className={
          alert
            ? "flex size-9 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400"
            : "flex size-9 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
        }
      >
        <Icon className="size-4" />
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
        {title}
      </h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">{children}</div>
    </section>
  );
}

function SkeletonGrid() {
  return (
    <div className="space-y-8">
      {[3, 4, 2, 2].map((n, i) => (
        <div key={i}>
          <div className="mb-3 h-3 w-20 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {Array.from({ length: n }).map((_, j) => (
              <div key={j} className="card-shell h-[84px] animate-pulse" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/stats");
      if (res.ok) setStats(await res.json());
    })();
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">Overview</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Platform health at a glance.</p>
      </div>

      {!stats ? (
        <SkeletonGrid />
      ) : (
        <div className="space-y-8">
          <Section title="Users">
            <StatCard label="Total users" value={stats.users.total} icon={Users} />
            <StatCard label="Providers" value={stats.users.vendors} icon={Store} />
            <StatCard label="Businesses" value={stats.users.businesses} icon={Building2} />
          </Section>
          <Section title="Requests & offers">
            <StatCard label="Posts today" value={stats.demands.today} icon={CalendarPlus} />
            <StatCard label="Open posts" value={stats.demands.open} icon={Package} />
            <StatCard label="Response spots sold" value={stats.slots.total} icon={Ticket} />
            <StatCard label="Response spots today" value={stats.slots.today} icon={TicketCheck} />
          </Section>
          <Section title="Revenue">
            <StatCard label="PRO subscribers" value={stats.pro.subscribers} icon={Crown} />
            <StatCard label="MRR (this month)" value={formatPaise(stats.pro.mrrPaise)} icon={IndianRupee} />
          </Section>
          <Section title="Moderation">
            <StatCard
              label="Open reports"
              value={stats.moderation.openReports}
              icon={Flag}
              alert={stats.moderation.openReports > 0}
            />
            <StatCard
              label="Pending attachments"
              value={stats.moderation.pendingAttachments}
              icon={Paperclip}
              alert={stats.moderation.pendingAttachments > 0}
            />
          </Section>
        </div>
      )}
    </div>
  );
}
