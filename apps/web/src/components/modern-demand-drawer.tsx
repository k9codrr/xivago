"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import { animate, motion, useMotionValue } from "motion/react";
import {
  ChevronRight,
  Clock,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { DemandCardData } from "@/components/demand-card";
import { CountdownBadge } from "@/components/countdown-badge";
import { PriorityBadge } from "@/components/priority-badge";
import { SlotStrip } from "@/components/slot-strip";
import { TierMark } from "@/components/tier-mark";
import { TagChips } from "@/components/category-flow/chips";
import { DemandStatsPanel } from "@/components/demand-stats-panel";
import { ScreenshotGuard } from "@/components/screenshot-guard";
import { CreditPaymentDrawer, type PaymentInvoice } from "@/components/credit-payment-drawer";
import { MakeOfferDrawer } from "@/components/make-offer-drawer";
import { describeDemandCategory } from "@/lib/category-selection";
import { useOfferSlotsEnabled } from "@/lib/use-platform-settings";
import { demandTypeLabel } from "@/lib/demand-type";
import { formatBudgetRange } from "@/lib/money";
import { withPriceUnit } from "@/lib/price-units";
import { serviceAreaLabel } from "@/lib/service-area";
import { calculateSlotPrice } from "@/lib/slot-pricing";
import { cn } from "@/lib/utils";
import type { CreditAuth } from "@/lib/validation/tpin";

const isVideoUrl = (url: string) => /\.(mp4|webm|mov)(\?.*)?$/i.test(url);

const SPRING = { type: "spring", stiffness: 380, damping: 38, mass: 0.9 } as const;

type Snap = "half" | "full";

interface ModernDemandDrawerProps {
  demand: DemandCardData;
  open: boolean;
  onClose: () => void;
}

/**
 * Modern Pinterest-style demand drawer:
 * - Half-open: first image straddles the top edge of the drawer (~60-65% outside, ~35-40% inside)
 *   over a blurred liquid-glass backdrop, with top-left X and top-right ... buttons.
 * - Full-open (swipe up): expands to full width and ~94% height, and the first image
 *   moves inside the drawer alongside the other media attachments.
 * - Uses genuine translucent liquid glass CSS (-webkit-backdrop-filter + backdrop-filter)
 *   so it renders properly on both laptop Chromium and iPhone PWA.
 * - Fixed bottom bar with Grab Spot / Chat + Make Offer buttons.
 */
export function ModernDemandDrawer({ demand, open, onClose }: ModernDemandDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(open);
  const [snap, setSnap] = useState<Snap>("half");
  const [purchasing, setPurchasing] = useState(false);
  const [boughtSlot, setBoughtSlot] = useState<number | null>(null);
  const [openingChat, setOpeningChat] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);

  const router = useRouter();
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const sheetRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const y = useMotionValue(0);
  const dragStart = useRef<{ y: number; startSnap: Snap; scrollTop: number } | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (open) {
      setVisible(true);
      setSnap("half");
      y.set(typeof window !== "undefined" ? window.innerHeight : 800);
      animate(y, 0, SPRING);
      return;
    }
    if (!visible) return;
    const ctrl = animate(y, typeof window !== "undefined" ? window.innerHeight : 800, {
      duration: 0.25,
      ease: [0.32, 0.72, 0, 1],
    });
    ctrl.then(() => setVisible(false));
    return () => ctrl.stop();
  }, [open, visible, y]);

  useEffect(() => {
    if (!visible || !open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [visible, open, onClose]);

  const me = session?.user;
  const bids =
    boughtSlot !== null && me && !demand.bids.some((b) => b.bidder.id === me.id)
      ? [...demand.bids, { slot: boughtSlot, bidder: { id: me.id, name: me.name ?? "You", avatarUrl: me.image ?? null } }]
      : demand.bids;

  const alreadyHolds = Boolean(me && bids.some((b) => b.bidder.id === me.id));
  const offerSlotsEnabled = useOfferSlotsEnabled();
  const slotsEnabled = demand.postType !== "PROMOTE" || offerSlotsEnabled;
  const maxSlots = demand.maxSlots ?? 3;
  const isFilled = bids.length >= maxSlots;
  const isOpen = demand.status === "OPEN";
  const slotPrice = calculateSlotPrice(demand.budgetMax, demand.budgetMin);

  const budgetLabel = withPriceUnit(formatBudgetRange(demand.budgetMin, demand.budgetMax), demand.priceUnit);
  const displayName = demand.author.companyName ?? demand.author.name;
  const { provider, problems } = describeDemandCategory(demand.categoryProviderId, demand.categoryProblemIds);
  const providerName = provider?.name ?? demand.customProviderName ?? undefined;
  const typeLabel = demandTypeLabel(demand);

  const coverUrl = demand.mediaUrls?.[0];
  const hasMedia = Boolean(demand.mediaUrls && demand.mediaUrls.length > 0);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length !== 1) return;
      dragStart.current = {
        y: e.touches[0]!.clientY,
        startSnap: snap,
        scrollTop: scrollRef.current?.scrollTop ?? 0,
      };
    },
    [snap],
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const start = dragStart.current;
      dragStart.current = null;
      if (!start) return;
      const endY = e.changedTouches[0]?.clientY ?? start.y;
      const dy = endY - start.y;

      if (start.startSnap === "half") {
        if (dy < -40) {
          setSnap("full");
        } else if (dy > 60) {
          onClose();
        }
      } else {
        if (dy > 60 && start.scrollTop <= 2) {
          setSnap("half");
        }
      }
    },
    [onClose],
  );

  function handleGrabSpot() {
    if (!me) {
      toast.info("Log in to take a response spot.");
      router.push(`/login?callbackUrl=/demands/${demand.id}`);
      return;
    }
    setPurchasing(true);
  }

  function requestSlot(auth: CreditAuth) {
    return fetch(`/api/demands/${demand.id}/slots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auth }),
    });
  }

  function handleSlotPaid(data: { slot: number }) {
    setBoughtSlot(data.slot);
    setPurchasing(false);
    for (const key of ["demands-feed", "demands-deck", "niche-demands", "bookmarks"]) {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }
    router.refresh();
  }

  async function handleChat() {
    if (openingChat) return;
    setOpeningChat(true);
    try {
      const res = await fetch(`/api/demands/${demand.id}/conversation`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error?.message ?? "Could not open this chat.");
        return;
      }
      onClose();
      router.push(`/chats/${data.conversation.id}`);
    } catch {
      toast.error("Could not open chat.");
    } finally {
      setOpeningChat(false);
    }
  }

  function handleMakeOffer() {
    if (!me) {
      toast.info("Log in and take a spot first to make an offer.");
      router.push(`/login?callbackUrl=/demands/${demand.id}`);
      return;
    }
    if (!alreadyHolds) {
      toast.info("Grab a spot first to send an offer.");
      setPurchasing(true);
      return;
    }
    setOfferOpen(true);
  }

  if (!mounted || !visible) return null;

  const isFull = snap === "full";

  return <>{createPortal(
    <>
      {/* Backdrop with blurred cover image behind */}
      <motion.div
        aria-hidden
        className="fixed inset-0 z-[55] overflow-hidden bg-black/70"
        initial={{ opacity: 0 }}
        animate={{ opacity: open ? 1 : 0 }}
        transition={{ duration: 0.25 }}
        onClick={onClose}
      >
        {coverUrl && !isVideoUrl(coverUrl) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt=""
            className="h-full w-full scale-110 object-cover opacity-45 blur-2xl"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/75" />
      </motion.div>

      {/* Top corner liquid-glass action buttons (matching Pinterest reference) */}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-[58] mx-auto flex max-w-md items-center justify-between px-4"
        style={{ paddingTop: "max(env(safe-area-inset-top), 1rem)" }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full text-white transition active:scale-90"
          style={{
            background: "linear-gradient(180deg, rgb(255 255 255 / 0.18), rgb(255 255 255 / 0.06))",
            backdropFilter: "blur(24px) saturate(180%)",
            WebkitBackdropFilter: "blur(24px) saturate(180%)",
            boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.4), 0 8px 24px rgb(0 0 0 / 0.35)",
          }}
        >
          <X className="h-5 w-5" />
        </button>

        <Link
          href={`/demands/${demand.id}`}
          onClick={onClose}
          aria-label="Full demand page"
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full text-white transition active:scale-90"
          style={{
            background: "linear-gradient(180deg, rgb(255 255 255 / 0.18), rgb(255 255 255 / 0.06))",
            backdropFilter: "blur(24px) saturate(180%)",
            WebkitBackdropFilter: "blur(24px) saturate(180%)",
            boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.4), 0 8px 24px rgb(0 0 0 / 0.35)",
          }}
        >
          <MoreHorizontal className="h-5 w-5" />
        </Link>
      </div>

      {/* Main Drawer Container */}
      <motion.div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={demand.summary}
        data-app-sheet=""
        data-snap={snap}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{
          y,
          height: isFull ? "94dvh" : "52dvh",
          transition: "height 0.38s cubic-bezier(0.32, 0.72, 0, 1), left 0.35s, right 0.35s, border-radius 0.35s",
          background:
            "linear-gradient(180deg, rgb(255 255 255 / 0.14) 0%, rgb(255 255 255 / 0.06) 40%, rgb(255 255 255 / 0.03) 100%), rgb(22 22 26 / 0.48)",
          backdropFilter: "blur(42px) saturate(195%) brightness(1.06)",
          WebkitBackdropFilter: "blur(42px) saturate(195%) brightness(1.06)",
          boxShadow:
            "inset 0 1px 0.5px rgb(255 255 255 / 0.48), inset 0 -1px 0.5px rgb(255 255 255 / 0.1), 0 -20px 60px rgb(0 0 0 / 0.55), 0 0 0 0.5px rgb(255 255 255 / 0.2)",
        }}
        className={cn(
          "fixed bottom-0 z-[60] mx-auto flex flex-col text-white outline-none",
          isFull ? "inset-x-0 max-w-md rounded-t-[28px]" : "inset-x-2 max-w-md rounded-t-[32px]",
        )}
      >
        {/* Peeking First Image (half mode only: ~60-65% outside above drawer, ~35-40% inside drawer) */}
        {!isFull && coverUrl && (
          <div
            onClick={() => setSnap("full")}
            className="pointer-events-auto absolute left-1/2 z-20 -translate-x-1/2 cursor-pointer overflow-hidden rounded-[18px] shadow-[0_18px_45px_rgba(0,0,0,0.65)] ring-1 ring-white/25 transition-all duration-300"
            style={{
              width: "136px",
              height: "200px",
              top: "-126px", // 126/200 = 63% outside, 74/200 = 37% inside!
            }}
          >
            {isVideoUrl(coverUrl) ? (
              <video src={coverUrl} className="h-full w-full object-cover" muted playsInline />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverUrl} alt="" className="h-full w-full object-cover" />
            )}
          </div>
        )}

        {/* Drag handle & expand toggle */}
        <button
          type="button"
          onClick={() => setSnap(isFull ? "half" : "full")}
          aria-label={isFull ? "Collapse drawer" : "Expand drawer"}
          className="relative z-10 mx-auto flex h-7 w-20 shrink-0 items-center justify-center pt-1"
        >
          <span className="block h-1.5 w-11 rounded-full bg-white/40" />
        </button>

        <ScreenshotGuard className="flex min-h-0 flex-1 flex-col">
          <div
            ref={scrollRef}
            className={cn(
              "min-h-0 flex-1 space-y-5 px-4 pb-6 overscroll-contain",
              !isFull && coverUrl ? "pt-[76px]" : "pt-2",
              isFull ? "overflow-y-auto" : "overflow-hidden",
            )}
          >
            {/* ── Author block ── */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                {demand.author.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={demand.author.avatarUrl}
                    alt={displayName}
                    className="h-11 w-11 shrink-0 rounded-full bg-white/[0.08] object-cover"
                  />
                ) : (
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#0A84FF]/20 text-sm font-semibold text-[#0A84FF]">
                    {displayName.slice(0, 2).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 leading-tight">
                  <p className="truncate text-[17px] font-semibold tracking-[-0.01em] text-white">
                    {displayName}
                    <TierMark tier={demand.author.trust?.[0]?.tier} className="ml-1.5 align-middle" />
                  </p>
                  <p className="truncate text-[13px] text-[#EBEBF5]/65">
                    {demand.authorHidden ? "Take a response spot to see who posted" : demand.author.name}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5 [&>span]:bg-white/15 [&>span]:text-white/90">
                {demand.isPriority && <PriorityBadge />}
                <CountdownBadge timelineEnd={demand.timelineEnd} />
              </div>
            </div>

            {/* ── Category + summary ── */}
            <div>
              {typeLabel && <p className="mb-1 text-[13px] font-semibold text-white/85">{typeLabel}</p>}
              {demand.subCategoryName && (
                <p className="mb-1.5 text-[13px] font-semibold uppercase tracking-[0.04em] text-[#0A84FF]">
                  {demand.categoryName ? `${demand.categoryName} › ${demand.subCategoryName}` : demand.subCategoryName}
                  {providerName && ` › ${providerName}`}
                </p>
              )}
              <p className="text-[20px] font-semibold leading-[1.3] tracking-[-0.015em] text-white">
                {demand.summary}
              </p>
              {problems.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {problems.map((problem) => (
                    <li key={problem.id} className="text-[14px] text-white/80">
                      {problem.title}
                      <TagChips tags={problem.tags} tone="dark" className="mt-1" />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {demand.tags && demand.tags.length > 0 && <TagChips tags={demand.tags} tone="dark" />}

            {/* ── All media inside drawer when expanded (full mode), or remaining media in half mode ── */}
            {isFull && hasMedia && (
              <div className="grid grid-cols-3 gap-1.5 overflow-hidden rounded-[16px]">
                {demand.mediaUrls!.map((url, i) => (
                  <div key={url} className="aspect-square overflow-hidden rounded-[10px] bg-white/[0.08]">
                    {isVideoUrl(url) ? (
                      <video src={url} controls muted className="h-full w-full object-cover" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt={`Attachment ${i + 1}`} className="h-full w-full object-cover" />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* ── Details: inset grouped list ── */}
            <div>
              <p className="mb-1.5 px-4 text-[13px] uppercase tracking-[0.02em] text-[#EBEBF5]/60">Details</p>
              <div className="divide-y divide-white/10 overflow-hidden rounded-[14px] bg-white/[0.08]">
                {budgetLabel && (
                  <div className="flex items-center justify-between px-4 py-3 text-[15px]">
                    <span className="flex items-center gap-2.5 text-white">
                      <Wallet className="h-4 w-4 text-[#30D158]" /> Budget
                    </span>
                    <span className="text-[#EBEBF5]/70">{budgetLabel}</span>
                  </div>
                )}
                {(serviceAreaLabel(demand) || demand.locationName || demand.author.location) && (
                  <div className="flex items-center justify-between gap-4 px-4 py-3 text-[15px]">
                    <span className="flex shrink-0 items-center gap-2.5 text-white">
                      <MapPin className="h-4 w-4 text-[#0A84FF]" /> {serviceAreaLabel(demand) ? "Serves" : "Location"}
                    </span>
                    <span className="truncate text-[#EBEBF5]/70">
                      {serviceAreaLabel(demand, 3) ?? demand.locationName ?? demand.author.location}
                    </span>
                  </div>
                )}
                {demand.createdAt && (
                  <div className="flex items-center justify-between px-4 py-3 text-[15px]">
                    <span className="flex items-center gap-2.5 text-white">
                      <Clock className="h-4 w-4 text-[#FF9F0A]" /> Posted
                    </span>
                    <span className="text-[#EBEBF5]/70">{new Date(demand.createdAt).toLocaleDateString()}</span>
                  </div>
                )}
                {!isOpen && (
                  <div className="flex items-center justify-between px-4 py-3 text-[15px]">
                    <span className="flex items-center gap-2.5 text-white">
                      <Clock className="h-4 w-4 text-[#EBEBF5]/60" /> Status
                    </span>
                    <span className="text-[#EBEBF5]/60">Closed</span>
                  </div>
                )}
              </div>
            </div>

            {/* ── Tech inputs ── */}
            {demand.selectedTechInputs && Object.keys(demand.selectedTechInputs).length > 0 && (
              <div>
                <p className="mb-1.5 px-4 text-[13px] uppercase tracking-[0.02em] text-[#EBEBF5]/60">Specifications</p>
                <dl className="divide-y divide-white/10 overflow-hidden rounded-[14px] bg-white/[0.08]">
                  {Object.entries(demand.selectedTechInputs).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4 px-4 py-3 text-[15px]">
                      <dt className="text-white">{k}</dt>
                      <dd className="text-right text-[#EBEBF5]/70">{String(v)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {/* ── Bids & slot strip ── */}
            {slotsEnabled && (
              <div>
                <div className="mb-1.5 flex items-center justify-between px-4">
                  <p className="text-[13px] uppercase tracking-[0.02em] text-[#EBEBF5]/60">
                    Bids · {bids.length} of {maxSlots}
                  </p>
                  <span className="text-[13px] font-semibold text-[#FF9F0A]">
                    ₹{slotPrice.rupees} / slot
                  </span>
                </div>
                <div className="rounded-[14px] bg-white/[0.08] p-3">
                  <SlotStrip
                    demandId={demand.id}
                    bids={bids}
                    maxSlots={maxSlots}
                    budgetMax={demand.budgetMax}
                    budgetMin={demand.budgetMin}
                    disabled={!isOpen}
                  />
                </div>
              </div>
            )}

            {/* ── View Full Demand link ── */}
            <Link
              href={`/demands/${demand.id}`}
              onClick={onClose}
              className={cn(
                "flex h-[48px] w-full items-center justify-center gap-1 rounded-[14px] bg-white/[0.1] text-[15px] font-semibold text-white transition active:opacity-70",
                !isOpen && "pointer-events-none opacity-40",
              )}
            >
              View Full Demand <ChevronRight className="h-4 w-4" />
            </Link>

            <DemandStatsPanel demandId={demand.id} openedFromCard tone="glass" />
          </div>

          {/* ── Fixed bottom buttons: Grab Spot / Chat + Make Offer ── */}
          {isOpen && (slotsEnabled || alreadyHolds) && (
            <div className="shrink-0 border-t border-white/15 px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3">
              <div className="flex items-center gap-2.5">
                {alreadyHolds ? (
                  <button
                    type="button"
                    onClick={handleChat}
                    disabled={openingChat}
                    className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-[14px] bg-[#30D158] text-[16px] font-semibold text-white transition active:scale-[0.98]"
                  >
                    <MessageCircle className="h-4 w-4" />
                    {openingChat ? "Opening…" : "Chat"}
                  </button>
                ) : slotsEnabled ? (
                  <button
                    type="button"
                    onClick={handleGrabSpot}
                    disabled={isFilled}
                    className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-[14px] bg-[#30D158] text-[16px] font-semibold text-white transition active:scale-[0.98] disabled:bg-white/15 disabled:text-white/40"
                  >
                    {isFilled ? "Spots Filled" : `Grab Spot · ₹${slotPrice.rupees}`}
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={handleMakeOffer}
                  className={cn(
                    "flex h-[50px] flex-1 items-center justify-center gap-2 rounded-[14px] text-[16px] font-semibold transition active:scale-[0.98]",
                    alreadyHolds
                      ? "bg-[#0A84FF] text-white"
                      : "border border-white/20 bg-white/[0.08] text-white/80",
                  )}
                >
                  <Sparkles className="h-4 w-4" />
                  Make Offer
                </button>
              </div>
            </div>
          )}
        </ScreenshotGuard>
      </motion.div>

      <CreditPaymentDrawer<{ invoice: PaymentInvoice; slot: number }>
        open={purchasing}
        onClose={() => setPurchasing(false)}
        title="Take a response spot on this request"
        items={[{ label: "1 response spot", credits: slotPrice.credits }]}
        request={requestSlot}
        onDone={handleSlotPaid}
      />

      <MakeOfferDrawer
        open={offerOpen}
        onClose={() => setOfferOpen(false)}
        demandId={demand.id}
        recipientName={displayName}
      />
    </>,
    document.body,
  )}</>;
}
