"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Coins, Users } from "lucide-react";
import { calculateSlotPrice } from "@/lib/slot-pricing";
import { CreditPaymentDrawer, type PaymentInvoice } from "@/components/credit-payment-drawer";
import { cn } from "@/lib/utils";
import type { CreditAuth } from "@/lib/validation/tpin";

interface SlotHolder {
  slot: number;
  bidder: { id: string; name: string; avatarUrl: string | null };
}

interface SlotStripProps {
  demandId: string;
  bids: SlotHolder[];
  maxSlots?: number;
  budgetMax?: number | null;
  budgetMin?: number | null;
  disabled?: boolean;
  /** True when the viewer is the demand's author (or admin) -- filled slots become clickable to open that bidder's chat. */
  isAuthorView?: boolean;
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function SlotStrip({
  demandId,
  bids: serverBids,
  maxSlots = 3,
  budgetMax,
  budgetMin,
  disabled,
  isAuthorView,
}: SlotStripProps) {
  const [openingChatFor, setOpeningChatFor] = useState<string | null>(null);
  const { data: session } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [purchasing, setPurchasing] = useState(false);
  // Shows the slot just bought straight away, until the refetched list includes it.
  const [boughtSlot, setBoughtSlot] = useState<number | null>(null);

  const me = session?.user;
  const bids: SlotHolder[] =
    boughtSlot !== null && me && !serverBids.some((b) => b.bidder.id === me.id)
      ? [...serverBids, { slot: boughtSlot, bidder: { id: me.id, name: me.name ?? "You", avatarUrl: me.image ?? null } }]
      : serverBids;
  const bySlot = new Map(bids.map((b) => [b.slot, b]));
  const slotPrice = calculateSlotPrice(budgetMax, budgetMin);
  const alreadyHolds = session?.user && bids.some((b) => b.bidder.id === session.user.id);
  const isFilled = bids.length >= maxSlots;

  function handleGrabSlot() {
    if (!session?.user) {
      toast.info("Log in to take a response spot.");
      router.push(`/login?callbackUrl=/demands/${demandId}`);
      return;
    }
    setPurchasing(true);
  }

  function requestSlot(auth: CreditAuth) {
    return fetch(`/api/demands/${demandId}/slots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auth }),
    });
  }

  // Refetching can unmount this strip, so it waits until the receipt is dismissed.
  function handleSlotPaid(data: { slot: number }) {
    setBoughtSlot(data.slot);
    setPurchasing(false);
    // Every list holding this demand refetches, now with the poster's identity.
    for (const key of ["demands-feed", "demands-deck", "niche-demands", "bookmarks"]) {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }
    router.refresh();
  }

  const paymentDrawer = (
    <CreditPaymentDrawer<{ invoice: PaymentInvoice; slot: number }>
      open={purchasing}
      onClose={() => setPurchasing(false)}
      title="Take a response spot on this request"
      items={[{ label: "1 response spot", credits: slotPrice.credits }]}
      request={requestSlot}
      onDone={handleSlotPaid}
    />
  );

  async function handleOpenBidderChat(bidderId: string) {
    if (openingChatFor) return;
    setOpeningChatFor(bidderId);
    try {
      const res = await fetch(`/api/demands/${demandId}/conversation?bidderId=${bidderId}`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error?.message ?? "Could not open this chat.");
        return;
      }
      router.push(`/chats/${data.conversation.id}`);
    } finally {
      setOpeningChatFor(null);
    }
  }

  // Render when maxSlots <= 5 (standard compact grid)
  if (maxSlots <= 5) {
    const slotNumbers = Array.from({ length: maxSlots }, (_, i) => i + 1);

    return (
      <>
        <div className="flex gap-2">
          {slotNumbers.map((slot) => {
            const holder = bySlot.get(slot);
            if (holder) {
              const content = (
                <>
                  {holder.bidder.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={holder.bidder.avatarUrl}
                      alt={holder.bidder.name}
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                      {initials(holder.bidder.name)}
                    </span>
                  )}
                  <span className="w-full truncate text-center text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
                    {openingChatFor === holder.bidder.id ? "..." : holder.bidder.name.split(" ")[0]}
                  </span>
                </>
              );

              if (isAuthorView) {
                return (
                  <button
                    key={slot}
                    type="button"
                    title={`Chat with ${holder.bidder.name}`}
                    onClick={() => handleOpenBidderChat(holder.bidder.id)}
                    disabled={Boolean(openingChatFor)}
                    className="flex flex-1 flex-col items-center gap-1 rounded-xl border border-neutral-200 bg-neutral-50 px-2 py-2 dark:border-neutral-800 dark:bg-neutral-900 disabled:opacity-60 hover:border-amber-400"
                  >
                    {content}
                  </button>
                );
              }

              return (
                <div
                  key={slot}
                  className="flex flex-1 flex-col items-center gap-1 rounded-xl border border-neutral-200 bg-neutral-50 px-2 py-2 dark:border-neutral-800 dark:bg-neutral-900"
                  title={holder.bidder.name}
                >
                  {content}
                </div>
              );
            }

            return (
              <button
                key={slot}
                type="button"
                disabled={disabled || purchasing || Boolean(alreadyHolds) || isAuthorView}
                onClick={handleGrabSlot}
                className="flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl border border-dashed border-amber-400/60 bg-amber-400/10 px-2 py-2 text-amber-500 hover:bg-amber-400/20 disabled:opacity-50 transition"
              >
                {purchasing ? (
                  <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
                ) : (
                  <>
                    <span className="text-[11px] font-semibold leading-tight">Open spot</span>
                    <span className="text-[11px] font-bold leading-tight">
                      {slotPrice.credits} credits
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </div>

        {paymentDrawer}
      </>
    );
  }

  // Render when maxSlots > 5 (expanded capacity banner + slot holders)
  return (
    <>
      <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-amber-400" />
            <span className="text-xs font-semibold text-white">
              {bids.length} / {maxSlots} Bidders Joined
            </span>
          </div>
          <span className="text-xs font-bold text-emerald-400">
            {slotPrice.credits} credits per response spot
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
          <div
            className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-300"
            style={{ width: `${Math.min(100, Math.round((bids.length / maxSlots) * 100))}%` }}
          />
        </div>

        {/* Bidders Avatars list */}
        {bids.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {bids.slice(0, 10).map((holder) => (
              <button
                key={holder.slot}
                type="button"
                title={`${holder.bidder.name} (Spot #${holder.slot})`}
                disabled={!isAuthorView || Boolean(openingChatFor)}
                onClick={() => isAuthorView && handleOpenBidderChat(holder.bidder.id)}
                className={cn(
                  "relative flex items-center justify-center rounded-full transition-transform active:scale-95",
                  isAuthorView && "hover:ring-2 hover:ring-amber-400 cursor-pointer"
                )}
              >
                {holder.bidder.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={holder.bidder.avatarUrl}
                    alt={holder.bidder.name}
                    className="h-7 w-7 rounded-full object-cover ring-1 ring-neutral-700"
                  />
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-400/20 text-[10px] font-bold text-amber-300 ring-1 ring-amber-400/30">
                    {initials(holder.bidder.name)}
                  </span>
                )}
              </button>
            ))}
            {bids.length > 10 && (
              <span className="text-[11px] font-medium text-neutral-400 pl-1">
                +{bids.length - 10} more
              </span>
            )}
          </div>
        )}

        {/* Action Button for non-authors */}
        {!isAuthorView && (
          <button
            type="button"
            disabled={disabled || purchasing || Boolean(alreadyHolds) || isFilled}
            onClick={handleGrabSlot}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 py-2.5 text-xs font-bold text-black shadow-md shadow-amber-400/10 transition hover:bg-amber-300 active:scale-95 disabled:opacity-50"
          >
            {purchasing ? (
              <Loader2 className="h-4 w-4 animate-spin text-black" />
            ) : alreadyHolds ? (
              <span>You already have a response spot on this request</span>
            ) : isFilled ? (
              <span>All {maxSlots} Slots Filled</span>
            ) : (
              <>
                <Coins className="h-3.5 w-3.5" />
                <span>Open spot · {slotPrice.credits} credits</span>
              </>
            )}
          </button>
        )}
      </div>

      {paymentDrawer}
    </>
  );
}
