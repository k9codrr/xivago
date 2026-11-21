"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Check, Loader2, Search, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PresenceAvatar } from "./chat-primitives";

interface Target {
  id: string;
  status: "ACTIVE" | "PENDING" | "DECLINED";
  requestedByMe: boolean;
  otherParty: { id: string; name: string; avatarUrl: string | null; companyName: string | null };
}

/**
 * Forward a message to one or more chats (WhatsApp style): search, tick
 * several people, send. Chats that can't take a message right now (a request
 * you haven't accepted, a declined request) are left out.
 */
export function ForwardSheet({
  open,
  excludeId,
  onClose,
  onSend,
}: {
  open: boolean;
  excludeId: string;
  onClose: () => void;
  onSend: (conversationIds: string[]) => Promise<void>;
}) {
  const [mounted, setMounted] = useState(false);
  const [targets, setTargets] = useState<Target[] | null>(null);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setPicked([]);
    setQuery("");
    fetch("/api/conversations")
      .then((r) => (r.ok ? r.json() : { conversations: [] }))
      .then((j: { conversations: Target[] }) =>
        setTargets(
          j.conversations.filter(
            (c) => c.status !== "DECLINED" && !(c.status === "PENDING" && !c.requestedByMe),
          ),
        ),
      )
      .catch(() => setTargets([]));
  }, [open]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (targets ?? []).filter((t) => !q || `${t.otherParty.name} ${t.otherParty.companyName ?? ""}`.toLowerCase().includes(q));
  }, [targets, query]);

  if (!mounted) return null;

  return <>{createPortal(
    <AnimatePresence>
      {open && (
        <motion.div key="fwd" className="fixed inset-0 z-[115] flex items-end justify-center">
          <motion.div className="absolute inset-0 bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Forward to"
            className="relative flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[28px] bg-[#161618] text-white ring-1 ring-white/10"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
          >
            <div className="mx-auto mt-2.5 h-[5px] w-10 rounded-full bg-white/20" />
            <div className="flex items-center justify-between px-4 pb-2 pt-3">
              <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full active:bg-white/10">
                <X className="h-5 w-5" />
              </button>
              <p className="text-[16px] font-semibold">Forward to…</p>
              <span className="w-9" />
            </div>
            <div className="px-4 pb-2">
              <div className="flex h-10 items-center gap-2 rounded-xl bg-white/[0.07] px-3">
                <Search className="h-4 w-4 text-white/45" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search"
                  className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-white/40"
                />
              </div>
            </div>
            <ul className="min-h-[200px] flex-1 overflow-y-auto pb-24">
              {targets === null && (
                <li className="flex justify-center py-10 text-white/50">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </li>
              )}
              {shown.map((t) => {
                const on = picked.includes(t.id);
                const name = t.otherParty.companyName ?? t.otherParty.name;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => setPicked((p) => (on ? p.filter((x) => x !== t.id) : [...p, t.id]))}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-white/5"
                    >
                      <PresenceAvatar id={t.otherParty.id} name={name} src={t.otherParty.avatarUrl} size={46} />
                      <span className="min-w-0 flex-1 truncate text-[16px]">
                        {name}
                        {t.id === excludeId && <span className="ml-1.5 text-[12px] text-white/40">(this chat)</span>}
                      </span>
                      <motion.span
                        animate={{ scale: on ? [1, 1.25, 1] : 1 }}
                        className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-full border-2",
                          on ? "border-[#0A84FF] bg-[#0A84FF]" : "border-white/30",
                        )}
                      >
                        {on && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                      </motion.span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <AnimatePresence>
              {picked.length > 0 && (
                <motion.div
                  className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-[#1f1f22]/95 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),12px)] backdrop-blur"
                  initial={{ y: 80 }}
                  animate={{ y: 0 }}
                  exit={{ y: 80 }}
                  transition={{ type: "spring", stiffness: 420, damping: 36 }}
                >
                  <p className="min-w-0 flex-1 truncate text-[14px] text-white/70">
                    {picked
                      .map((id) => targets?.find((t) => t.id === id))
                      .filter(Boolean)
                      .map((t) => t!.otherParty.companyName ?? t!.otherParty.name)
                      .join(", ")}
                  </p>
                  <button
                    type="button"
                    disabled={sending}
                    onClick={async () => {
                      setSending(true);
                      try {
                        await onSend(picked);
                      } finally {
                        setSending(false);
                      }
                    }}
                    aria-label="Send"
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-[#0A84FF] text-white shadow-lg active:scale-95"
                  >
                    {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )}</>;
}
