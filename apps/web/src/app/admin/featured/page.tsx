"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Play } from "lucide-react";
import { cn } from "@/lib/utils";

interface Settings {
  enabled: boolean;
  cycleDays: number;
  slotsPerNiche: number;
  priceStep: number;
  maxConsecutiveWins: number;
  heroRotateTopN: number;
}
interface Niche {
  id: string;
  name: string;
  mode: "FIXED" | "AUCTION";
  isActive: boolean;
  reservePrice: number;
  heroPrice: number;
  rankedPrice: number;
}
interface Cycle {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
}
interface AdminBid {
  id: string;
  nicheId: string;
  amount: number;
  wantsHero: boolean;
  createdAt: string;
  user: { name: string; email: string };
  demand: { id: string; summary: string };
}
interface AdminPlacement {
  id: string;
  nicheId: string;
  rank: number;
  status: string;
  pricePaid: number;
  impressions: number;
  clicks: number;
  refundedAmount: number;
  removedReason: string | null;
  user: { name: string; email: string };
  demand: { id: string; summary: string };
}
interface AdminData {
  envEnabled: boolean;
  effectiveEnabled: boolean;
  settings: Settings;
  niches: Niche[];
  cycle: Cycle | null;
  liveCycle: Cycle | null;
  bids: AdminBid[];
  placements: AdminPlacement[];
  revenue: number;
}

const INPUT = "w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900";
const BTN = "rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50";

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error?.message ?? "Request failed.");
  return json;
}

