"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Copy, Loader2 } from "lucide-react";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DEMAND_REPORT_REASONS, USER_REPORT_REASONS } from "@/lib/validation/report";

export type ReportTarget = "DEMAND" | "USER";

interface DemandReportDrawerProps {
  demandId: string;
  target: ReportTarget | null;
  signedIn: boolean;
  onClose: () => void;
}

export function DemandReportDrawer({ demandId, target, signedIn, onClose }: DemandReportDrawerProps) {
  const router = useRouter();
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reference, setReference] = useState<string | null>(null);

  const reasons = target === "USER" ? USER_REPORT_REASONS : DEMAND_REPORT_REASONS;
  const needsDetails = reason === "Something else";

  function reset() {
    setReason(null);
    setDetails("");
    setReference(null);
  }

  async function submit() {
    if (!target || !reason) return;
    if (!signedIn) {
      router.push(`/login?callbackUrl=${encodeURIComponent(`/demands/${demandId}`)}`);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/demands/${demandId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, reason, details: details.trim() || undefined }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error?.message ?? "Could not submit your report.");
        return;
      }
      setReference(data.reference);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer
      open={target !== null}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          reset();
        }
      }}
    >
      <DrawerContent className="mx-auto max-w-md rounded-t-3xl">
        {reference ? (
          <div className="flex flex-col items-center gap-3 px-5 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-4 text-center">
            <CheckCircle2 className="h-10 w-10 text-brand-500" />
            <DrawerTitle className="text-lg font-bold">Report submitted</DrawerTitle>
            <DrawerDescription>
              Our trust &amp; safety team will review it. Quote this reference if you contact support.
            </DrawerDescription>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(reference).then(() => toast.success("Reference copied"));
              }}
              className="flex items-center gap-2 rounded-xl bg-neutral-100 px-4 py-2.5 font-mono text-sm font-semibold dark:bg-neutral-800"
            >
              {reference} <Copy className="h-3.5 w-3.5 text-neutral-500" />
            </button>
            <Button
              className="mt-2 w-full"
              onClick={() => {
                onClose();
                reset();
              }}
            >
              Done
            </Button>
          </div>
        ) : (
          <div className="px-5 pb-[max(env(safe-area-inset-bottom),1.25rem)]">
            <DrawerHeader className="px-0 text-left">
              <DrawerTitle className="text-lg font-bold">
                {target === "USER" ? "Report this user" : "Report this post"}
              </DrawerTitle>
              <DrawerDescription>
                Your report is anonymous. The {target === "USER" ? "user" : "poster"} won&apos;t know who reported them.
              </DrawerDescription>
            </DrawerHeader>

            <div className="space-y-2" role="radiogroup" aria-label="Reason">
              {reasons.map((r) => (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={reason === r}
                  onClick={() => setReason(r)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl border px-3.5 py-3 text-left text-sm transition",
                    reason === r
                      ? "border-brand-500 bg-brand-500/5 font-semibold"
                      : "border-neutral-200 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900",
                  )}
                >
                  {r}
                  <span
                    className={cn(
                      "h-4 w-4 rounded-full border-2",
                      reason === r ? "border-brand-500 bg-brand-500 shadow-[inset_0_0_0_2px_white]" : "border-neutral-300",
                    )}
                  />
                </button>
              ))}
            </div>

            <label className="mt-4 block text-xs font-semibold text-neutral-500" htmlFor="report-details">
              Details {needsDetails ? "(required)" : "(optional)"}
            </label>
            <textarea
              id="report-details"
              value={details}
              onChange={(e) => setDetails(e.target.value.slice(0, 500))}
              rows={3}
              placeholder="What happened? Add anything that helps us review this."
              className="mt-1.5 w-full resize-none rounded-xl border border-neutral-200 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 dark:border-neutral-800"
            />
            <p className="mt-1 text-right text-[11px] text-neutral-400">{details.length}/500</p>

            <Button
              className="mt-2 w-full"
              variant="destructive"
              disabled={!reason || submitting || (needsDetails && details.trim().length < 5)}
              onClick={submit}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {signedIn ? "Submit report" : "Sign in to report"}
            </Button>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
