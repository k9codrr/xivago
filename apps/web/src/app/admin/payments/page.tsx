"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Search, X, Receipt, CreditCard, Undo2, Inbox, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { formatPaise } from "@/lib/money";
import { cn } from "@/lib/utils";

interface AdminPayment {
  id: string;
  type: string;
  status: string;
  amountPaise: number;
  currency: string;
  razorpayOrderId: string;
  razorpayPaymentId: string | null;
  demandId: string | null;
  slotCount: number | null;
  failureReason: string | null;
  refundedAt: string | null;
  refundAmountPaise: number | null;
  refundDeductionPaise: number | null;
  refundCredits: number | null;
  razorpayRefundId: string | null;
  refundSpeed: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string };
}

interface AdminRefundRequest {
  id: string;
  reason: string;
  createdAt: string;
  user: { creditBalance: number };
  payment: AdminPayment;
}

interface PaymentDetails {
  method: {
    method: string;
    vpa: string | null;
    bank: string | null;
    wallet: string | null;
    cardLast4: string | null;
    cardNetwork: string | null;
    cardIssuer: string | null;
    email: string | null;
    contact: string | null;
    paymentRrn: string | null;
  };
  refunds: {
    id: string;
    amountPaise: number;
    status: string;
    speedRequested: string | null;
    speedProcessed: string | null;
    arn: string | null;
    rrn: string | null;
    utr: string | null;
    createdAt: number;
  }[];
}

interface AdminInvoice {
  id: string;
  number: string;
  kind: string;
  title: string;
  items: { label: string; credits: number }[];
  totalCredits: number;
  balanceAfter: number;
  demandId: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string };
}

interface RefundQuote {
  paidPaise: number;
  creditsBought: number;
  walletBalance: number;
  refundCredits: number;
  grossPaise: number;
  feePaise: number;
  taxPaise: number;
  instant: boolean;
  instantFeePaise: number;
  instantAvailable: boolean;
  deductionPaise: number;
  netPaise: number;
}

interface Page<T> {
  items: T[];
  total: number;
  nextCursor: string | null;
}

const STATUS_COLOR: Record<string, string> = {
  CAPTURED: "text-brand-600",
  REFUNDED: "text-amber-600",
  FAILED: "text-red-600",
  CREATED: "text-neutral-400",
  AUTHORIZED: "text-neutral-400",
};

const KIND_LABEL: Record<string, string> = {
  SLOT_PURCHASE: "Slot purchase",
  PRIORITY_BOOST: "Priority boost",
  DEMAND_POST: "Demand post",
  FEATURED_BID: "Featured listing",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
}

function Mono({ children }: { children: React.ReactNode }) {
  return <span className="select-all break-all font-mono text-[11px] text-neutral-500 dark:text-neutral-400">{children}</span>;
}

function Spinner() {
  return (
    <div className="flex justify-center py-10 text-neutral-400">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="card-shell px-4 py-8 text-center text-sm text-neutral-500">{children}</p>;
}

function SectionTitle({ icon: Icon, title, count }: { icon: typeof Receipt; title: string; count?: number }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
      <Icon className="size-4 text-neutral-500" />
      {title}
      {count !== undefined && (
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500 dark:bg-neutral-800">
          {count.toLocaleString("en-IN")}
        </span>
      )}
    </h2>
  );
}

/** Server-side search over a whole admin table, one page at a time. */
function usePagedSearch<T>(endpoint: string, key: "payments" | "invoices", query: string, extra?: Record<string, string>) {
  const extraKey = new URLSearchParams(extra).toString();
  const [page, setPage] = useState<Page<T> | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [version, setVersion] = useState(0);

  const fetchPage = useCallback(
    async (cursor: string | null, signal?: AbortSignal): Promise<Page<T>> => {
      const url = new URL(`${endpoint}${extraKey ? `?${extraKey}` : ""}`, window.location.origin);
      if (query) url.searchParams.set("q", query);
      if (cursor) url.searchParams.set("cursor", cursor);
      const res = await fetch(url, { signal });
      if (!res.ok) return { items: [], total: 0, nextCursor: null };
      const data = await res.json();
      return { items: data[key], total: data.total, nextCursor: data.nextCursor };
    },
    [endpoint, key, query, extraKey],
  );

  useEffect(() => {
    const controller = new AbortController();
    setPage(null);
    fetchPage(null, controller.signal)
      .then(setPage)
      .catch(() => {});
    return () => controller.abort();
  }, [fetchPage, version]);

  async function loadMore() {
    if (!page?.nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = await fetchPage(page.nextCursor);
      setPage((cur) => (cur ? { items: [...cur.items, ...next.items], total: next.total, nextCursor: next.nextCursor } : next));
    } finally {
      setLoadingMore(false);
    }
  }

  return { page, loadMore, loadingMore, reload: () => setVersion((v) => v + 1) };
}

