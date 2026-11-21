"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronLeft, Copy, Gift, Loader2, Share2, Sparkles, UserPlus, Users } from "lucide-react";
import { timeAgo } from "@/lib/time";

interface ReferralData {
  code: string;
  rewardCredits: number;
  welcomeCredits: number;
  referrals: Array<{ id: string; name: string; avatarUrl: string | null; createdAt: string }>;
  earnedCredits: number;
  canRedeem: boolean;
}

export default function InvitePage() {
  const router = useRouter();
  const [data, setData] = useState<ReferralData | null>(null);
  const [copied, setCopied] = useState(false);
  const [redeemCode, setRedeemCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);

  async function load() {
    const res = await fetch("/api/referrals");
    if (res.ok) setData(await res.json());
  }

  useEffect(() => {
    void load();
  }, []);

  const inviteLink = data && typeof window !== "undefined" ? `${window.location.origin}/signup?ref=${data.code}` : "";

  async function copyCode() {
    if (!data) return;
    await navigator.clipboard.writeText(data.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function share() {
    if (!data) return;
    const text = `Join me on xivago! Use my referral code ${data.code} when you sign up and get ${data.welcomeCredits} bonus credits.`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Join xivago", text, url: inviteLink });
      } catch {
        // user dismissed the share sheet
      }
      return;
    }
    await navigator.clipboard.writeText(`${text} ${inviteLink}`);
    toast.success("Invite link copied.");
  }

  async function redeem() {
    if (!redeemCode.trim() || redeeming) return;
    setRedeeming(true);
    try {
      const res = await fetch("/api/referrals/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: redeemCode.trim() }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body?.error?.message ?? "Could not apply this referral code.");
        return;
      }
      toast.success(`${body.welcomeCredits} bonus credits added to your wallet.`);
      setRedeemCode("");
      void load();
    } finally {
      setRedeeming(false);
    }
  }

  return (
    <main className="min-h-dvh bg-black">
      <div className="relative mx-auto min-h-dvh w-full max-w-[430px] overflow-hidden bg-[#0a0a0a] pb-16 text-white antialiased">
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 h-[340px] w-[340px] rounded-full bg-[#f59e0b]/20 blur-[110px]" />

        <header className="relative flex items-center gap-3 px-4 pt-[max(env(safe-area-inset-top),1rem)]">
          <button type="button" onClick={() => router.back()} aria-label="Back" className="grid h-10 w-10 place-items-center rounded-full bg-white/10 backdrop-blur">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="text-[17px] font-semibold">Refer &amp; Earn</h1>
        </header>

        {!data ? (
          <div className="flex justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-white/50" />
          </div>
        ) : (
          <div className="relative px-5">
            {/* Hero */}
            <section className="mt-6 rounded-[24px] bg-gradient-to-br from-[#3a2a08] via-[#1d1608] to-[#111] p-6 ring-1 ring-inset ring-amber-300/15">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-400/20">
                <Gift className="h-6 w-6 text-amber-300" />
              </span>
              <h2 className="mt-4 text-[26px] font-bold leading-tight tracking-[-0.02em]">
                Get <span className="text-amber-300">{data.rewardCredits} credits</span>
                <br />
                for every friend
              </h2>
              <p className="mt-2 text-[14px] text-white/65">
                Your friend gets {data.welcomeCredits} bonus credits too when they sign up with your code.
              </p>

              <p className="mt-6 text-[12px] font-semibold uppercase tracking-[0.08em] text-white/45">Your referral code</p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={copyCode}
                  className="flex h-14 flex-1 items-center justify-between rounded-2xl border border-dashed border-amber-300/40 bg-black/30 px-4"
                >
                  <span className="text-[22px] font-bold tracking-[0.18em]">{data.code}</span>
                  {copied ? <Check className="h-5 w-5 text-emerald-400" /> : <Copy className="h-5 w-5 text-white/60" />}
                </button>
              </div>
              <button
                type="button"
                onClick={share}
                className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-amber-400 text-[15px] font-semibold text-[#1d1608] active:scale-[0.98]"
              >
                <Share2 className="h-4 w-4" /> Invite friends
              </button>
            </section>

            {/* Stats */}
            <section className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/[0.06] p-4 ring-1 ring-inset ring-white/10">
                <Users className="h-4 w-4 text-sky-400" />
                <p className="mt-2 text-[24px] font-bold">{data.referrals.length}</p>
                <p className="text-[12px] text-white/55">Friends joined</p>
              </div>
              <div className="rounded-2xl bg-white/[0.06] p-4 ring-1 ring-inset ring-white/10">
                <Sparkles className="h-4 w-4 text-amber-300" />
                <p className="mt-2 text-[24px] font-bold">{data.earnedCredits}</p>
                <p className="text-[12px] text-white/55">Credits earned</p>
              </div>
            </section>

            {/* How it works */}
            <section className="mt-7">
              <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.06em] text-white/50">How it works</h3>
              <ol className="space-y-3">
                {[
                  "Share your code or invite link with a friend.",
                  "They enter your code while creating their xivago account.",
                  `You get ${data.rewardCredits} credits, they get ${data.welcomeCredits} bonus credits, straight to your wallets.`,
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/10 text-[13px] font-bold">{i + 1}</span>
                    <p className="pt-1 text-[14px] text-white/75">{step}</p>
                  </li>
                ))}
              </ol>
            </section>

            {/* Late code entry for new accounts that signed up without one */}
            {data.canRedeem && (
              <section className="mt-7 rounded-2xl bg-white/[0.06] p-4 ring-1 ring-inset ring-white/10">
                <p className="flex items-center gap-2 text-[14px] font-semibold">
                  <UserPlus className="h-4 w-4 text-emerald-400" /> Were you invited?
                </p>
                <p className="mt-1 text-[12.5px] text-white/55">Enter your friend&apos;s code to get {data.welcomeCredits} bonus credits.</p>
                <div className="mt-3 flex gap-2">
                  <input
                    value={redeemCode}
                    onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
                    placeholder="Referral code"
                    className="h-11 min-w-0 flex-1 rounded-xl bg-black/40 px-3 text-[14px] tracking-[0.1em] outline-none ring-1 ring-inset ring-white/10 placeholder:tracking-normal placeholder:text-white/35"
                  />
                  <button
                    type="button"
                    onClick={redeem}
                    disabled={redeeming || !redeemCode.trim()}
                    className="h-11 rounded-xl bg-white px-4 text-[14px] font-semibold text-black disabled:opacity-50"
                  >
                    {redeeming ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                  </button>
                </div>
              </section>
            )}

            {/* Friends who joined */}
            {data.referrals.length > 0 && (
              <section className="mt-7">
                <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-[0.06em] text-white/50">Friends who joined</h3>
                <ul className="divide-y divide-white/10 rounded-2xl bg-white/[0.05] ring-1 ring-inset ring-white/10">
                  {data.referrals.map((r) => (
                    <li key={r.id}>
                      <Link href={`/u/${r.id}`} className="flex items-center gap-3 px-4 py-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={r.avatarUrl ?? "/icons/avatar-placeholder.svg"} alt={r.name} className="h-9 w-9 rounded-full bg-neutral-800 object-cover" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-medium">{r.name}</p>
                          <p className="text-[12px] text-white/50">Joined {timeAgo(r.createdAt)}</p>
                        </div>
                        <span className="text-[13px] font-bold text-amber-300">+{data.rewardCredits}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <Link href="/spin" className="mt-7 flex items-center justify-between rounded-2xl bg-gradient-to-r from-[#3b1d6e] to-[#1a0d33] p-4 ring-1 ring-inset ring-white/10">
              <span>
                <span className="block text-[15px] font-bold italic">SPIN&amp;WIN</span>
                <span className="text-[12.5px] text-white/60">Win up to 500 credits</span>
              </span>
              <span className="rounded-full bg-white/15 px-3 py-1.5 text-[12px] font-semibold">Spin</span>
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
