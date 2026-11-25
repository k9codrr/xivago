"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { IndianRupee, Loader2, Send, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface MakeOfferDrawerProps {
  open: boolean;
  onClose: () => void;
  demandId: string;
  recipientName?: string;
}

export function MakeOfferDrawer({ open, onClose, demandId, recipientName }: MakeOfferDrawerProps) {
  const [price, setPrice] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSubmit() {
    const amount = parseFloat(price);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Enter a valid price");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`/api/demands/${demandId}/offer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposedPrice: amount, message: message.trim() || undefined }),
      });
      if (res.ok) {
        toast.success("Offer sent!");
        onClose();
        setPrice("");
        setMessage("");
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.error?.message ?? "Could not send offer");
      }
    } catch {
      toast.error("Network error. Try again.");
    } finally {
      setSending(false);
    }
  }

  if (typeof document === "undefined") return null;

  return <>{createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[70] bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-x-4 bottom-[max(env(safe-area-inset-bottom),1rem)] z-[71] mx-auto max-w-md overflow-hidden rounded-[24px]"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 38 }}
            style={{
              background:
                "linear-gradient(180deg, rgb(255 255 255 / 0.12) 0%, rgb(255 255 255 / 0.04) 100%), rgb(28 28 30 / 0.9)",
              backdropFilter: "blur(40px) saturate(180%)",
              WebkitBackdropFilter: "blur(40px) saturate(180%)",
              boxShadow:
                "inset 0 1px 0 rgb(255 255 255 / 0.3), 0 20px 60px rgb(0 0 0 / 0.5), 0 0 0 0.5px rgb(255 255 255 / 0.12)",
            }}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h3 className="text-[18px] font-semibold text-white">Make an offer</h3>
              <button type="button" onClick={onClose} className="rounded-full p-1.5 text-white/60 active:bg-white/10">
                <X className="h-5 w-5" />
              </button>
            </div>

            {recipientName && (
              <p className="px-5 text-[13px] text-white/50">
                Send a proposed price to {recipientName}
              </p>
            )}

            <div className="space-y-3 px-5 py-4">
              <div className="flex items-center gap-2 rounded-xl bg-white/[0.08] px-3.5 py-3 ring-1 ring-white/10 focus-within:ring-[#0A84FF]">
                <IndianRupee className="h-5 w-5 text-[#30D158]" />
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="Your proposed price"
                  className="min-w-0 flex-1 bg-transparent text-[17px] font-semibold text-white outline-none placeholder:text-white/30"
                  inputMode="decimal"
                />
              </div>

              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Add a note (optional)"
                rows={2}
                className="w-full rounded-xl bg-white/[0.08] px-3.5 py-3 text-[15px] text-white outline-none ring-1 ring-white/10 placeholder:text-white/30 focus:ring-[#0A84FF]"
              />
            </div>

            <div className="px-5 pb-5">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={sending || !price}
                className={cn(
                  "flex h-[50px] w-full items-center justify-center gap-2 rounded-[14px] text-[17px] font-semibold transition active:scale-[0.98]",
                  price ? "bg-[#0A84FF] text-white" : "bg-white/[0.08] text-white/30",
                )}
              >
                {sending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Send className="h-4 w-4" /> Send Offer
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )}</>;
}
