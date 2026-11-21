"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Play } from "lucide-react";

export function RunTrustJobButton() {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function run() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/trust/run", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error?.message ?? "The trust job failed.");
        return;
      }
      toast.success(`Trust job ran: ${data.upgraded} up, ${data.warned} warned, ${data.downgraded} down`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      className="flex items-center gap-1 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
      disabled={busy}
      onClick={run}
    >
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />} Run trust job now
    </button>
  );
}
