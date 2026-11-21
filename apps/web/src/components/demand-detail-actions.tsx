"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MessageCircle, Zap, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BoostDemandSheet } from "@/components/boost/boost-demand-sheet";
import { isBoostActive } from "@/lib/boost-shared";

interface DemandDetailActionsProps {
  demandId: string;
  isAuthor: boolean;
  isOpen: boolean;
  isPriority: boolean;
  /** End of the current / last featured boost (ISO), null if never featured. */
  priorityExpiresAt: string | null;
  shareContact: boolean;
  authorPhone: string | null;
  summary: string;
  viewerHoldsSlot: boolean;
}

export function DemandDetailActions({
  demandId,
  isAuthor,
  isOpen,
  isPriority,
  priorityExpiresAt,
  shareContact,
  authorPhone,
  summary,
  viewerHoldsSlot,
}: DemandDetailActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [openingChat, setOpeningChat] = useState(false);
  const [boostOpen, setBoostOpen] = useState(false);

  async function handleClose() {
    setBusy(true);
    try {
      const res = await fetch(`/api/demands/${demandId}/close`, { method: "PATCH" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error?.message ?? "Could not close this request.");
        return;
      }
      toast.success("Request closed.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const boostRunning = isBoostActive(isPriority, priorityExpiresAt);

  // Only meaningful for a bidder chatting with the author -- the author's
  // side of things (potentially up to 3 separate conversations, one per
  // slot holder) is handled per-slot from the SlotStrip instead, since a
  // single "Chat" button here would be ambiguous about which bidder.
  async function handleChat() {
    setOpeningChat(true);
    try {
      const res = await fetch(`/api/demands/${demandId}/conversation`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error?.message ?? "Could not open this chat.");
        return;
      }
      router.push(`/chats/${data.conversation.id}`);
    } finally {
      setOpeningChat(false);
    }
  }

  function handleWhatsApp() {
    if (!authorPhone) return;
    const greeting = encodeURIComponent(`Hi! I found your request on xivago: "${summary.slice(0, 80)}"`);
    window.open(`https://wa.me/${authorPhone.replace("+", "")}?text=${greeting}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {!isAuthor && (
          <Button variant="outline" className="flex-1" onClick={handleChat} disabled={openingChat || !viewerHoldsSlot}>
            {openingChat ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
            {viewerHoldsSlot ? "Chat" : "Take a response spot to chat"}
          </Button>
        )}
        {shareContact && authorPhone && (
          <Button className="flex-1 bg-[#25D366] hover:bg-[#1ea952]" onClick={handleWhatsApp}>
            WhatsApp
          </Button>
        )}
      </div>

      {isAuthor && isOpen && (
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setBoostOpen(true)} disabled={busy}>
            <Zap className="h-4 w-4" /> {priorityExpiresAt ? "Extend featured" : "Feature this post"}
          </Button>
          <Button variant="outline" className="flex-1" onClick={handleClose} disabled={busy}>
            <CheckCircle2 className="h-4 w-4" /> Close request
          </Button>
        </div>
      )}

      {isAuthor && boostRunning && (
        <p className="text-center text-xs text-amber-500">
          Featured until{" "}
          {new Date(priorityExpiresAt!).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
        </p>
      )}

      {isAuthor && (
        <p className="text-center text-xs text-neutral-400">
          Tap a provider above to chat with them.
        </p>
      )}

      <BoostDemandSheet
        open={boostOpen}
        onClose={() => setBoostOpen(false)}
        demandId={demandId}
        summary={summary}
        isPriority={isPriority}
        priorityExpiresAt={priorityExpiresAt}
        onDone={() => {
          setBoostOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}
