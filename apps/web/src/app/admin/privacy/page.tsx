"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type CheckboxEvent = { action: "checked" | "unchecked"; at: string };

interface ConsentRow {
  id: string;
  userId: string;
  policyVersion: string;
  source: string;
  checkboxEvents: CheckboxEvent[] | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string } | null;
}

interface DeletionRow {
  id: string;
  userId: string;
  maskedEmail: string | null;
  maskedPhone: string | null;
  role: string;
  accountCreatedAt: string;
  deletedBy: string;
  reason: string | null;
  removedCounts: Record<string, number>;
  creditsForfeited: number;
  ipAddress: string | null;
  deletedAt: string;
  financialRecord: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    totals: {
      paymentCount: number;
      capturedPaise: number;
      refundedPaise: number;
      invoiceCount: number;
      invoiceCredits: number;
    };
    retainUntil: string;
  } | null;
}

interface RetainedPayment {
  id: string;
  type: string;
  status: string;
  amountPaise: number;
  currency: string;
  razorpayOrderId: string;
  razorpayPaymentId: string | null;
  refundAmountPaise: number | null;
  refundedAt: string | null;
  createdAt: string;
}

interface RetainedInvoice {
  id: string;
  number: string;
  kind: string;
  title: string;
  totalCredits: number;
  billedToName: string;
  createdAt: string;
}

interface FinancialRecord {
  name: string;
  email: string;
  phone: string | null;
  companyName: string | null;
  retainUntil: string;
  payments: RetainedPayment[];
  invoices: RetainedInvoice[];
  creditTransactions: unknown[];
  refundRequests: unknown[];
}

