"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Receipt } from "lucide-react";
import { formatPaise } from "@/lib/money";

interface MySlot {
  id: string;
  slot: number;
  createdAt: string;
  demand: {
    id: string;
    summary: string;
    status: string;
    timelineEnd: string;
    author: { id: string; name: string; companyName: string | null; avatarUrl: string | null };
  };
  payment: { id: string; amountPaise: number; currency: string; razorpayPaymentId: string | null; createdAt: string } | null;
}

export default function MySlotsPage() {
  const [slots, setSlots] = useState<MySlot[] | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/my/slots");
      setSlots(res.ok ? (await res.json()).slots : []);
    })();
  }, []);

  return (
    <main className="px-4 pt-[max(env(safe-area-inset-top),1.5rem)]">
      <h1 className="mb-4 text-xl font-bold">My responses</h1>

      {slots === null && (
        <div className="flex justify-center py-10 text-neutral-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      {slots !== null && slots.length === 0 && (
        <p className="card-shell p-6 text-center text-sm text-neutral-500">
          You haven&apos;t responded to any requests yet. Browse the feed to find one.
        </p>
      )}

      <div className="space-y-3">
        {slots?.map((s) => (
          <Link key={s.id} href={`/demands/${s.demand.id}`} className="card-shell block p-4">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
                Spot {s.slot}
              </span>
              <span className="text-xs text-neutral-400">
                {new Date(s.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              </span>
            </div>
            <p className="mb-2 line-clamp-2 text-sm font-medium text-neutral-900">{s.demand.summary}</p>
            <div className="flex items-center justify-between text-xs text-neutral-500">
              <span>by {s.demand.author.companyName ?? s.demand.author.name}</span>
              {s.payment && (
                <span className="flex items-center gap-1 font-semibold text-neutral-700">
                  <Receipt className="h-3.5 w-3.5" /> {formatPaise(s.payment.amountPaise)}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