export default function AdminFeaturedPage() {
  const [data, setData] = useState<AdminData | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/featured");
    if (res.ok) setData(await res.json());
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusy(false);
    }
  };

  if (!data) {
    return (
      <div className="flex justify-center py-16 text-neutral-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const toggle = () => {
    const turningOff = data.settings.enabled;
    if (
      turningOff &&
      !confirm("Turn off featured bidding? Every held bid is refunded now and live placements are pulled with a pro-rata refund.")
    ) {
      return;
    }
    void act(() => send("/api/admin/featured", "PATCH", { enabled: !turningOff }), turningOff ? "Featured bidding off" : "Featured bidding on");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold dark:text-neutral-100">Featured hero</h1>
        <button className={cn(BTN, "flex items-center gap-1")} disabled={busy} onClick={() => act(() => send("/api/admin/featured/run", "POST"), "Cycle job ran")}>
          <Play className="h-3 w-3" /> Run cycle job now
        </button>
      </div>

      {/* ── Switches ── */}
      <div className="card-shell space-y-3 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold dark:text-neutral-100">Featured bidding</p>
            <p className="text-xs text-neutral-500">
              On: the hero shows sponsored winners per category. Off: the hero shows the top request of every category.
            </p>
          </div>
          <button
            role="switch"
            aria-checked={data.settings.enabled}
            disabled={busy}
            onClick={toggle}
            className={cn(
              "relative h-6 w-11 shrink-0 rounded-full transition-colors",
              data.settings.enabled ? "bg-mint" : "bg-neutral-300 dark:bg-neutral-700",
            )}
          >
            <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all", data.settings.enabled ? "left-[22px]" : "left-0.5")} />
          </button>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className={cn("rounded-full px-2 py-0.5", data.envEnabled ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800")}>
            env FEATURED_BIDDING_ENABLED = {String(data.envEnabled)}
          </span>
          <span className={cn("rounded-full px-2 py-0.5", data.effectiveEnabled ? "bg-emerald-100 text-emerald-800" : "bg-neutral-200 text-neutral-700")}>
            Effective: {data.effectiveEnabled ? "ON" : "OFF"}
          </span>
          <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-neutral-700">Net revenue: {data.revenue} credits</span>
        </div>
        {!data.envEnabled && (
          <p className="text-xs text-amber-600">The env master switch is off, so the feature stays off whatever this toggle says.</p>
        )}
      </div>

      <SettingsForm settings={data.settings} busy={busy} onSave={(s) => act(() => send("/api/admin/featured", "PATCH", s), "Settings saved")} />

      {/* ── Niches ── */}
      <div className="card-shell overflow-x-auto p-4">
        <p className="mb-1 font-semibold dark:text-neutral-100">Niches</p>
        <p className="mb-3 text-xs text-neutral-500">
          Start niches on Fixed price. Switch one to Auction once it sells out regularly or 3+ sellers want it. Prices are in credits (1 credit = ₹1).
        </p>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-neutral-500">
            <tr>
              <th className="pb-2">Niche</th>
              <th className="pb-2">Mode</th>
              <th className="pb-2">Active</th>
              <th className="pb-2">Reserve</th>
              <th className="pb-2">Hero ₹</th>
              <th className="pb-2">Ranked ₹</th>
              <th className="pb-2">Bids</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.niches.map((n) => (
              <NicheRow
                key={`${n.id}-${n.mode}-${n.reservePrice}-${n.heroPrice}-${n.rankedPrice}-${n.isActive}`}
                niche={n}
                bidCount={data.bids.filter((b) => b.nicheId === n.id).length}
                busy={busy}
                onSave={(patch) => act(() => send(`/api/admin/featured/niches/${n.id}`, "PATCH", patch), `${n.name} saved`)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Open auction ── */}
      <div className="card-shell p-4">
        <p className="font-semibold dark:text-neutral-100">Open bidding window</p>
        {data.cycle ? (
          <>
            <p className="mb-3 text-xs text-neutral-500">
              Closes {fmt(data.cycle.startsAt)} · goes live until {fmt(data.cycle.endsAt)}. Sellers can&apos;t see these amounts.
            </p>
            {data.bids.length === 0 ? (
              <p className="text-sm text-neutral-500">No bids yet.</p>
            ) : (
              <ul className="divide-y divide-neutral-200 text-sm dark:divide-neutral-800">
                {data.bids.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <span className="text-xs text-neutral-500">{data.niches.find((n) => n.id === b.nicheId)?.name}</span>
                      <span className="block truncate dark:text-neutral-200">{b.demand.summary}</span>
                      <span className="text-xs text-neutral-500">{b.user.name} · {b.user.email}</span>
                    </span>
                    <span className="shrink-0 font-semibold dark:text-neutral-100">
                      {b.amount}
                      {b.wantsHero && <span className="ml-1 text-xs text-amber-600">hero</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="text-sm text-neutral-500">No bidding window open{data.effectiveEnabled ? " — run the cycle job to open one." : "."}</p>
        )}
      </div>

      {/* ── Live placements ── */}
      <div className="card-shell p-4">
        <p className="font-semibold dark:text-neutral-100">Live now</p>
        {data.liveCycle ? (
          <p className="mb-3 text-xs text-neutral-500">
            {fmt(data.liveCycle.startsAt)} – {fmt(data.liveCycle.endsAt)}
          </p>
        ) : (
          <p className="text-sm text-neutral-500">No live cycle yet.</p>
        )}
        {data.placements.length > 0 && (
          <ul className="divide-y divide-neutral-200 text-sm dark:divide-neutral-800">
            {data.placements.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="text-xs text-neutral-500">
                    {data.niches.find((n) => n.id === p.nicheId)?.name} · #{p.rank} · {p.impressions} views · {p.clicks} clicks
                  </span>
                  <span className="block truncate dark:text-neutral-200">{p.demand.summary}</span>
                  <span className="text-xs text-neutral-500">
                    {p.user.name} · paid {p.pricePaid}
                    {p.status !== "ACTIVE" && ` · ${p.status.toLowerCase()} (${p.removedReason ?? ""}) · refunded ${p.refundedAmount}`}
                  </span>
                </span>
                {p.status === "ACTIVE" && (
                  <button
                    className="shrink-0 rounded-md border border-red-300 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                    disabled={busy}
                    onClick={() => {
                      if (confirm("Remove this placement? Everyone below moves up and the seller is refunded pro-rata.")) {
                        void act(() => send(`/api/admin/featured/placements/${p.id}/remove`, "POST"), "Placement removed");
                      }
                    }}
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

const SETTING_FIELDS: { key: keyof Omit<Settings, "enabled">; label: string; hint: string }[] = [
  { key: "cycleDays", label: "Cycle length (days)", hint: "How long winners stay live" },
  { key: "slotsPerNiche", label: "Spots per category", hint: "Hero + ranked #2…N" },
  { key: "priceStep", label: "Price step", hint: "Second-price increment" },
  { key: "maxConsecutiveWins", label: "Max hero wins in a row", hint: "0 = no cap" },
  { key: "heroRotateTopN", label: "Rotate hero among top", hint: "1 = rank #1 only" },
];

function SettingsForm({ settings, busy, onSave }: { settings: Settings; busy: boolean; onSave: (s: Partial<Settings>) => void }) {
  const [form, setForm] = useState(settings);
  useEffect(() => setForm(settings), [settings]);

  return (
    <div className="card-shell p-4">
      <p className="mb-3 font-semibold dark:text-neutral-100">Cycle rules</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {SETTING_FIELDS.map((f) => (
          <label key={f.key} className="text-xs text-neutral-500">
            {f.label}
            <input
              type="number"
              className={cn(INPUT, "mt-1")}
              value={form[f.key]}
              onChange={(e) => setForm({ ...form, [f.key]: Number(e.target.value) })}
            />
            <span className="text-[10px]">{f.hint}</span>
          </label>
        ))}
      </div>
      <button
        className={cn(BTN, "mt-3")}
        disabled={busy}
        onClick={() => {
          const { enabled: _enabled, ...rest } = form;
          onSave(rest);
        }}
      >
        Save rules
      </button>
      <p className="mt-2 text-[11px] text-neutral-500">A new cycle length applies from the next bidding window that opens.</p>
    </div>
  );
}

function NicheRow({ niche, bidCount, busy, onSave }: { niche: Niche; bidCount: number; busy: boolean; onSave: (n: Partial<Niche>) => void }) {
  const [n, setN] = useState(niche);
  const num = (k: "reservePrice" | "heroPrice" | "rankedPrice") => (
    <input type="number" className={cn(INPUT, "w-20")} value={n[k]} onChange={(e) => setN({ ...n, [k]: Number(e.target.value) })} />
  );
  return (
    <tr className="border-t border-neutral-200 dark:border-neutral-800">
      <td className="py-2 pr-2 dark:text-neutral-200">{n.name}</td>
      <td className="pr-2">
        <select className={INPUT} value={n.mode} onChange={(e) => setN({ ...n, mode: e.target.value as Niche["mode"] })}>
          <option value="FIXED">Fixed</option>
          <option value="AUCTION">Auction</option>
        </select>
      </td>
      <td className="pr-2">
        <input type="checkbox" checked={n.isActive} onChange={(e) => setN({ ...n, isActive: e.target.checked })} />
      </td>
      <td className="pr-2">{num("reservePrice")}</td>
      <td className="pr-2">{num("heroPrice")}</td>
      <td className="pr-2">{num("rankedPrice")}</td>
      <td className="pr-2 text-neutral-500">{bidCount}</td>
      <td>
        <button
          className={BTN}
          disabled={busy}
          onClick={() =>
            onSave({ mode: n.mode, isActive: n.isActive, reservePrice: n.reservePrice, heroPrice: n.heroPrice, rankedPrice: n.rankedPrice })
          }
        >
          Save
        </button>
      </td>
    </tr>
  );
}
