"use client";

import { useEffect, useState } from "react";
import { Zap } from "lucide-react";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { CreditPaymentDrawer, type PaymentInvoice } from "@/components/credit-payment-drawer";
import { BoostDaysPicker, useBoostSettings } from "@/components/boost/boost-days-picker";
import { boostLimits, boostModeFor, clampBoostDays, isBoostActive } from "@/lib/boost-shared";
import type { CreditAuth } from "@/lib/validation/tpin";

/**
 * Feature a post for N days, or extend one that was featured before (still
 * running or ended). Pick the days here, then pay in the T-PIN drawer.
 */
export function BoostDemandSheet({
  open,
  onClose,
  demandId,
  summary,
  isPriority,
  priorityExpiresAt,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  demandId: string;
  summary: string;
  isPriority: boolean;
  priorityExpiresAt: string | null;
  onDone: () => void;
}) {
  const { config } = useBoostSettings(open);
  const mode = boostModeFor(priorityExpiresAt);
  const running = isBoostActive(isPriority, priorityExpiresAt);
  const { pricePerDay, minDays } = boostLimits(config, mode);
  const [days, setDays] = useState(minDays);
  const [paying, setPaying] = useState(false);

  // Keep the pick inside the limits once the admin's values have loaded.
  useEffect(() => {
    setDays((d) => clampBoostDays(config, mode, d));
  }, [config, mode]);

  useEffect(() => {
    if (open) setDays(clampBoostDays(config, mode, minDays));
    else setPaying(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function request(auth: CreditAuth) {
    return fetch(`/api/demands/${demandId}/boost`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auth, days }),
    });
  }

  const title = mode === "extend" ? "Extend featured boost" : "Feature this post";
  const label = `${mode === "extend" ? "Featured extension" : "Featured boost"} · ${days} day${days === 1 ? "" : "s"} × ${pricePerDay}`;

  return (
    <>
      <Drawer open={open && !paying} onOpenChange={(next) => !next && onClose()}>
        <DrawerContent
          onClick={(e) => e.stopPropagation()}
          className="!z-[65] mx-auto max-w-md rounded-t-3xl border-neutral-800 bg-[#0a0a0a] text-white"
        >
          <DrawerHeader className="text-left">
            <DrawerTitle className="flex items-center gap-2 text-lg font-bold text-white">
              <Zap className="h-4 w-4 text-amber-400" /> {title}
            </DrawerTitle>
            <DrawerDescription className="text-neutral-400">
              {mode === "extend"
                ? running
                  ? `Featured until ${new Date(priorityExpiresAt!).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}. Extra days are added to the end.`
                  : "The featured boost on this post has ended. Extend it to put it back on top of the list."
                : "Your post is pinned on top of every list with a Featured badge."}
            </DrawerDescription>
          </DrawerHeader>

          <div className="space-y-3 px-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
            <p className="line-clamp-2 text-sm text-neutral-300">{summary}</p>
            <BoostDaysPicker
              config={config}
              mode={mode}
              days={days}
              onChange={setDays}
              currentEnd={running ? priorityExpiresAt : null}
            />
            <p className="text-[11px] leading-4 text-neutral-500">
              If your post would close before the boost ends, it stays open until the last featured day.
            </p>
            <button
              type="button"
              onClick={() => setPaying(true)}
              className="flex h-12 w-full items-center justify-center rounded-full bg-white text-sm font-bold text-black transition active:scale-[0.98]"
            >
              Pay {(pricePerDay * days).toLocaleString("en-IN")} credits
            </button>
          </div>
        </DrawerContent>
      </Drawer>

      <CreditPaymentDrawer<{ invoice: PaymentInvoice }>
        open={open && paying}
        onClose={() => setPaying(false)}
        title={summary}
        items={[{ label, credits: pricePerDay * days }]}
        request={request}
        onDone={() => {
          setPaying(false);
          onDone();
        }}
      />
    </>
  );
}
