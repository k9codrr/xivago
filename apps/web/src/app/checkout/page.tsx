"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Bell,
  CreditCard,
  Gift,
  LayoutGrid,
  Loader2,
  Plus,
  QrCode,
  ScanQrCode,
  Search,
  Zap,
} from "lucide-react";
import { formatPaise } from "@/lib/money";
import { publicEnv } from "@/lib/env";
import { openRazorpaySubscriptionCheckout } from "@/lib/razorpay-checkout";
import { AddCreditsModal } from "@/components/add-credits-modal";
import { QrScannerModal } from "@/components/qr-scanner-modal";
import { ProfileQrModal } from "@/components/profile-qr-modal";

type SpendCategory = "POSTING" | "BOOSTS" | "SLOTS" | "OTHER";

interface Wallet {
  profile: {
    id: string;
    name: string;
    avatarUrl: string | null;
    creditBalance: number;
    subscription: { plan: "FREE" | "PRO"; status: string; currentPeriodEnd: string | null } | null;
  };
  spending: Record<SpendCategory, number>;
  received: { key: string; type: string }[];
}

// Same order and colours as the bars in the wallet design.
const SPEND_BARS: { key: SpendCategory; label: string; color: string }[] = [
  { key: "POSTING", label: "Posting fees", color: "#6522f5" },
  { key: "BOOSTS", label: "Featured boosts", color: "#f05a5a" },
  { key: "SLOTS", label: "Response spots", color: "#23a948" },
  { key: "OTHER", label: "Other", color: "#2d8cf0" },
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

// useSearchParams needs a Suspense boundary so the page can still prerender.
export default function CheckoutPage() {
  return (
    <Suspense fallback={<WalletLoading />}>
      <CheckoutWallet />
    </Suspense>
  );
}

function WalletLoading() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-black text-neutral-500">
      <Loader2 className="h-5 w-5 animate-spin" />
    </main>
  );
}