const rupees = (paise: number) =>
  `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function FinancialRecordPanel({ deletionId }: { deletionId: string }) {
  const [record, setRecord] = useState<FinancialRecord | null | undefined>(undefined);

  useEffect(() => {
    fetch(`/api/admin/privacy/financial/${deletionId}`)
      .then((res) => (res.ok ? res.json() : { record: null }))
      .then((data) => setRecord(data.record ?? null))
      .catch(() => setRecord(null));
  }, [deletionId]);

  if (record === undefined) return <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />;
  if (record === null) return <p className="text-xs text-neutral-500">No financial record kept for this account.</p>;

  const th = "px-2 py-1 font-medium";
  const td = "px-2 py-1 align-top";
  return (
    <div className="space-y-4 text-xs text-neutral-600 dark:text-neutral-300">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-neutral-900 dark:text-neutral-100">{record.name}</p>
          <p>{record.email}</p>
          {record.phone && <p>{record.phone}</p>}
          {record.companyName && <p>{record.companyName}</p>}
          <p className="mt-1 text-neutral-400">Kept until {new Date(record.retainUntil).toLocaleDateString("en-IN")}</p>
        </div>
        <a
          href={`/api/admin/privacy/financial/${deletionId}?download=1`}
          className="rounded-lg border border-neutral-200 px-3 py-1.5 font-medium text-brand-600 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          Download JSON
        </a>
      </div>

      <div>
        <p className="mb-1 font-semibold text-neutral-900 dark:text-neutral-100">Payments ({record.payments.length})</p>
        {record.payments.length === 0 ? (
          <p className="text-neutral-400">None</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead className="text-neutral-400">
                <tr>
                  <th className={th}>Date &amp; time</th>
                  <th className={th}>Type</th>
                  <th className={th}>Status</th>
                  <th className={th}>Amount</th>
                  <th className={th}>Refunded</th>
                  <th className={th}>Razorpay order / payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {record.payments.map((p) => (
                  <tr key={p.id}>
                    <td className={`${td} whitespace-nowrap`}>{fmt(p.createdAt)}</td>
                    <td className={td}>{p.type}</td>
                    <td className={td}>{p.status}</td>
                    <td className={td}>{rupees(p.amountPaise)}</td>
                    <td className={td}>
                      {p.refundAmountPaise != null
                        ? `${rupees(p.refundAmountPaise)}${p.refundedAt ? ` · ${fmt(p.refundedAt)}` : ""}`
                        : "—"}
                    </td>
                    <td className={`${td} font-mono text-[11px]`}>
                      {p.razorpayOrderId}
                      <br />
                      {p.razorpayPaymentId ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <p className="mb-1 font-semibold text-neutral-900 dark:text-neutral-100">Invoices ({record.invoices.length})</p>
        {record.invoices.length === 0 ? (
          <p className="text-neutral-400">None</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left">
              <thead className="text-neutral-400">
                <tr>
                  <th className={th}>Number</th>
                  <th className={th}>Date &amp; time</th>
                  <th className={th}>For</th>
                  <th className={th}>Credits</th>
                  <th className={th}>Billed to</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {record.invoices.map((i) => (
                  <tr key={i.id}>
                    <td className={`${td} font-mono`}>{i.number}</td>
                    <td className={`${td} whitespace-nowrap`}>{fmt(i.createdAt)}</td>
                    <td className={td}>{i.title}</td>
                    <td className={td}>{i.totalCredits}</td>
                    <td className={td}>{i.billedToName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-neutral-400">
        Also kept: {record.creditTransactions.length} credit ledger entries and {record.refundRequests.length}{" "}
        withdrawal requests (in the JSON download).
      </p>
    </div>
  );
}

type Tab = "consents" | "deletions";

const SOURCE_LABEL: Record<string, string> = {
  SIGNUP: "Sign-up form",
  LOGIN: "Login screen",
  PROMPT: "In-app consent screen",
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function AdminPrivacyPage() {
  const [tab, setTab] = useState<Tab>("consents");
  const [q, setQ] = useState("");
  const [consents, setConsents] = useState<ConsentRow[] | null>(null);
  const [deletions, setDeletions] = useState<DeletionRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async (which: Tab, query?: string) => {
    const url = new URL("/api/admin/privacy", window.location.origin);
    url.searchParams.set("type", which);
    if (query) url.searchParams.set("q", query);
    const res = await fetch(url.toString());
    const data = res.ok ? await res.json() : {};
    setTotal(data.total ?? 0);
    if (which === "consents") setConsents(data.consents ?? []);
    else setDeletions(data.deletions ?? []);
  }, []);

  useEffect(() => {
    load(tab);
  }, [tab, load]);

  const rows = tab === "consents" ? consents : deletions;

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold dark:text-neutral-100">Privacy logs</h1>
      <p className="mb-4 text-sm text-neutral-500">
        Every Terms + Privacy Policy acceptance, and every account a user deleted. Times are server time (IST).
      </p>

      <div className="mb-4 flex gap-2">
        {(["consents", "deletions"] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setExpanded(null);
            }}
            className={cn(
              "rounded-xl px-4 py-2 text-sm font-semibold",
              tab === t
                ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800",
            )}
          >
            {t === "consents" ? "Consent log" : "Deleted accounts"}
          </button>
        ))}
      </div>

      <div className="mb-4 flex gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load(tab, q)}
          placeholder={tab === "consents" ? "Search name, email or user id…" : "Search name, email, phone or user id…"}
        />
        <Button variant="outline" onClick={() => load(tab, q)}>
          <Search className="h-4 w-4" />
        </Button>
      </div>

      {rows === null ? (
        <div className="flex justify-center py-10 text-neutral-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <p className="card-shell p-6 text-center text-sm text-neutral-500">Nothing logged yet.</p>
      ) : (
        <>
          <p className="mb-2 text-xs text-neutral-400">
            Showing {rows.length} of {total}
          </p>
          <div className="card-shell overflow-x-auto">
            {tab === "consents" ? (
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="border-b border-neutral-100 text-xs text-neutral-400 dark:border-neutral-800">
                  <tr>
                    <th className="px-3 py-2">Accepted at</th>
                    <th className="px-3 py-2">User</th>
                    <th className="px-3 py-2">Where</th>
                    <th className="px-3 py-2">Policy version</th>
                    <th className="px-3 py-2">IP</th>
                    <th className="px-3 py-2">Checkbox clicks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {consents!.map((c) => (
                    <Fragment key={c.id}>
                      <tr>
                        <td className="whitespace-nowrap px-3 py-2 dark:text-neutral-300">{fmt(c.createdAt)}</td>
                        <td className="px-3 py-2">
                          {c.user ? (
                            <>
                              <p className="font-medium dark:text-neutral-100">{c.user.name}</p>
                              <p className="text-xs text-neutral-400">{c.user.email}</p>
                            </>
                          ) : (
                            <p className="text-xs text-neutral-400">
                              Deleted account
                              <br />
                              <span className="font-mono">{c.userId}</span>
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-2 dark:text-neutral-300">{SOURCE_LABEL[c.source] ?? c.source}</td>
                        <td className="px-3 py-2 font-mono text-xs dark:text-neutral-300">{c.policyVersion}</td>
                        <td className="px-3 py-2 font-mono text-xs dark:text-neutral-300">{c.ipAddress ?? "—"}</td>
                        <td className="px-3 py-2">
                          {c.checkboxEvents?.length ? (
                            <button
                              onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                              className="text-xs font-medium text-brand-600 hover:underline"
                            >
                              {c.checkboxEvents.length} click{c.checkboxEvents.length === 1 ? "" : "s"}{" "}
                              {expanded === c.id ? "▴" : "▾"}
                            </button>
                          ) : (
                            <span className="text-xs text-neutral-400">—</span>
                          )}
                        </td>
                      </tr>
                      {expanded === c.id && (
                        <tr className="bg-neutral-50 dark:bg-neutral-900">
                          <td colSpan={6} className="px-3 py-2 text-xs text-neutral-500">
                            <ol className="space-y-0.5">
                              {c.checkboxEvents!.map((e, i) => (
                                <li key={i}>
                                  <span className={e.action === "checked" ? "text-emerald-600" : "text-red-500"}>
                                    {e.action === "checked" ? "Ticked" : "Unticked"}
                                  </span>{" "}
                                  at {fmt(e.at)} <span className="text-neutral-400">(device time)</span>
                                </li>
                              ))}
                            </ol>
                            {c.userAgent && <p className="mt-2 break-all text-neutral-400">{c.userAgent}</p>}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="border-b border-neutral-100 text-xs text-neutral-400 dark:border-neutral-800">
                  <tr>
                    <th className="px-3 py-2">Deleted at</th>
                    <th className="px-3 py-2">Account</th>
                    <th className="px-3 py-2">Member since</th>
                    <th className="px-3 py-2">Removed</th>
                    <th className="px-3 py-2">Credits lost</th>
                    <th className="px-3 py-2">Reason</th>
                    <th className="px-3 py-2">Financial records</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {deletions!.map((d) => (
                    <Fragment key={d.id}>
                    <tr className="align-top">
                      <td className="whitespace-nowrap px-3 py-2 dark:text-neutral-300">
                        {fmt(d.deletedAt)}
                        <p className="text-xs text-neutral-400">by {d.deletedBy === "SELF" ? "the user" : d.deletedBy}</p>
                      </td>
                      <td className="px-3 py-2">
                        <p className="font-medium dark:text-neutral-100">{d.financialRecord?.name ?? d.maskedEmail ?? "—"}</p>
                        {d.financialRecord && <p className="text-xs text-neutral-500">{d.financialRecord.email}</p>}
                        <p className="text-xs text-neutral-400">
                          {d.maskedPhone ?? ""} {d.role}
                        </p>
                        <p className="font-mono text-[11px] text-neutral-400">{d.userId}</p>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 dark:text-neutral-300">
                        {new Date(d.accountCreatedAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-3 py-2 text-xs text-neutral-500">
                        {Object.entries(d.removedCounts)
                          .filter(([, n]) => n > 0)
                          .map(([k, n]) => `${n} ${k.replace(/([A-Z])/g, " $1").toLowerCase()}`)
                          .join(" · ") || "No content"}
                      </td>
                      <td className="px-3 py-2 dark:text-neutral-300">{d.creditsForfeited}</td>
                      <td className="max-w-[220px] px-3 py-2 text-xs text-neutral-500">{d.reason ?? "—"}</td>
                      <td className="px-3 py-2 text-xs">
                        {d.financialRecord ? (
                          <button
                            onClick={() => setExpanded(expanded === d.id ? null : d.id)}
                            className="text-left font-medium text-brand-600 hover:underline"
                          >
                            {d.financialRecord.totals.paymentCount} payments · {d.financialRecord.totals.invoiceCount}{" "}
                            invoices {expanded === d.id ? "▴" : "▾"}
                            <span className="block font-normal text-neutral-400">
                              {rupees(d.financialRecord.totals.capturedPaise)} paid
                            </span>
                          </button>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>
                    </tr>
                    {expanded === d.id && d.financialRecord && (
                      <tr className="bg-neutral-50 dark:bg-neutral-900">
                        <td colSpan={7} className="px-3 py-3">
                          <FinancialRecordPanel deletionId={d.id} />
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
