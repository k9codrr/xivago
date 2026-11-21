"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, ChevronLeft, Coins, Gift, Loader2, ShoppingBag, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/time";
import { SpinWheel, rotationToSegment } from "@/components/spin-wheel";
import { haptic } from "@/lib/haptics";
import { playSound } from "@/lib/sounds";
import { ConfettiBurst } from "@/components/confetti-burst";

type SpinKind = "FORTNIGHTLY" | "SLOT_BONUS";

interface SpinStatus {
  available: SpinKind[];
  nextFreeSpinAt: string | null;
  bonusProgress: number;
  bonusSlotsNeeded: number;
  bonusProgressExpiresAt: string | null;
}

interface SpinData {
  status: SpinStatus;
  wins: Array<{ id: string; kind: SpinKind; amount: number; createdAt: string }>;
  balance: number;
  segments: number[];
}

const KIND_LABEL: Record<SpinKind, string> = { FORTNIGHTLY: "Free spin", SLOT_BONUS: "Bonus spin" };

function untilLabel(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.max(1, Math.ceil((ms % 86_400_000) / 3_600_000));
  return days > 0 ? `${days}d ${hours}h` : `${hours}h`;
}

export default function SpinPage() {
  const router = useRouter();
  const [data, setData] = useState<SpinData | null>(null);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [prize, setPrize] = useState<{ amount: number; kind: SpinKind } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/spin");
    if (res.ok) setData(await res.json());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function spin() {
    if (!data || spinning || data.status.available.length === 0) return;
    void haptic("heavy");
    setSpinning(true);
    try {
      const res = await fetch("/api/spin", { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        void haptic("error");
        toast.error(body?.error?.message ?? "Could not spin the wheel.");
        setSpinning(false);
        void load();
        return;
      }
      setRotation((r) => rotationToSegment(r, body.segmentIndex, data.segments.length, 6, Math.random()));
      // Reveal the prize once the wheel has stopped (matches the CSS transition length)
      setTimeout(() => {
        setSpinning(false);
        void haptic("success");
        playSound("coins");
        setPrize({ amount: body.amount, kind: body.kind });
        setData((d) => (d ? { ...d, balance: body.balance, status: body.status } : d));
        void load();
      }, 4900);
    } catch {
      toast.error("Could not spin the wheel.");
      setSpinning(false);
    }
  }

  const status = data?.status;
  const spinsLeft = status?.available.length ?? 0;

  return (
    <main className="min-h-dvh bg-black">
      <div className="relative mx-auto min-h-dvh w-full max-w-[430px] overflow-hidden bg-[#1a0d33] pb-16 text-white antialiased">
        <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 h-[360px] w-[360px] rounded-full bg-[#7c3aed]/30 blur-[110px]" />
        <div aria-hidden className="pointer-events-none absolute -right-24 top-40 h-[300px] w-[300px] rounded-full bg-[#0f766e]/30 blur-[110px]" />

        <header className="relative flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),1rem)]">
          <button type="button" onClick={() => router.back()} aria-label="Back" className="grid h-10 w-10 place-items-center rounded-full bg-white/10 backdrop-blur">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[13px] font-semibold backdrop-blur">
            <Coins className="h-4 w-4 text-amber-300" />
            {data ? data.balance : "—"} credits
          </span>
        </header>

        <div className="relative mt-4 text-center">
          <p
            className="text-[40px] font-black italic leading-none tracking-[-0.02em]"
            style={{
              background: "linear-gradient(180deg,#ffffff 0%,#c7d2fe 55%,#818cf8 100%)",
              WebkitBackgroundClip: "text",
              color: "transparent",
              WebkitTextStroke: "0.6px #1e1b4b",
              filter: "drop-shadow(0 2px 0 #1e1b4b)",
            }}
          >
            SPIN&amp;WIN
          </p>
          <span className="mt-2 inline-block -rotate-[1.5deg] bg-white px-2 py-[3px] text-[12px] font-bold text-[#1e1b5e] shadow">
            win up to 500 credits
          </span>
        </div>

        <div className="relative mt-8 px-8">
          {data ? (
            <SpinWheel segments={data.segments} rotation={rotation} spinning={spinning} />
          ) : (
            <div className="grid aspect-square place-items-center">
              <Loader2 className="h-6 w-6 animate-spin text-white/50" />
            </div>
          )}
        </div>

        <div className="relative mt-8 px-5">
          <button
            type="button"
            onClick={spin}
            disabled={!data || spinning || spinsLeft === 0}
            className={cn(
              "h-14 w-full rounded-full text-[16px] font-bold tracking-wide transition-transform active:scale-[0.98]",
              spinsLeft > 0 && !spinning
                ? "bg-gradient-to-r from-amber-300 to-amber-500 text-[#1e1b4b] shadow-[0_10px_30px_rgba(251,191,36,0.35)]"
                : "bg-white/10 text-white/50",
            )}
          >
            {spinning ? "Spinning…" : spinsLeft > 0 ? `SPIN NOW · ${spinsLeft} ${spinsLeft === 1 ? "spin" : "spins"} left` : "No spins right now"}
          </button>

          {/* How spins are earned */}
          <div className="mt-6 space-y-3">
            <div className="flex items-start gap-3 rounded-2xl bg-white/[0.07] p-4 ring-1 ring-inset ring-white/10">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#5b2a9a]/60">
                <CalendarClock className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold">1 free spin every 2 weeks</p>
                <p className="mt-0.5 text-[12.5px] text-white/60">
                  {!status
                    ? "…"
                    : status.available.includes("FORTNIGHTLY")
                      ? "Your free spin is ready."
                      : `Next free spin in ${untilLabel(status.nextFreeSpinAt as string)}.`}
                </p>
              </div>
              {status?.available.includes("FORTNIGHTLY") && (
                <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">Ready</span>
              )}
            </div>

            <div className="flex items-start gap-3 rounded-2xl bg-white/[0.07] p-4 ring-1 ring-inset ring-white/10">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#2b8a8f]/60">
                <ShoppingBag className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold">Bonus spin: take 2 response spots in a week</p>
                {status && (
                  <>
                    <div className="mt-2 flex gap-1.5">
                      {Array.from({ length: status.bonusSlotsNeeded }).map((_, i) => (
                        <span key={i} className={cn("h-1.5 flex-1 rounded-full", i < status.bonusProgress ? "bg-[#2dd4bf]" : "bg-white/15")} />
                      ))}
                    </div>
                    <p className="mt-1.5 text-[12.5px] text-white/60">
                      {status.available.includes("SLOT_BONUS")
                        ? "Bonus spin unlocked!"
                        : `${status.bonusProgress}/${status.bonusSlotsNeeded} slots bought${
                            status.bonusProgressExpiresAt ? ` · resets in ${untilLabel(status.bonusProgressExpiresAt)}` : ""
                          }`}
                    </p>
                  </>
                )}
              </div>
              {status?.available.includes("SLOT_BONUS") ? (
                <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">Ready</span>
              ) : (
                <Link href="/" className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold">Browse</Link>
              )}
            </div>
          </div>

          {/* Recent wins */}
          {data && data.wins.length > 0 && (
            <section className="mt-7">
              <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-[0.06em] text-white/50">Your wins</h2>
              <ul className="divide-y divide-white/10 rounded-2xl bg-white/[0.05] ring-1 ring-inset ring-white/10">
                {data.wins.map((w) => (
                  <li key={w.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-[14px] font-medium">{KIND_LABEL[w.kind]}</p>
                      <p className="text-[12px] text-white/50">{timeAgo(w.createdAt)}</p>
                    </div>
                    <span className="text-[15px] font-bold text-amber-300">+{w.amount}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Prize reveal */}
        {prize && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-8 backdrop-blur-sm" onClick={() => setPrize(null)}>
            <ConfettiBurst originY="30%" />
            <div
              className="relative w-full max-w-[320px] rounded-[28px] bg-gradient-to-b from-[#3b1d6e] to-[#1a0d33] p-7 text-center ring-1 ring-white/15 animate-in zoom-in-90 fade-in duration-300"
              onClick={(e) => e.stopPropagation()}
            >
              <button type="button" onClick={() => setPrize(null)} aria-label="Close" className="absolute right-4 top-4 text-white/60">
                <X className="h-5 w-5" />
              </button>
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-amber-400/20">
                <Gift className="h-8 w-8 text-amber-300" />
              </span>
              <p className="mt-4 text-[14px] text-white/70">You won</p>
              <p className="text-[48px] font-black leading-tight text-amber-300">{prize.amount}</p>
              <p className="text-[14px] font-semibold">credits</p>
              <p className="mt-3 text-[12.5px] text-white/60">Added to your credit wallet.</p>
              <button type="button" onClick={() => setPrize(null)} className="mt-6 h-12 w-full rounded-full bg-pearl text-[15px] font-semibold text-slate-navy">
                Awesome
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