function CheckoutWallet() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const trialExpired = searchParams.get("reason") === "trial_expired";

  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [busy, setBusy] = useState(false);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [myQrOpen, setMyQrOpen] = useState(false);

  const loadWallet = useCallback(async () => {
    const res = await fetch("/api/users/me/wallet");
    if (res.ok) setWallet(await res.json());
  }, []);

  useEffect(() => {
    void loadWallet();
  }, [loadWallet]);

  const profile = wallet?.profile;
  const isPro = profile?.subscription?.plan === "PRO" && profile.subscription.status === "ACTIVE";
  const priceLabel = formatPaise(publicEnv.NEXT_PUBLIC_PRO_PLAN_PRICE_PAISE);
  const monthName = new Date().toLocaleString("en-IN", { month: "long" });
  const spentTotal = wallet ? Object.values(wallet.spending).reduce((a, b) => a + b, 0) : 0;

  async function handleSubscribe() {
    if (!session?.user) {
      router.push("/login?callbackUrl=/checkout");
      return;
    }
    setBusy(true);
    try {
      const orderRes = await fetch("/api/subscriptions/create", { method: "POST" });
      const orderData = await orderRes.json();
      if (!orderRes.ok) {
        toast.error(orderData?.error?.message ?? "Could not start checkout.");
        return;
      }

      try {
        await openRazorpaySubscriptionCheckout({
          key: orderData.keyId,
          subscription_id: orderData.razorpaySubId,
          name: "xivago PRO",
          description: "Monthly PRO subscription",
          prefill: { name: session.user.name ?? undefined, email: session.user.email ?? undefined },
          theme: { color: "#0d9488" },
        });
      } catch (err) {
        if (err instanceof Error && err.message === "CHECKOUT_DISMISSED") {
          toast.info("Checkout cancelled.");
        } else {
          toast.error("Could not open checkout.");
        }
        return;
      }

      toast.success("Payment authorized! Activating PRO — this can take a few seconds.");
      setTimeout(() => {
        void loadWallet();
        router.refresh();
      }, 2000);
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    setBusy(true);
    try {
      const res = await fetch("/api/subscriptions/cancel", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error?.message ?? "Could not cancel your subscription.");
        return;
      }
      toast.success(data.message ?? "Subscription cancelled.");
      void loadWallet();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!wallet || !profile) return <WalletLoading />;

  const cardSuffix = profile.id.slice(-4).toUpperCase();

  return (
    <main className="min-h-dvh bg-black px-4 pb-28 pt-[max(env(safe-area-inset-top),1.25rem)] text-white">
      {/* ── Header ── */}
      <header className="flex items-center gap-3">
        <Link
          href="/profile"
          className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white text-sm font-bold text-black"
        >
          {profile.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatarUrl} alt={profile.name} className="h-full w-full object-cover" />
          ) : (
            initials(profile.name)
          )}
        </Link>
        <Link
          href="/search"
          className="flex h-11 flex-1 items-center gap-2.5 rounded-xl bg-[#1c1c1e] px-3.5 text-[15px] text-neutral-500"
        >
          <Search className="h-[18px] w-[18px]" /> Search
        </Link>
        <button type="button" aria-label="My QR code" onClick={() => setMyQrOpen(true)} className="p-1">
          <QrCode className="h-[22px] w-[22px]" />
        </button>
        <Link href="/chats" aria-label="Messages" className="p-1">
          <Bell className="h-[22px] w-[22px]" />
        </Link>
      </header>

      {/* ── Wallet card ── */}
      <section className="relative mt-7 overflow-hidden rounded-[22px] bg-gradient-to-br from-[#262626] via-[#2c2c2c] to-[#454545] p-5">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_45%,rgba(255,255,255,0.06)_60%,transparent_75%)]" />
        <div className="relative flex items-start justify-between">
          <div>
            <p className="text-[15px] font-semibold">Wallet</p>
            <p className="mt-2 text-[22px] font-medium text-neutral-400">{profile.name}</p>
          </div>
          <button type="button" aria-label="Add credits" onClick={() => setTopUpOpen(true)} className="-mr-1 p-1">
            <Plus className="h-6 w-6" />
          </button>
        </div>
        <div className="relative mt-16 flex items-end justify-between">
          <div>
            <p className="text-[32px] font-bold leading-none tracking-tight">
              {profile.creditBalance.toLocaleString("en-IN")}
              <span className="ml-1.5 text-base font-semibold text-neutral-400">credits</span>
            </p>
            <p className="mt-2 text-[15px] text-neutral-400">1 Credit = ₹1</p>
          </div>
          <div className="flex flex-col items-end gap-2.5">
            <span className="flex">
              <span className="h-5 w-5 rounded-full bg-[#eb001b]" />
              <span className="-ml-2 h-5 w-5 rounded-full bg-[#f79e1b] mix-blend-screen" />
            </span>
            <p className="text-[15px] text-neutral-500">
              {isPro ? "PRO" : "FREE"} **** {cardSuffix}
            </p>
          </div>
        </div>
      </section>

      {/* ── Spending / Received ── */}
      <section className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-[22px] bg-[#1c1c1e] p-4">
          <p className="text-[15px] font-semibold">Spending</p>
          <p className="mt-0.5 text-[14px] text-neutral-400">
            {spentTotal > 0 ? `${spentTotal.toLocaleString("en-IN")} in ${monthName}` : `Spent in ${monthName}`}
          </p>
          <div className="mt-4 flex h-6 gap-1">
            {spentTotal > 0 ? (
              SPEND_BARS.filter((b) => wallet.spending[b.key] > 0).map((b) => (
                <span
                  key={b.key}
                  title={`${b.label}: ${wallet.spending[b.key]} credits`}
                  className="min-w-[6px] rounded-full"
                  style={{ backgroundColor: b.color, flexGrow: wallet.spending[b.key] }}
                />
              ))
            ) : (
              <span className="flex-1 rounded-full bg-neutral-800" />
            )}
          </div>
        </div>

        <div className="rounded-[22px] bg-[#1c1c1e] p-4">
          <p className="text-[15px] font-semibold">Received</p>
          <div className="mt-[30px] flex">
            {wallet.received.length === 0 ? (
              <p className="text-[14px] text-neutral-500">No credits yet</p>
            ) : (
              wallet.received.map((r) => (
                <span
                  key={r.key}
                  title={r.type === "PURCHASE" ? "Top-up" : "Grant"}
                  className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white text-xs font-bold text-black"
                >
                  {r.type === "PURCHASE" ? (
                    <CreditCard className="h-4 w-4" />
                  ) : (
                    <Gift className="h-4 w-4" />
                  )}
                </span>
              ))
            )}
          </div>
        </div>
      </section>

      {/* ── Quick actions ── */}
      <section className="mt-3 flex gap-3">
        <div className="flex flex-col gap-3">
          <button
            type="button"
            aria-label="Scan QR"
            onClick={() => setScannerOpen(true)}
            className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-[#1c1c1e]"
          >
            <ScanQrCode className="h-6 w-6" />
          </button>
          <button
            type="button"
            aria-label="Add credits"
            onClick={() => setTopUpOpen(true)}
            className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-[#1c1c1e]"
          >
            <Plus className="h-6 w-6" />
          </button>
        </div>
        <Link href="/explore" className="flex flex-1 flex-col justify-between rounded-[22px] bg-[#1c1c1e] p-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#2c2c2e]">
            <LayoutGrid className="h-5 w-5" />
          </span>
          <span className="text-[15px] font-medium">Explore requests</span>
        </Link>
      </section>

      {/* ── PRO plan ── */}
      <section className="relative mt-3 overflow-hidden rounded-[22px] bg-[#1c1c1e] p-4">
        <div className="pointer-events-none absolute -right-3 top-1/2 h-32 w-32 -translate-y-1/2 rounded-full border border-neutral-700/70 shadow-[inset_0_0_24px_rgba(255,255,255,0.06)]" />
        <div className="pointer-events-none absolute bottom-3 right-2 h-10 w-10 rounded-full bg-[radial-gradient(circle_at_35%_30%,#6b6b6b,#0a0a0a_70%)]" />

        <div className="relative max-w-[66%]">
          <p className="flex items-center gap-1.5 text-[15px] font-semibold">
            <Zap className="h-4 w-4 fill-amber-400 text-amber-400" /> xivago PRO
          </p>
          <p className="mt-2 text-[14px] leading-snug text-neutral-400">
            {isPro
              ? profile.subscription?.currentPeriodEnd
                ? `You're on PRO. Renews ${new Date(profile.subscription.currentPeriodEnd).toLocaleDateString("en-IN", { dateStyle: "medium" })}.`
                : "You're on PRO."
              : trialExpired
                ? `Your 7-day free trial has ended. Upgrade for ${priceLabel}/mo to restore access.`
                : `Unlock the community feed and a PRO badge for ${priceLabel}/mo.`}
          </p>
          <button
            type="button"
            onClick={isPro ? handleCancel : handleSubscribe}
            disabled={busy}
            className="mt-4 flex items-center gap-1.5 rounded-lg bg-[#2c2c2e] px-2.5 py-1.5 text-[13px] font-medium disabled:opacity-50"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isPro ? "Cancel subscription" : "Subscribe"}
          </button>
        </div>
      </section>

      <AddCreditsModal
        open={topUpOpen}
        onClose={() => setTopUpOpen(false)}
        currentBalance={profile.creditBalance}
        onSuccess={() => void loadWallet()}
      />
      <QrScannerModal open={scannerOpen} onClose={() => setScannerOpen(false)} />
      <ProfileQrModal open={myQrOpen} onClose={() => setMyQrOpen(false)} userId={profile.id} name={profile.name} />
    </main>
  );
}
