"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, Coins, Crown, Loader2, Lock, Sparkles } from "lucide-react";
import { CreditPaymentDrawer, type PaymentInvoice } from "@/components/credit-payment-drawer";
import { cn } from "@/lib/utils";
import type { CreditAuth } from "@/lib/validation/tpin";

type BidChoice = { amount?: number; wantsHero?: boolean };

interface Niche {
  id: string;
  name: string;
  mode: "FIXED" | "AUCTION";
  isActive: boolean;
  reservePrice: number;
  heroPrice: number;
  rankedPrice: number;
  heroTaken: boolean;
  rankedLeft: number;
}
interface MyDemand {
  id: string;
  summary: string;
  nicheId: string;
  nicheName: string | null;
  cover: string | null;
  ineligibleReason: string | null;
}
interface MyBid {
  id: string;
  nicheId: string;
  demandId: string;
  amount: number;
  wantsHero: boolean;
}
interface Placement {
  id: string;
  rank: number;
  displayRank: number | null;
  status: "ACTIVE" | "REMOVED" | "ENDED";
  pricePaid: number;
  impressions: number;
  clicks: number;
  leads: number;
  refundedAmount: number;
  removedReason: string | null;
  demand: { id: string; summary: string };
  niche: { name: string };
  cycle: { startsAt: string; endsAt: string };
}
interface Dashboard {
  enabled: boolean;
  balance: number;
  isVerified: boolean;
  settings: { cycleDays: number; slotsPerNiche: number };
  cycle: { id: string; startsAt: string; endsAt: string } | null;
  niches: Niche[];
  demands: MyDemand[];
  bids: MyBid[];
  placements: Placement[];
}

const CARD = "rounded-[22px] bg-[#1C1C1E] p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

function useCountdown(iso: string | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  if (!iso) return null;
  const ms = Math.max(0, new Date(iso).getTime() - now);
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return d ? `${d}d ${h}h` : `${h}h ${m}m`;
}

export default function FeaturedDashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/featured/me");
    const body = await res.json();
    if (!res.ok) return setError(body.error?.message ?? "Could not load.");
    setData(body);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const closesIn = useCountdown(data?.cycle?.startsAt);

  return (
    <main
      className="min-h-dvh bg-black px-4 pb-10 pt-[max(env(safe-area-inset-top),0.75rem)] text-white antialiased"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Inter, system-ui, sans-serif' }}
    >
      <Link
        href="/"
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.14] bg-white/[0.08]"
        aria-label="Back"
      >
        <ChevronLeft className="h-5 w-5" />
      </Link>
      <h1 className="mt-5 text-[34px] font-bold leading-[1.1] tracking-[-0.025em]">Feature a post</h1>
      <p className="mt-1 text-[15px] text-[#EBEBF5]/60">
        Win the home hero or a ranked spot in your category.
      </p>

      {error && <p className="mt-6 text-[15px] text-[#FF453A]">{error}</p>}
      {!data && !error && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-[#EBEBF5]/60" />
        </div>
      )}

      {data && !data.enabled && (
        <div className={cn(CARD, "mt-6 text-center")}>
          <Lock className="mx-auto mb-2 h-6 w-6 text-[#EBEBF5]/60" />
          <p className="font-semibold">Featured listings are paused</p>
          <p className="mt-1 text-[13px] text-[#EBEBF5]/60">The home hero is showing top listings for now. Check back soon.</p>
        </div>
      )}

      {data?.enabled && data.cycle && (
        <>
          <div className={cn(CARD, "mt-6 flex items-center justify-between")}>
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#EBEBF5]/55">Bidding closes in</p>
              <p className="text-[22px] font-bold">{closesIn}</p>
              <p className="text-[12px] text-[#EBEBF5]/55">
                Open {fmtDate(data.cycle.startsAt)} – {fmtDate(data.cycle.endsAt)}
              </p>
            </div>
            <Link href="/checkout" className="flex items-center gap-1.5 rounded-full bg-[#2C2C2E] px-3 py-2 text-[14px] font-semibold">
              <Coins className="h-4 w-4 text-[#FFD60A]" /> {data.balance}
            </Link>
          </div>

          {!data.isVerified && (
            <p className="mt-3 text-[13px] text-[#FF9F0A]">Only verified accounts can feature posts. Verify your account to bid.</p>
          )}

          <h2 className="mb-3 mt-8 text-[22px] font-bold tracking-[-0.02em]">Your posts</h2>
          {data.demands.length === 0 ? (
            <div className={cn(CARD, "text-center text-[14px] text-[#EBEBF5]/60")}>
              You have no open posts.{" "}
              <Link href="/post" className="font-semibold text-[#0A84FF]">
                Post a request
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {data.demands.map((d) => (
                <BidCard key={d.id} demand={d} data={data} onChange={load} />
              ))}
            </div>
          )}
        </>
      )}

      {data && data.placements.length > 0 && (
        <>
          <h2 className="mb-3 mt-10 text-[22px] font-bold tracking-[-0.02em]">Results</h2>
          <div className="space-y-3">
            {data.placements.map((p) => (
              <PlacementCard key={p.id} p={p} />
            ))}
          </div>
        </>
      )}
    </main>
  );
}

