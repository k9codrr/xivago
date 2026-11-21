"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { ChevronRight, Loader2, Mail, MessageCircle, Search, UserPlus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { celebrate } from "@/components/celebration";
import { PresenceAvatar } from "./chat-primitives";

interface Person {
  kind: "user";
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  relation: "mutual" | "following" | "follower" | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const digitsOf = (s: string) => s.replace(/\D/g, "");
/** 10-digit numbers are taken as Indian mobiles; anything with a country code is used as-is. */
function waNumber(raw: string): string | null {
  const d = digitsOf(raw);
  if (d.length === 10) return `91${d}`;
  if (d.length >= 11 && d.length <= 15) return d.replace(/^0+/, "");
  return null;
}
const looksLikePhone = (s: string) => /^[+\d][\d\s-]{6,}$/.test(s.trim());

const RELATION_LABEL: Record<NonNullable<Person["relation"]>, string> = {
  mutual: "You follow each other",
  following: "You follow",
  follower: "Follows you",
};

/**
 * "New message" (the pencil on the Chats screen): find anyone on xivago and
 * open a chat, or -- if they aren't here yet -- invite them by email (sent
 * from our servers through Resend) or on WhatsApp (opens their chat with the
 * invite typed out).
 */
export function NewMessageSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<Person[] | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState({ name: "", email: "", phone: "" });
  const [sendingEmail, setSendingEmail] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setInviteOpen(false);
    setInvite({ name: "", email: "", phone: "" });
    setTimeout(() => inputRef.current?.focus(), 250);
  }, [open]);

  // Search (debounced). Empty query → people you're connected with.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const q = query.trim().replace(/^@/, "");
        const res = await fetch(`/api/mentions?q=${encodeURIComponent(EMAIL_RE.test(q) ? q.split("@")[0]! : q)}`);
        const j = res.ok ? await res.json() : { suggestions: [] };
        if (!cancelled) setPeople((j.suggestions as Array<{ kind: string }>).filter((s): s is Person => s.kind === "user"));
      } catch {
        if (!cancelled) setPeople([]);
      }
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, open]);

  // Typing an email / number / name that isn't found → prefill the invite form.
  const q = query.trim();
  const qIsEmail = EMAIL_RE.test(q);
  const qIsPhone = looksLikePhone(q);
  const suggestion = useMemo(() => {
    if (!q) return null;
    if (qIsEmail) return { label: `Invite ${q} by email`, prefill: { email: q } };
    if (qIsPhone) return { label: `Invite ${q} on WhatsApp`, prefill: { phone: q } };
    return { label: `Invite “${q}” to xivago`, prefill: { name: q } };
  }, [q, qIsEmail, qIsPhone]);

  async function openChat(p: Person) {
    if (opening) return;
    setOpening(p.id);
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: p.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error?.message ?? "Could not open a chat.");
        return;
      }
      onClose();
      router.push(`/chats/${data.conversation.id}`);
    } finally {
      setOpening(null);
    }
  }

  function startInvite(prefill: Partial<typeof invite>) {
    setInvite((v) => ({ ...v, ...prefill }));
    setInviteOpen(true);
  }

  async function sendEmailInvite() {
    if (!EMAIL_RE.test(invite.email.trim())) {
      toast.error("Enter a valid email address.");
      return;
    }
    setSendingEmail(true);
    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: invite.email.trim(), name: invite.name.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error?.message ?? "Could not send the invite.");
        return;
      }
      if (data.alreadyMember) {
        toast.success("They're already on xivago — opening your chat.");
        const r = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetUserId: data.userId }),
        });
        const j = await r.json();
        if (r.ok) {
          onClose();
          router.push(`/chats/${j.conversation.id}`);
        }
        return;
      }
      onClose();
      await celebrate({
        kind: "sent",
        title: "Invite sent",
        subtitle: `We emailed ${invite.name.trim() || invite.email.trim()} your invite link.`,
        duration: 2200,
      });
    } finally {
      setSendingEmail(false);
    }
  }

  async function sendWhatsAppInvite() {
    const number = invite.phone.trim() ? waNumber(invite.phone) : null;
    if (invite.phone.trim() && !number) {
      toast.error("Enter a valid mobile number.");
      return;
    }
    let link = window.location.origin;
    let code = "";
    try {
      const r = await fetch("/api/invites");
      if (r.ok) ({ link, code } = await r.json());
    } catch {
      // fall back to the plain site link
    }
    const hi = invite.name.trim() ? `Hi ${invite.name.trim().split(/\s+/)[0]}! ` : "Hi! ";
    const text = `${hi}I'd like to chat with you on xivago. Join here: ${link}${code ? ` (code ${code})` : ""}`;
    const url = `https://wa.me/${number ?? ""}?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener");
  }

  if (!mounted) return null;

  return <>{createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="new-msg"
          role="dialog"
          aria-modal="true"
          aria-label="New message"
          className="fixed inset-0 z-[95] flex flex-col bg-black text-white"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", stiffness: 380, damping: 40 }}
        >
          <div className="flex shrink-0 items-center justify-between px-3 pb-2 pt-[max(env(safe-area-inset-top),0.75rem)]">
            <button type="button" onClick={onClose} className="h-10 rounded-full px-2 text-[16px] text-white/80 active:opacity-60">
              Cancel
            </button>
            <p className="text-[17px] font-semibold">New message</p>
            <span className="w-[60px]" />
          </div>

          <div className="shrink-0 px-4 pb-2">
            <div className="flex h-11 items-center gap-2 rounded-xl bg-[#1c1c1e] px-3">
              <Search className="h-4 w-4 text-white/45" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, @username, email or phone"
                inputMode="search"
                className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-white/35"
              />
              {query && (
                <button type="button" onClick={() => setQuery("")} aria-label="Clear" className="text-white/50">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[max(env(safe-area-inset-bottom),24px)]">
            {/* Invite entry */}
            <button
              type="button"
              onClick={() => startInvite(suggestion?.prefill ?? {})}
              className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-white/5"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#3B7BF8] to-[#7C3AED]">
                <UserPlus className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-medium">{suggestion?.label ?? "Invite someone to xivago"}</span>
                <span className="block text-[13px] text-white/45">By email or WhatsApp</span>
              </span>
              <ChevronRight className="h-4 w-4 text-white/30" />
            </button>

            <AnimatePresence initial={false}>
              {inviteOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 420, damping: 40 }}
                  className="overflow-hidden"
                >
                  <div className="mx-4 mb-3 space-y-2.5 rounded-2xl bg-[#1c1c1e] p-4">
                    <Field label="Name (optional)" value={invite.name} onChange={(name) => setInvite((v) => ({ ...v, name }))} placeholder="Their name" />
                    <Field
                      label="Email"
                      type="email"
                      value={invite.email}
                      onChange={(email) => setInvite((v) => ({ ...v, email }))}
                      placeholder="name@example.com"
                    />
                    <Field
                      label="Mobile (for WhatsApp)"
                      type="tel"
                      value={invite.phone}
                      onChange={(phone) => setInvite((v) => ({ ...v, phone }))}
                      placeholder="98765 43210"
                    />
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => void sendEmailInvite()}
                        disabled={sendingEmail || !invite.email.trim()}
                        className="flex h-11 items-center justify-center gap-2 rounded-full bg-white text-[14px] font-semibold text-black transition-transform active:scale-95 disabled:opacity-40"
                      >
                        {sendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                        Email invite
                      </button>
                      <button
                        type="button"
                        onClick={() => void sendWhatsAppInvite()}
                        className="flex h-11 items-center justify-center gap-2 rounded-full bg-[#25D366] text-[14px] font-semibold text-black transition-transform active:scale-95"
                      >
                        <MessageCircle className="h-4 w-4" />
                        WhatsApp
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <p className="px-4 pb-1 pt-3 text-[12px] font-semibold uppercase tracking-wider text-white/40">
              {q ? "On xivago" : "Suggested"}
            </p>
            {people === null && (
              <div className="flex justify-center py-8 text-white/40">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            )}
            {people?.length === 0 && (
              <p className="px-4 py-6 text-center text-[14px] text-white/45">
                {q ? "No one on xivago matches that. Invite them above." : "Follow people to see them here."}
              </p>
            )}
            <ul>
              {people?.map((p, i) => (
                <motion.li key={p.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.02 }}>
                  <button
                    type="button"
                    onClick={() => void openChat(p)}
                    disabled={Boolean(opening)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-white/5"
                  >
                    <PresenceAvatar id={p.id} name={p.name} src={p.avatarUrl} size={48} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[16px] font-medium">{p.name}</span>
                      <span className="block truncate text-[13px] text-white/45">
                        @{p.username}
                        {p.relation && ` · ${RELATION_LABEL[p.relation]}`}
                      </span>
                    </span>
                    {opening === p.id && <Loader2 className="h-4 w-4 animate-spin text-white/60" />}
                  </button>
                </motion.li>
              ))}
            </ul>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )}</>;
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-[12px] text-white/50">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn("mt-1 h-11 w-full rounded-xl bg-black/40 px-3 text-[16px] outline-none ring-1 ring-white/10 placeholder:text-white/30 focus:ring-[#3B7BF8]")}
      />
    </label>
  );
}
