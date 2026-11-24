import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Receipt } from "lucide-react";
import { prisma } from "@/lib/db";
import { getOptionalUser } from "@/lib/guards";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Invoices" };

export default async function InvoicesPage() {
  const user = await getOptionalUser();
  if (!user) redirect("/login?callbackUrl=/invoices");

  const invoices = await prisma.invoice.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, number: true, title: true, totalCredits: true, createdAt: true },
  });

  return (
    <main className="min-h-dvh px-4 pb-10">
      <PageHeader title="Invoices" className="mb-4" />

      {invoices.length === 0 ? (
        <p className="card-shell p-6 text-center text-sm text-neutral-500">
          Your invoices will appear here after you pay with credits.
        </p>
      ) : (
        <ul className="space-y-3">
          {invoices.map((invoice) => (
            <li key={invoice.id}>
              <Link href={`/invoices/${invoice.id}`} className="card-shell flex items-center gap-3 p-4">
                <Receipt className="h-5 w-5 shrink-0 text-neutral-400" />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-1 text-sm font-medium">{invoice.title}</span>
                  <span className="mt-0.5 block text-xs text-neutral-500">
                    {invoice.number} ·{" "}
                    {invoice.createdAt.toLocaleDateString("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" })}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold">{invoice.totalCredits.toLocaleString("en-IN")} cr</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-neutral-500" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
