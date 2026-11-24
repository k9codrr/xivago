"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Undo2 } from "lucide-react";
import { formatPaise } from "@/lib/money";
import { cn } from "@/lib/utils";

interface RefundRequest {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  reason: string;
  adminNote: string | null;
  createdAt: string;
  decidedAt: string | null;
}

interface TopUp {
  id: string;
  status: "CAPTURED" | "REFUNDED";
  amountPaise: number;
  credits: number;
  createdAt: string;
  refundedAt: string | null;
  refundAmountPaise: number | null;
  refundDeductionPaise: number | null;
  refundCredits: number | null;
  refundSpeed: string | null;
  request: RefundRequest | null;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function StatusLine({ t }: { t: TopUp }) {
  if (t.status === "REFUNDED") {
    return (
      <p className="text-xs text-mint">
        {formatPaise(t.refundAmountPaise ?? 0)} refunded {t.refundedAt && `on ${fmtDate(t.refundedAt)}`}
        {t.refundSpeed === "instant" ? " · instant" : " · reaches your account in 5–7 working days"}
        {t.refundDeductionPaise ? (
          <span className="block text-neutral-500">
            {formatPaise(t.refundDeductionPaise)} kept for payment-gateway fees and GST
            {t.refundCredits ? ` · ${t.refundCredits.toLocaleString("en-IN")} credits taken back` : ""}
          </span>
        ) : null}
      </p>
    );
  }
  const r = t.request;
  if (r?.status === "PENDING") return <p className="text-xs text-amber-400">Refund requested {fmtDate(r.createdAt)} · we&apos;re reviewing it</p>;
  if (r?.status === "REJECTED") {
    return (
      <p className="text-xs text-red-400">
        Refund declined{r.adminNote && <span className="block text-neutral-400">“{r.adminNote}”</span>}
      </p>
    );
  }
  return null;
}

function RequestSheet({ topUp, onClose, onSent }: { topUp: TopUp; onClose: () => void; onSent: () => void }) {
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    setSending(true);
    try {
      const res = await fetch(`/api/payments/${topUp.id}/refund-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error?.message ?? "Could not send your request.");
        return;
      }
      toast.success("Withdrawal requested. We'll let you know.");
      onSent();
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Request a withdrawal"
        className="w-full max-w-md space-y-4 rounded-t-3xl border border-white/10 bg-neutral-950 p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 className="text-lg font-semibold text-white">Withdraw to your bank</h2>
          <p className="mt-1 text-sm text-neutral-400">
            {formatPaise(topUp.amountPaise)} top-up on {fmtDate(topUp.createdAt)}
          </p>
        </div>
        <ul className="space-y-1.5 text-[13px] text-neutral-400">
          <li>• Money goes back to the UPI, card or bank you paid with.</li>
          <li>• Only credits you haven&apos;t spent can be withdrawn, and they leave your wallet. 1 credit = ₹1, less fees and GST.</li>
          <li>• Payment-gateway fees and GST on them are non-refundable.</li>
        </ul>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value.slice(0, 500))}
          rows={3}
          placeholder="Why do you want to withdraw?"
          aria-label="Reason"
          className="w-full resize-none rounded-xl bg-white/10 px-3 py-2.5 text-[15px] text-white outline-none placeholder:text-neutral-500 focus-visible:ring-2 focus-visible:ring-white/25"
        />
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="h-11 flex-1 rounded-full border border-white/15 text-sm text-neutral-300">
            Cancel
          </button>
          <button
            type="button"
            onClick={send}
            disabled={sending || reason.trim().length < 5}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-white text-sm font-semibold text-black disabled:opacity-50"
          >
            {sending && <Loader2 className="h-4 w-4 animate-spin" />}
            Send request
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TopUpRefundsPage() {
  const router = useRouter();
  const [topUps, setTopUps] = useState<TopUp[] | null>(null);
  const [requesting, setRequesting] = useState<TopUp | null>(null);
  const [withdrawing, setWithdrawing] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/payments/refunds")
      .then((res) => (res.ok ? res.json() : { topUps: [] }))
      .then((data) => setTopUps(data.topUps))
      .catch(() => setTopUps([]));
  }, []);
  useEffect(load, [load]);

  async function withdraw(requestId: string) {
    setWithdrawing(requestId);
    try {
      const res = await fetch(`/api/refund-requests/${requestId}`, { method: "DELETE" });
      if (!res.ok) toast.error("Could not withdraw the request.");
      load();
    } finally {
      setWithdrawing(null);
    }
  }

  return (
    <main className="min-h-dvh bg-black pb-24 text-white">
      <header className="sticky top-0 z-20 grid grid-cols-[3rem_1fr_3rem] items-center bg-black/80 px-2 pb-2 pt-[max(env(safe-area-inset-top),0.5rem)] backdrop-blur-xl">
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? router.back() : router.push("/credits"))}
          aria-label="Back"
          className="flex h-11 w-11 items-center justify-center rounded-full active:bg-white/10"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-center text-[17px] font-semibold">Top-ups & withdrawals</h1>
      </header>

      <p className="px-4 pb-4 pt-1 text-sm text-neutral-400">
        Bought credits you don&apos;t need? Ask for the unspent part back to your bank.
      </p>

      {topUps === null ? (
        <div className="flex justify-center py-16 text-neutral-500">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : topUps.length === 0 ? (
        <p className="px-6 py-16 text-center text-sm text-neutral-500">You haven&apos;t bought any credits yet.</p>
      ) : (
        <ul className="divide-y divide-neutral-800 border-y border-neutral-800">
          {topUps.map((t) => {
            const pending = t.request?.status === "PENDING";
            const canRequest = t.status === "CAPTURED" && !pending;
            return (
              <li key={t.id} className="flex items-start justify-between gap-3 px-4 py-3.5">
                <div className="min-w-0 space-y-1">
                  <p className="text-[15px] font-medium">
                    {formatPaise(t.amountPaise)}{" "}
                    <span className="font-normal text-neutral-500">· {t.credits.toLocaleString("en-IN")} credits</span>
                  </p>
                  <p className="text-xs text-neutral-500">{fmtDate(t.createdAt)}</p>
                  <StatusLine t={t} />
                </div>
                {canRequest && (
                  <button
                    type="button"
                    onClick={() => setRequesting(t)}
                    className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-[13px] font-medium"
                  >
                    <Undo2 className="h-3.5 w-3.5" /> Withdraw
                  </button>
                )}
                {pending && t.request && (
                  <button
                    type="button"
                    onClick={() => withdraw(t.request!.id)}
                    disabled={withdrawing === t.request.id}
                    className={cn("shrink-0 rounded-full px-3 py-1.5 text-[13px] text-neutral-400", withdrawing === t.request.id && "opacity-50")}
                  >
                    Withdraw
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {requesting && (
        <RequestSheet
          topUp={requesting}
          onClose={() => setRequesting(null)}
          onSent={() => {
            setRequesting(null);
            load();
          }}
        />
      )}
    </main>
  );
}
