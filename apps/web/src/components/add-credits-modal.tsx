"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Coins, Loader2, Sparkles, X, Plus } from "lucide-react";
import { openRazorpayCheckout } from "@/lib/razorpay-checkout";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { celebrate } from "@/components/celebration";

interface AddCreditsModalProps {
  open: boolean;
  onClose: () => void;
  requiredCredits?: number;
  currentBalance?: number | null;
  onSuccess?: (newBalance: number) => void;
}

const PRESET_PACKS = [
  { credits: 50, price: 50, label: "50 Credits", popular: false },
  { credits: 100, price: 100, label: "100 Credits", popular: true },
  { credits: 250, price: 250, label: "250 Credits", popular: false },
  { credits: 500, price: 500, label: "500 Credits", popular: false },
];

export function AddCreditsModal({
  open,
  onClose,
  requiredCredits,
  currentBalance = 0,
  onSuccess,
}: AddCreditsModalProps) {
  const { data: session } = useSession();

  const defaultSelected = requiredCredits
    ? Math.max(10, requiredCredits - (currentBalance ?? 0))
    : 100;

  const [selectedCredits, setSelectedCredits] = useState<number>(defaultSelected);
  const [customInput, setCustomInput] = useState<string>("");
  const [isCustom, setIsCustom] = useState<boolean>(false);
  const [processing, setProcessing] = useState<boolean>(false);

  const activeCredits = isCustom ? (parseInt(customInput, 10) || 0) : selectedCredits;
  const isAffordable = activeCredits >= 10;

  async function handleBuyCredits() {
    if (!session?.user) {
      toast.error("Please sign in to add credits.");
      return;
    }
    if (activeCredits < 10) {
      toast.error("Minimum 10 credits required.");
      return;
    }
    if (processing) return;

    setProcessing(true);
    try {
      const orderRes = await fetch("/api/payments/credits-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credits: activeCredits }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) {
        toast.error(orderData?.error?.message ?? "Could not initiate payment.");
        return;
      }

      let checkoutResult;
      try {
        checkoutResult = await openRazorpayCheckout({
          key: orderData.keyId,
          amount: orderData.amountPaise,
          currency: orderData.currency,
          order_id: orderData.razorpayOrderId,
          name: "xivago credits",
          description: `Add ${activeCredits} credits to your account`,
          prefill: {
            name: session.user.name ?? undefined,
            email: session.user.email ?? undefined,
          },
          theme: { color: "#eab308" },
        });
      } catch (err) {
        if (err instanceof Error && err.message === "CHECKOUT_DISMISSED") {
          toast.info("Payment cancelled.");
        } else {
          toast.error("Could not open Razorpay checkout.");
        }
        return;
      }

      const verifyRes = await fetch("/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(checkoutResult),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        toast.error(verifyData?.error?.message ?? "Payment verification failed.");
        return;
      }

      if (onSuccess) {
        onSuccess(verifyData.balance);
      }
      onClose();
      // Coins drop, amount counts up, chime -- then back to whatever they were doing.
      void celebrate({
        kind: "credits",
        amount: verifyData.creditsAdded ?? activeCredits,
        amountPrefix: "+",
        title: "Credits added",
        subtitle: typeof verifyData.balance === "number" ? `New balance: ${verifyData.balance.toLocaleString("en-IN")} credits` : undefined,
        duration: 2800,
      });
    } catch (err) {
      console.error("Buy credits error", err);
      toast.error("Something went wrong while purchasing credits.");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      {/* Opens on top of the post-demand drawer (z-[60]). */}
      <DrawerContent className="!z-[70] border-neutral-800 bg-[#0a0a0a] text-white max-w-md mx-auto rounded-t-3xl p-5">
        <DrawerHeader className="px-0 pt-0 text-left">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/10 text-amber-400 border border-amber-400/20">
                <Coins className="h-5 w-5" />
              </span>
              <div>
                <DrawerTitle className="text-lg font-bold text-white">Wallet · Top up</DrawerTitle>
                <DrawerDescription className="text-xs text-neutral-400">
                  1 Credit = ₹1 · Used for posting demands & grabbing slots
                </DrawerDescription>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {currentBalance != null && (
            <div className="mt-2.5 rounded-xl border border-neutral-800 bg-neutral-900/60 p-2.5 flex items-center justify-between">
              <span className="text-xs text-neutral-400">Current Balance:</span>
              <span className="text-sm font-bold text-amber-400 flex items-center gap-1">
                <Coins className="h-4 w-4" /> {currentBalance} Credits
              </span>
            </div>
          )}
        </DrawerHeader>

        <div className="space-y-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Select Credit Pack
          </p>

          <div className="grid grid-cols-2 gap-2.5">
            {PRESET_PACKS.map((pack) => {
              const isSelected = !isCustom && selectedCredits === pack.credits;
              return (
                <button
                  key={pack.credits}
                  type="button"
                  onClick={() => {
                    setIsCustom(false);
                    setSelectedCredits(pack.credits);
                  }}
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-1 rounded-2xl border p-3.5 transition-all text-center",
                    isSelected
                      ? "border-amber-400 bg-neutral-800 ring-2 ring-amber-400/40 shadow-lg shadow-amber-400/10"
                      : "border-neutral-800 bg-neutral-900/70 hover:border-neutral-700"
                  )}
                >
                  {pack.popular && (
                    <span className="absolute -top-2 right-2 rounded-full bg-amber-400 px-2 py-0.5 text-[9px] font-black uppercase text-black">
                      Popular
                    </span>
                  )}
                  <span className="text-base font-bold text-white">{pack.label}</span>
                  <span className="text-xs font-medium text-amber-400">₹{pack.price}</span>
                </button>
              );
            })}
          </div>

          {/* Custom amount */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setIsCustom(true)}
              className={cn(
                "w-full flex items-center justify-between rounded-xl border p-3 text-left transition-all",
                isCustom
                  ? "border-amber-400 bg-neutral-800 ring-2 ring-amber-400/40"
                  : "border-neutral-800 bg-neutral-900/50 hover:border-neutral-700"
              )}
            >
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-neutral-400" />
                <span className="text-xs font-medium text-neutral-300">Custom credits</span>
              </div>
              {isCustom ? (
                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="number"
                    min={10}
                    max={100000}
                    placeholder="Min 10"
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    autoFocus
                    className="w-24 rounded-lg bg-black px-2 py-1 text-right text-xs font-bold text-amber-400 outline-none ring-1 ring-amber-400/50"
                  />
                  <span className="text-xs text-neutral-400">credits</span>
                </div>
              ) : (
                <span className="text-xs text-neutral-500">Enter amount</span>
              )}
            </button>
          </div>
        </div>

        <DrawerFooter className="px-0 pb-2 pt-3">
          <button
            type="button"
            disabled={!isAffordable || processing}
            onClick={handleBuyCredits}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 py-3.5 text-sm font-bold text-black shadow-lg shadow-amber-400/20 transition hover:bg-amber-300 active:scale-95 disabled:opacity-50"
          >
            {processing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>
                  Pay ₹{activeCredits} via Razorpay (+{activeCredits} Credits)
                </span>
              </>
            )}
          </button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
