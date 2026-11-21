import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2, ChevronLeft } from "lucide-react";
import { prisma, type InvoiceKind } from "@/lib/db";
import { getOptionalUser } from "@/lib/guards";
import type { InvoiceItem } from "@/lib/credit-payment";

export const metadata = { title: "Invoice" };

const KIND_LABEL: Record<InvoiceKind, string> = {
  SLOT_PURCHASE: "Response spot",
  PRIORITY_BOOST: "Featured boost",
  DEMAND_POST: "Posting fee",
  FEATURED_BID: "Featured listing",
};

function credits(n: number) {
  return `${n.toLocaleString("en-IN")} credits`;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <dt className="shrink-0 text-neutral-500">{label}</dt>
      <dd className="min-w-0 break-words text-right font-medium">{children}</dd>
    </div>
  );
}

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getOptionalUser();
  if (!user) redirect(`/login?callbackUrl=/invoices/${id}`);

  // Scoped to the owner, so someone else's invoice id is just a 404.
  const invoice = await prisma.invoice.findFirst({ where: { id, userId: user.id } });
  if (!invoice) notFound();

  const items = invoice.items as unknown as InvoiceItem[];

  return (
    <main className="px-4 pb-28 pt-[max(env(safe-area-inset-top),1.5rem)]">
      <Link href="/invoices" className="mb-4 flex items-center gap-1 text-sm text-neutral-400">
        <ChevronLeft className="h-4 w-4" /> Invoices
      </Link>

      <article className="card-shell space-y-5 p-5">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-bold">Invoice</h1>
            <p className="break-all font-mono text-xs text-neutral-500">{invoice.number}</p>
          </div>
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" /> Paid
          </span>
        </header>

        <dl className="space-y-2">
          <Row label="Date">
            {invoice.createdAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}
          </Row>
          <Row label="Billed to">{invoice.billedToName}</Row>
          <Row label="Type">{KIND_LABEL[invoice.kind]}</Row>
          <Row label="For">
            {invoice.demandId ? (
              <Link href={`/demands/${invoice.demandId}`} className="underline underline-offset-2">
                {invoice.title}
              </Link>
            ) : (
              invoice.title
            )}
          </Row>
        </dl>

        <section className="border-t border-dashed border-neutral-700 pt-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Items</h2>
          <dl className="space-y-2">
            {items.map((item) => (
              <Row key={item.label} label={item.label}>
                {credits(item.credits)}
              </Row>
            ))}
          </dl>
          <div className="mt-3 flex items-baseline justify-between border-t border-neutral-800 pt-3">
            <span className="text-sm font-semibold">Total</span>
            <span className="text-right">
              <span className="block text-lg font-bold">{credits(invoice.totalCredits)}</span>
              <span className="text-xs text-neutral-500">₹{invoice.totalCredits.toLocaleString("en-IN")} at 1 credit = ₹1</span>
            </span>
          </div>
        </section>

        <dl className="space-y-2 border-t border-dashed border-neutral-700 pt-4">
          <Row label="Paid with">xivago wallet, confirmed by T-PIN</Row>
          <Row label="Balance before">{credits(invoice.balanceAfter + invoice.totalCredits)}</Row>
          <Row label="Balance after">{credits(invoice.balanceAfter)}</Row>
        </dl>

        {/* Quote these to support for refunds or disputes — admins can look them up directly. */}
        <section className="border-t border-dashed border-neutral-700 pt-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Reference</h2>
          <dl className="space-y-2">
            <Row label="Invoice ID">
              <span className="select-all break-all font-mono text-xs">{invoice.id}</span>
            </Row>
            <Row label="Customer ID">
              <span className="select-all break-all font-mono text-xs">{invoice.userId}</span>
            </Row>
            {invoice.demandId && (
              <Row label="Post ID">
                <span className="select-all break-all font-mono text-xs">{invoice.demandId}</span>
              </Row>
            )}
          </dl>
          <p className="mt-3 text-xs text-neutral-500">Share these IDs with support for withdrawals or payment queries.</p>
        </section>
      </article>
    </main>
  );
}