function LoadMore({ page, loading, onClick }: { page: Page<unknown>; loading: boolean; onClick: () => void }) {
  if (!page.nextCursor) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="mx-auto mt-3 flex items-center gap-2 rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-800/50"
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      Load more ({page.items.length.toLocaleString("en-IN")} of {page.total.toLocaleString("en-IN")})
    </button>
  );
}

function InvoiceRow({ inv, open, onToggle }: { inv: AdminInvoice; open: boolean; onToggle: () => void }) {
  return (
    <div className="card-shell overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-3 p-4 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">{inv.title}</p>
          <p className="mt-0.5 truncate text-xs text-neutral-500">
            {inv.user.name} · {inv.user.email}
          </p>
          <p className="mt-1 font-mono text-[11px] text-neutral-400">{inv.number}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
            {inv.totalCredits.toLocaleString("en-IN")} cr
          </p>
          <p className="text-xs text-neutral-500">{KIND_LABEL[inv.kind] ?? inv.kind}</p>
          <p className="mt-1 whitespace-nowrap text-[11px] text-neutral-400">{fmtDate(inv.createdAt)}</p>
        </div>
      </button>

      {open && (
        <div className="grid gap-4 border-t border-neutral-100 p-4 text-sm sm:grid-cols-2 dark:border-neutral-800">
          <dl className="space-y-1.5">
            <div>
              <dt className="text-xs text-neutral-500">Invoice ID</dt>
              <dd><Mono>{inv.id}</Mono></dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-500">Customer ID</dt>
              <dd><Mono>{inv.user.id}</Mono></dd>
            </div>
            {inv.demandId && (
              <div>
                <dt className="text-xs text-neutral-500">Post ID</dt>
                <dd className="flex flex-wrap items-center gap-2">
                  <Mono>{inv.demandId}</Mono>
                  <Link href={`/demands/${inv.demandId}`} className="text-xs font-medium underline underline-offset-2">
                    Open post
                  </Link>
                </dd>
              </div>
            )}
          </dl>
          <div>
            <p className="mb-1.5 text-xs text-neutral-500">Items</p>
            <ul className="space-y-1">
              {inv.items.map((it) => (
                <li key={it.label} className="flex justify-between gap-3 dark:text-neutral-300">
                  <span>{it.label}</span>
                  <span className="tabular-nums">{it.credits.toLocaleString("en-IN")} cr</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 border-t border-neutral-100 pt-2 text-xs text-neutral-500 dark:border-neutral-800">
              Balance {(inv.balanceAfter + inv.totalCredits).toLocaleString("en-IN")} →{" "}
              {inv.balanceAfter.toLocaleString("en-IN")} cr
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function RefundDialog({
  payment,
  reason,
  onClose,
  onDone,
}: {
  payment: AdminPayment;
  /** The customer's own words, when this comes from a refund request. */
  reason?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [quote, setQuote] = useState<RefundQuote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [instant, setInstant] = useState(false);

  useEffect(() => {
    setQuote(null);
    setError(null);
    fetch(`/api/admin/payments/${payment.id}/refund${instant ? "?instant=1" : ""}`)
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) setQuote(data.quote);
        else setError(data?.error?.message ?? "Could not work out the refund.");
      })
      .catch(() => setError("Could not work out the refund."));
  }, [payment.id, instant]);

  async function confirmRefund() {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/payments/${payment.id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instant }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? "Refund failed.");
        return;
      }
      const r = data.refund as RefundQuote & { speedProcessed: string | null; instantFeeReturnedPaise: number };
      toast.success(
        `Refunded ${formatPaise(r.netPaise)} to ${payment.user.name}` +
          (r.speedProcessed === "instant" ? " · instant" : "") +
          (r.instantFeeReturnedPaise > 0 ? " · bank only allowed a normal refund, instant fee returned" : ""),
      );
      onDone();
    } finally {
      setSubmitting(false);
    }
  }

  const row = (label: string, value: string, strong = false) => (
    <div className={cn("flex justify-between gap-4", strong && "border-t border-neutral-100 pt-2 font-semibold dark:border-neutral-800")}>
      <span className={strong ? "text-neutral-900 dark:text-neutral-100" : "text-neutral-500"}>{label}</span>
      <span className="text-right tabular-nums dark:text-neutral-100">{value}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Refund payment"
        className="card-shell w-full max-w-sm space-y-4 bg-white p-5 dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">Refund payment</h3>
          <p className="mt-0.5 text-xs text-neutral-500">
            {payment.user.name} · <Mono>{payment.razorpayPaymentId}</Mono>
          </p>
          <p className="mt-1 text-xs text-neutral-500">Goes back to the method they paid with (UPI, card or bank).</p>
        </div>

        {reason && (
          <blockquote className="rounded-lg bg-neutral-50 px-3 py-2 text-sm text-neutral-700 dark:bg-neutral-800/60 dark:text-neutral-300">
            “{reason}”
          </blockquote>
        )}

        <label
          className={cn(
            "flex items-start justify-between gap-3 rounded-lg border border-neutral-200 px-3 py-2 dark:border-neutral-800",
            quote && !quote.instantAvailable && "opacity-60",
          )}
        >
          <span className="text-sm">
            <span className="font-medium text-neutral-900 dark:text-neutral-100">Instant refund</span>
            <span className="block text-xs text-neutral-500">
              {quote && !quote.instantAvailable
                ? "Set RAZORPAY_INSTANT_REFUND_FEE_PAISE to turn this on."
                : "Arrives in minutes. Razorpay's instant fee + GST comes off the refund; returned if the bank only allows a normal refund."}
            </span>
          </span>
          <input
            type="checkbox"
            className="mt-1 size-4 accent-red-600"
            checked={instant}
            disabled={submitting || (quote != null && !quote.instantAvailable)}
            onChange={(e) => setInstant(e.target.checked)}
          />
        </label>

        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>
        ) : !quote ? (
          <Spinner />
        ) : (
          <div className="space-y-1.5 text-sm">
            {row("Paid", formatPaise(quote.paidPaise))}
            {row("Credits bought", quote.creditsBought.toLocaleString("en-IN"))}
            {row(
              "Unspent, taken back",
              `${quote.refundCredits.toLocaleString("en-IN")} (wallet has ${quote.walletBalance.toLocaleString("en-IN")})`,
            )}
            {row("Value of unspent credits", formatPaise(quote.grossPaise))}
            {row("Razorpay fee", `− ${formatPaise(Math.max(0, quote.feePaise - quote.taxPaise))}`)}
            {row("GST on fee", `− ${formatPaise(quote.taxPaise)}`)}
            {quote.instant && row("Instant refund fee (incl. GST)", `− ${formatPaise(quote.instantFeePaise)}`)}
            {row("Customer receives", formatPaise(quote.netPaise), true)}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirmRefund}
            disabled={!quote || quote.netPaise <= 0 || submitting || !!error}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {submitting && <Loader2 className="size-4 animate-spin" />}
            Refund {quote ? formatPaise(quote.netPaise) : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

const METHOD_LABEL: Record<string, string> = {
  upi: "UPI",
  card: "Card",
  netbanking: "Netbanking",
  wallet: "Wallet",
  emi: "EMI",
  paylater: "Pay later",
};

const REFUND_STATUS_COLOR: Record<string, string> = {
  processed: "text-brand-600",
  pending: "text-amber-600",
  failed: "text-red-600",
};

/** Live from Razorpay: how they paid, and each refund with the bank reference to trace it. */
function PaymentDetailsPanel({ paymentId }: { paymentId: string }) {
  const [details, setDetails] = useState<PaymentDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/payments/${paymentId}/details`)
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) setDetails(data);
        else setError(data?.error?.message ?? "Could not load details.");
      })
      .catch(() => setError("Could not load details."));
  }, [paymentId]);

  if (error) return <p className="text-xs text-red-600">{error}</p>;
  if (!details) return <Loader2 className="size-4 animate-spin text-neutral-400" />;

  const m = details.method;
  const paidFrom =
    m.method === "upi"
      ? m.vpa ?? "UPI"
      : m.method === "card"
        ? [m.cardNetwork, m.cardLast4 && `•••• ${m.cardLast4}`, m.cardIssuer && `(${m.cardIssuer})`].filter(Boolean).join(" ")
        : m.method === "netbanking"
          ? m.bank ?? "Netbanking"
          : m.method === "wallet"
            ? m.wallet ?? "Wallet"
            : m.method;

  return (
    <div className="grid gap-4 text-xs sm:grid-cols-2">
      <dl className="space-y-1">
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 text-neutral-500">Paid with</dt>
          <dd className="font-medium text-neutral-900 dark:text-neutral-100">
            {METHOD_LABEL[m.method] ?? m.method} · <span className="select-all">{paidFrom}</span>
          </dd>
        </div>
        {m.paymentRrn && (
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-neutral-500">Bank ref</dt>
            <dd><Mono>{m.paymentRrn}</Mono></dd>
          </div>
        )}
        {(m.contact || m.email) && (
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-neutral-500">Payer</dt>
            <dd className="text-neutral-700 dark:text-neutral-300">{[m.contact, m.email].filter(Boolean).join(" · ")}</dd>
          </div>
        )}
      </dl>
      <div>
        <p className="mb-1 text-neutral-500">Refunds</p>
        {details.refunds.length === 0 ? (
          <p className="text-neutral-400">None</p>
        ) : (
          <ul className="space-y-2">
            {details.refunds.map((r) => (
              <li key={r.id} className="space-y-0.5">
                <p>
                  <span className="font-medium tabular-nums text-neutral-900 dark:text-neutral-100">{formatPaise(r.amountPaise)}</span>{" "}
                  <span className={cn("font-semibold uppercase", REFUND_STATUS_COLOR[r.status] ?? "text-neutral-500")}>{r.status}</span>
                  {r.speedProcessed && <span className="text-neutral-500"> · {r.speedProcessed}</span>}
                  <span className="text-neutral-400"> · {fmtDate(new Date(r.createdAt * 1000).toISOString())}</span>
                </p>
                <p><Mono>{r.id}</Mono></p>
                {r.arn || r.rrn || r.utr ? (
                  <p className="text-neutral-500">
                    {r.arn && <>ARN <Mono>{r.arn}</Mono> </>}
                    {r.rrn && <>RRN <Mono>{r.rrn}</Mono> </>}
                    {r.utr && <>UTR <Mono>{r.utr}</Mono></>}
                  </p>
                ) : (
                  <p className="text-neutral-400">Bank reference appears once the bank processes it.</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function RefundRequestsSection({
  requests,
  onReview,
  onChanged,
}: {
  requests: AdminRefundRequest[] | null;
  onReview: (r: AdminRefundRequest) => void;
  onChanged: () => void;
}) {
  const [declining, setDeclining] = useState<string | null>(null);

  async function decline(r: AdminRefundRequest) {
    const note = window.prompt(`Why are you declining ${r.payment.user.name}'s request? They'll see this.`);
    if (!note?.trim()) return;
    setDeclining(r.id);
    try {
      const res = await fetch(`/api/admin/refund-requests/${r.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      const data = await res.json();
      if (!res.ok) toast.error(data?.error?.message ?? "Could not decline.");
      else toast.success("Request declined");
      onChanged();
    } finally {
      setDeclining(null);
    }
  }

  if (requests === null || requests.length === 0) return null;

  return (
    <section>
      <SectionTitle icon={Inbox} title="Refund requests" count={requests.length} />
      <div className="space-y-2">
        {requests.map((r) => {
          const refundable = r.payment.status === "CAPTURED" && !r.payment.refundedAt;
          return (
            <div key={r.id} className="card-shell flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  {r.payment.user.name}{" "}
                  <span className="font-normal text-neutral-500">
                    · {formatPaise(r.payment.amountPaise)} top-up · {r.user.creditBalance.toLocaleString("en-IN")} cr in wallet
                  </span>
                </p>
                <p className="text-xs text-neutral-500">
                  {r.payment.user.email} · asked {fmtDate(r.createdAt)}
                </p>
                <p className="whitespace-pre-wrap break-words text-sm text-neutral-700 dark:text-neutral-300">“{r.reason}”</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => decline(r)}
                  disabled={declining === r.id}
                  className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-800/50"
                >
                  Decline
                </button>
                <button
                  type="button"
                  onClick={() => onReview(r)}
                  disabled={!refundable}
                  className="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  <Undo2 className="size-3.5" /> Review & refund
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function AdminPaymentsPage() {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [refunding, setRefunding] = useState<{ payment: AdminPayment; reason?: string } | null>(null);
  const [refundableOnly, setRefundableOnly] = useState(false);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [requests, setRequests] = useState<AdminRefundRequest[] | null>(null);

  const loadRequests = useCallback(() => {
    fetch("/api/admin/refund-requests")
      .then((res) => (res.ok ? res.json() : { requests: [] }))
      .then((data) => setRequests(data.requests))
      .catch(() => setRequests([]));
  }, []);
  useEffect(loadRequests, [loadRequests]);

  // Debounced; both tables are searched in full on the server.
  useEffect(() => {
    const t = setTimeout(() => setQuery(input.trim()), 300);
    return () => clearTimeout(t);
  }, [input]);

  const invoicesPage = usePagedSearch<AdminInvoice>("/api/admin/invoices", "invoices", query);
  const paymentsPage = usePagedSearch<AdminPayment>(
    "/api/admin/payments",
    "payments",
    query,
    refundableOnly ? { refundable: "1" } : undefined,
  );
  const invoices = invoicesPage.page?.items ?? null;
  const payments = paymentsPage.page?.items ?? null;

  useEffect(() => {
    const only = invoicesPage.page?.items;
    if (query && only?.length === 1) setOpenId(only[0]!.id);
  }, [query, invoicesPage.page]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">Payments</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Look up wallet invoices and Razorpay payments for refunds or disputes.
        </p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search any part of an invoice, customer, post, order or payment ID, email or name"
          className="h-11 w-full rounded-xl border border-neutral-200 bg-white pl-9 pr-9 text-sm outline-none transition focus:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-600"
        />
        {input && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setInput("")}
            className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <RefundRequestsSection
        requests={requests}
        onReview={(r) => setRefunding({ payment: r.payment, reason: r.reason })}
        onChanged={loadRequests}
      />

      <section>
        <SectionTitle icon={Receipt} title={query ? "Matching invoices" : "Recent invoices"} count={invoicesPage.page?.total} />
        {invoices === null ? (
          <Spinner />
        ) : invoices.length === 0 ? (
          <Empty>No invoices found{query && <> for “{query}”</>}.</Empty>
        ) : (
          <div className="space-y-2">
            {invoices.map((inv) => (
              <InvoiceRow
                key={inv.id}
                inv={inv}
                open={openId === inv.id}
                onToggle={() => setOpenId((cur) => (cur === inv.id ? null : inv.id))}
              />
            ))}
            <LoadMore page={invoicesPage.page!} loading={invoicesPage.loadingMore} onClick={invoicesPage.loadMore} />
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <SectionTitle icon={CreditCard} title="Razorpay payments" count={paymentsPage.page?.total} />
          <button
            type="button"
            aria-pressed={refundableOnly}
            onClick={() => setRefundableOnly((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              refundableOnly
                ? "border-red-600 bg-red-600 text-white"
                : "border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-800/50",
            )}
          >
            <Undo2 className="size-3.5" /> Refundable only
          </button>
        </div>
        <p className="-mt-1 mb-3 text-xs text-neutral-500">
          Refunds work on captured credit top-ups (type CREDITS). Slot purchases can&apos;t be refunded from here.
        </p>
        {payments === null ? (
          <Spinner />
        ) : payments.length === 0 ? (
          <Empty>No payments found{query && <> for “{query}”</>}.</Empty>
        ) : (
          <>
            <div className="card-shell overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-neutral-100 text-xs text-neutral-400 dark:border-neutral-800">
                  <tr>
                    <th className="px-3 py-2">User</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Amount</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Order / Payment ID</th>
                    <th className="px-3 py-2">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {payments.map((p) => (
                    <Fragment key={p.id}>
                    <tr>
                      <td className="px-3 py-2">
                        <p className="font-medium dark:text-neutral-100">{p.user.name}</p>
                        <p className="text-xs text-neutral-400">{p.user.email}</p>
                        <Mono>{p.user.id}</Mono>
                      </td>
                      <td className="px-3 py-2 dark:text-neutral-300">{p.type}</td>
                      <td className="px-3 py-2 dark:text-neutral-300">
                        {formatPaise(p.amountPaise)}
                        {p.type === "CREDITS" && p.status === "CAPTURED" && !p.refundedAt && p.razorpayPaymentId && (
                          <button
                            type="button"
                            onClick={() => setRefunding({ payment: p })}
                            className="mt-1 flex items-center gap-1 rounded-lg bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700"
                          >
                            <Undo2 className="size-3.5" /> Refund
                          </button>
                        )}
                      </td>
                      <td className={cn("px-3 py-2 font-semibold", STATUS_COLOR[p.status] ?? "text-neutral-400")}>
                        {p.status}
                        {p.failureReason && <span className="block text-[10px] font-normal text-neutral-400">{p.failureReason}</span>}
                        {p.refundAmountPaise != null && (
                          <span className="block text-[10px] font-normal text-neutral-500">
                            {formatPaise(p.refundAmountPaise)} back
                            {p.refundDeductionPaise ? ` (−${formatPaise(p.refundDeductionPaise)} fee+GST)` : ""}
                            {p.refundCredits ? ` · ${p.refundCredits} cr taken` : ""}
                            {p.refundSpeed ? ` · ${p.refundSpeed}` : ""}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] text-neutral-400">
                        {p.razorpayOrderId}
                        {p.razorpayPaymentId && <span className="block">{p.razorpayPaymentId}</span>}
                        {p.demandId && <span className="block">post: {p.demandId}</span>}
                        {p.razorpayRefundId && <span className="block">refund: {p.razorpayRefundId}</span>}
                        {p.razorpayPaymentId && (
                          <button
                            type="button"
                            onClick={() => setDetailsId((cur) => (cur === p.id ? null : p.id))}
                            aria-expanded={detailsId === p.id}
                            className="mt-1 flex items-center gap-0.5 font-sans text-xs font-medium text-neutral-600 underline-offset-2 hover:underline dark:text-neutral-300"
                          >
                            Method & refund status
                            <ChevronDown className={cn("size-3.5 transition-transform", detailsId === p.id && "rotate-180")} />
                          </button>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-neutral-400">{fmtDate(p.createdAt)}</td>
                    </tr>
                    {detailsId === p.id && (
                      <tr className="bg-neutral-50/60 dark:bg-neutral-800/30">
                        <td colSpan={6} className="px-3 py-3">
                          <PaymentDetailsPanel paymentId={p.id} />
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <LoadMore page={paymentsPage.page!} loading={paymentsPage.loadingMore} onClick={paymentsPage.loadMore} />
          </>
        )}
      </section>

      {refunding && (
        <RefundDialog
          payment={refunding.payment}
          reason={refunding.reason}
          onClose={() => setRefunding(null)}
          onDone={() => {
            setRefunding(null);
            paymentsPage.reload();
            loadRequests();
          }}
        />
      )}
    </div>
  );
}