function BidCard({ demand, data, onChange }: { demand: MyDemand; data: Dashboard; onChange: () => Promise<void> }) {
  const niche = data.niches.find((n) => n.id === demand.nicheId);
  // One bid per niche: it may be on this post or another of yours in the same niche.
  const nicheBid = data.bids.find((b) => b.nicheId === demand.nicheId);
  const bidHere = nicheBid?.demandId === demand.id ? nicheBid : undefined;
  const [amount, setAmount] = useState<string>(String(bidHere?.amount ?? niche?.reservePrice ?? ""));
  const [busy, setBusy] = useState(false);
  const [payment, setPayment] = useState<{ body: BidChoice; charge: number } | null>(null);

  const blocked = demand.ineligibleReason ?? (!niche?.isActive ? "Featured spots are paused in this category." : null);

  const postBid = (body: BidChoice, auth?: CreditAuth) =>
    fetch("/api/featured/bids", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ demandId: demand.id, ...body, auth }),
    });

  const submit = async (body: BidChoice) => {
    // New credits going out need the payment drawer. The server applies the same rule.
    const price = niche?.mode === "AUCTION" ? (body.amount ?? 0) : body.wantsHero ? niche?.heroPrice : niche?.rankedPrice;
    const charge = (price ?? 0) - (nicheBid?.amount ?? 0);
    if (charge > 0) {
      setPayment({ body, charge });
      return;
    }

    setBusy(true);
    try {
      const res = await postBid(body);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Could not place bid.");
      toast.success(niche?.mode === "AUCTION" ? "Bid placed — credits are held until the auction closes." : "You’re featured!");
      await onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not place bid.");
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async () => {
    if (!bidHere) return;
    setBusy(true);
    const res = await fetch(`/api/featured/bids/${bidHere.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      toast.error((await res.json()).error?.message ?? "Could not withdraw.");
      return;
    }
    toast.success("Stopped. Your credits are back in your wallet.");
    await onChange();
  };

  return (
    <div className={CARD}>
      <div className="flex gap-3">
        {demand.cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={demand.cover} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
        )}
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#EBEBF5]/55">
            {demand.nicheName} · {niche?.mode === "AUCTION" ? "Sealed auction" : "Fixed price"}
          </p>
          <p className="line-clamp-2 text-[14px] font-medium leading-snug">{demand.summary}</p>
        </div>
      </div>

      {blocked ? (
        <p className="mt-3 text-[13px] text-[#EBEBF5]/55">{blocked}</p>
      ) : nicheBid && !bidHere ? (
        <p className="mt-3 text-[13px] text-[#EBEBF5]/55">
          You already have a bid in {demand.nicheName} on another post. Placing one here moves it.
        </p>
      ) : null}

      {!blocked && niche && (
        <div className="mt-3">
          {bidHere && (
            <p className="mb-2 text-[13px] text-[#30D158]">
              {niche.mode === "AUCTION"
                ? `Your sealed bid: ${bidHere.amount} credits (held)`
                : `Booked: ${bidHere.wantsHero ? "Hero spot" : "Ranked spot"} · ${bidHere.amount} credits`}
            </p>
          )}

          {niche.mode === "AUCTION" ? (
            <div className="flex gap-2">
              <input
                type="number"
                inputMode="numeric"
                min={niche.reservePrice}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-11 min-w-0 flex-1 rounded-full bg-[#2C2C2E] px-4 text-[15px] outline-none"
                placeholder={`Min ${niche.reservePrice}`}
              />
              <button
                disabled={busy || !amount}
                onClick={() => submit({ amount: Number(amount) })}
                className="h-11 rounded-full bg-pearl px-5 text-[15px] font-semibold text-slate-navy disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : bidHere ? "Update bid" : "Place bid"}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                disabled={busy || (niche.heroTaken && !bidHere?.wantsHero) || bidHere?.wantsHero}
                onClick={() => submit({ wantsHero: true })}
                className="flex h-14 flex-col items-center justify-center rounded-2xl bg-white text-black disabled:opacity-40"
              >
                <span className="flex items-center gap-1 text-[14px] font-semibold">
                  <Crown className="h-4 w-4" /> Hero
                </span>
                <span className="text-[12px]">{niche.heroTaken && !bidHere?.wantsHero ? "Sold out" : `${niche.heroPrice} credits`}</span>
              </button>
              <button
                disabled={busy || (niche.rankedLeft === 0 && !(bidHere && !bidHere.wantsHero)) || (bidHere != null && !bidHere.wantsHero)}
                onClick={() => submit({ wantsHero: false })}
                className="flex h-14 flex-col items-center justify-center rounded-2xl bg-[#2C2C2E] disabled:opacity-40"
              >
                <span className="flex items-center gap-1 text-[14px] font-semibold">
                  <Sparkles className="h-4 w-4" /> Ranked
                </span>
                <span className="text-[12px] text-[#EBEBF5]/70">
                  {niche.rankedLeft === 0 ? "Sold out" : `${niche.rankedPrice} credits · ${niche.rankedLeft} left`}
                </span>
              </button>
            </div>
          )}

          {niche.mode === "AUCTION" && (
            <p className="mt-2 text-[12px] leading-snug text-[#EBEBF5]/50">
              Bids are sealed. Winners pay just above the next bid (min {niche.reservePrice}), and the rest of the hold comes
              back when the auction closes. Ranking also weighs your rating and past click-through.
            </p>
          )}

          {bidHere && (
            <button onClick={withdraw} disabled={busy} className="mt-2 text-[13px] font-semibold text-[#FF453A]">
              Stop featuring
            </button>
          )}
        </div>
      )}

      {payment && (
        <CreditPaymentDrawer<{ invoice: PaymentInvoice }>
          open
          onClose={() => setPayment(null)}
          title={demand.summary}
          items={[
            {
              label: niche?.mode === "AUCTION" ? "Auction bid hold" : `${payment.body.wantsHero ? "Hero" : "Ranked"} spot`,
              credits: payment.charge,
            },
          ]}
          request={(auth) => postBid(payment.body, auth)}
          onDone={() => {
            setPayment(null);
            void onChange();
          }}
        />
      )}
    </div>
  );
}

function PlacementCard({ p }: { p: Placement }) {
  const ctr = useMemo(() => (p.impressions ? ((p.clicks / p.impressions) * 100).toFixed(1) : "0.0"), [p]);
  const status =
    p.status === "ACTIVE"
      ? `Open · #${p.displayRank ?? p.rank}${(p.displayRank ?? p.rank) === 1 ? " (hero)" : ""}`
      : p.status === "REMOVED"
        ? `Removed · ${p.refundedAmount} credits back`
        : "Ended";

  return (
    <div className={CARD}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#EBEBF5]/55">
            {p.niche.name} · {fmtDate(p.cycle.startsAt)} – {fmtDate(p.cycle.endsAt)}
          </p>
          <Link href={`/demands/${p.demand.id}`} className="line-clamp-1 text-[14px] font-medium">
            {p.demand.summary}
          </Link>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold",
            p.status === "ACTIVE" ? "bg-[#30D158]/20 text-[#30D158]" : "bg-[#2C2C2E] text-[#EBEBF5]/60",
          )}
        >
          {status}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2 text-center">
        {[
          ["Views", p.impressions],
          ["Clicks", p.clicks],
          ["CTR", `${ctr}%`],
          ["Leads", p.leads],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-[#2C2C2E] py-2">
            <p className="text-[17px] font-bold">{value}</p>
            <p className="text-[11px] text-[#EBEBF5]/55">{label}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[12px] text-[#EBEBF5]/50">Paid {p.pricePaid} credits</p>
    </div>
  );
}
