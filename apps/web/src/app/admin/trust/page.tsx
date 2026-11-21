import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/guards";
import { TIER_RULES } from "@/lib/trust";
import { RunTrustJobButton } from "./run-button";

export const dynamic = "force-dynamic";

function fmt(d: Date) {
  return d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
}

export default async function AdminTrustPage() {
  await requireAdmin();
  const [runs, tierCounts, events, problems] = await Promise.all([
    prisma.trustJobRun.findMany({ orderBy: { ranAt: "desc" }, take: 6 }),
    prisma.userTrust.groupBy({ by: ["role", "tier"], _count: { _all: true } }),
    prisma.badgeEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 40,
      select: { id: true, event: true, reason: true, createdAt: true, user: { select: { name: true, email: true } } },
    }),
    prisma.dealCheckInState.findMany({
      where: { latestStatus: "PROBLEM" },
      orderBy: { updatedAt: "desc" },
      take: 30,
      select: {
        bidId: true,
        updatedAt: true,
        user: { select: { name: true, email: true } },
        bid: {
          select: {
            demand: { select: { summary: true } },
            checkIns: { where: { status: "PROBLEM" }, orderBy: { createdAt: "desc" }, take: 1, select: { note: true } },
          },
        },
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold dark:text-neutral-100">Trust &amp; badges</h1>
        <RunTrustJobButton />
      </div>

      <div className="card-shell space-y-2 p-4 text-sm">
        <p className="font-semibold dark:text-neutral-100">Rules</p>
        <ul className="space-y-1 text-xs text-neutral-500">
          {Object.entries(TIER_RULES).map(([tier, r]) => (
            <li key={tier}>
              {tier}: {r.deals}+ completed deals, {r.rating}+ avg rating, {r.partners}+ different partners (per role)
            </li>
          ))}
          <li>Runs on the 1st of each month at 00:05 IST. Upgrades apply at once; a lower result gives a 30-day warning, then one tier down.</li>
        </ul>
        <div className="flex flex-wrap gap-2 pt-1 text-xs">
          {tierCounts.map((t) => (
            <span key={`${t.role}-${t.tier}`} className="rounded-full bg-neutral-200 px-2 py-0.5 text-neutral-700">
              {t.role} · {t.tier}: {t._count._all}
            </span>
          ))}
        </div>
      </div>

      <div className="card-shell p-4">
        <p className="mb-2 font-semibold dark:text-neutral-100">Recent runs</p>
        {runs.length === 0 ? (
          <p className="text-sm text-neutral-500">Not run yet.</p>
        ) : (
          <ul className="space-y-1 text-xs text-neutral-500">
            {runs.map((r) => (
              <li key={r.month}>
                <span className="font-medium dark:text-neutral-200">{r.month}</span> · {fmt(r.ranAt)} · {JSON.stringify(r.stats)}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card-shell p-4">
        <p className="mb-2 font-semibold dark:text-neutral-100">Reported problems (latest check-in)</p>
        {problems.length === 0 ? (
          <p className="text-sm text-neutral-500">None.</p>
        ) : (
          <ul className="divide-y divide-neutral-200 text-sm dark:divide-neutral-800">
            {problems.map((p) => (
              <li key={`${p.bidId}-${p.user.email}`} className="py-2">
                <p className="dark:text-neutral-200">
                  {p.user.name} <span className="text-xs text-neutral-500">({p.user.email}) · {fmt(p.updatedAt)}</span>
                </p>
                <p className="truncate text-xs text-neutral-500">{p.bid.demand.summary}</p>
                {p.bid.checkIns[0]?.note && <p className="text-xs text-amber-600">“{p.bid.checkIns[0].note}”</p>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card-shell p-4">
        <p className="mb-2 font-semibold dark:text-neutral-100">Badge events</p>
        {events.length === 0 ? (
          <p className="text-sm text-neutral-500">No events yet.</p>
        ) : (
          <ul className="space-y-1 text-xs">
            {events.map((e) => (
              <li key={e.id} className="text-neutral-500">
                <span className="font-medium dark:text-neutral-200">{e.event}</span> · {e.user.name} · {e.reason} · {fmt(e.createdAt)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
