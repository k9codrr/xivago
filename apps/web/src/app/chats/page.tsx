"use client";

/*
 * Chats list. Earlier designs (plain list, Apple Messages style) live in git
 * history -- see this file before commit "Chat: pro redesign".
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { AnimatePresence, motion } from "motion/react";
import { BadgeCheck, Ban, Loader2, MessageCirclePlus, Search, SquarePen, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/time";
import { seedPresence, usePresence } from "@/lib/presence";
import { MessageTicks, PresenceAvatar } from "@/components/chat/chat-primitives";
import { NewMessageSheet } from "@/components/chat/new-message-sheet";

interface ConversationSummary {
  id: string;
  kind: "slot" | "demand" | "direct" | "request";
  status: "ACTIVE" | "PENDING" | "DECLINED";
  requestedByMe: boolean;
  demand: { id: string; summary: string; status: string } | null;
  otherParty: {
    id: string;
    name: string;
    username?: string | null;
    avatarUrl: string | null;
    companyName: string | null;
    isVerified?: boolean;
    lastSeenAt?: string | null;
  };
  lastMessage: {
    text: string;
    createdAt: string;
    senderId: string;
    readAt: string | null;
    deliveredAt?: string | null;
    deletedAt?: string | null;
    attachments?: Array<{ contentType: string }>;
  } | null;
  unreadCount: number;
}

type TabKey = "all" | ConversationSummary["kind"];

function preview(c: ConversationSummary): string {
  const m = c.lastMessage;
  if (!m) return c.demand?.summary ?? "Say hello 👋";
  if (m.deletedAt) return "This message was deleted";
  if (m.text) return m.text;
  const ct = m.attachments?.[0]?.contentType ?? "";
  if (ct.startsWith("image/")) return "📷 Photo";
  if (ct.startsWith("video/")) return "🎥 Video";
  return "📎 Document";
}

export default function ChatsListPage() {
  const { data: session } = useSession();
  const myId = session?.user?.id;
  const [conversations, setConversations] = useState<ConversationSummary[] | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [query, setQuery] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const res = await fetch("/api/conversations");
      const list: ConversationSummary[] = res.ok ? (await res.json()).conversations : [];
      if (cancelled) return;
      list.forEach((c) => seedPresence(c.otherParty.id, c.otherParty.lastSeenAt ?? null));
      setConversations(list);
    };
    void load();
    // Keep previews / unread counts fresh while the list is open.
    const onVisible = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", onVisible);
    const interval = setInterval(() => document.visibilityState === "visible" && void load(), 15000);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(interval);
    };
  }, []);

  const presence = usePresence(useMemo(() => conversations?.map((c) => c.otherParty.id) ?? [], [conversations]));

  const counts = useMemo(() => {
    const by: Record<string, number> = {};
    for (const c of conversations ?? []) by[c.kind] = (by[c.kind] ?? 0) + 1;
    return by;
  }, [conversations]);
  const requestCount = counts.request ?? 0;

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: "all", label: "All" },
    ...(counts.slot ? [{ key: "slot" as const, label: "My responses" }] : []),
    ...(counts.demand ? [{ key: "demand" as const, label: "My requests" }] : []),
    ...(counts.direct ? [{ key: "direct" as const, label: "Direct" }] : []),
    ...(requestCount > 0 || activeTab === "request"
      ? [{ key: "request" as const, label: requestCount > 0 ? `Requests ${requestCount}` : "Requests" }]
      : []),
  ];

  const filtered = useMemo(() => {
    if (!conversations) return null;
    const q = query.trim().toLowerCase();
    return conversations.filter((c) => {
      const inTab = activeTab === "all" ? c.kind !== "request" : c.kind === activeTab;
      if (!inTab) return false;
      if (!q) return true;
      return [c.otherParty.name, c.otherParty.companyName, c.otherParty.username, c.lastMessage?.text, c.demand?.summary]
        .filter(Boolean)
        .some((s) => s!.toLowerCase().includes(q));
    });
  }, [conversations, activeTab, query]);

  return (
    <main className="flex min-h-dvh flex-col bg-black pb-28 text-white">
      <header className="sticky top-0 z-20 bg-black/85 px-4 pb-2 pt-[max(env(safe-area-inset-top),0.75rem)] backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <h1 className="text-[32px] font-bold tracking-tight">Chats</h1>
          <motion.button
            type="button"
            onClick={() => setComposeOpen(true)}
            aria-label="New message"
            whileTap={{ scale: 0.88 }}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1c1c1e] text-white"
          >
            <SquarePen className="h-[19px] w-[19px]" />
          </motion.button>
        </div>

        <div className="mt-2 flex h-10 items-center gap-2 rounded-xl bg-[#1c1c1e] px-3">
          <Search className="h-4 w-4 text-white/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-white/35"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="text-white/50">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" data-swipe-zone>
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className="relative shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold"
            >
              {activeTab === t.key && (
                <motion.span
                  layoutId="chats-tab"
                  className="absolute inset-0 rounded-full bg-white"
                  transition={{ type: "spring", stiffness: 500, damping: 38 }}
                />
              )}
              <span className={cn("relative", activeTab === t.key ? "text-black" : "text-white/60")}>{t.label}</span>
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1">
        {conversations === null && (
          <ul className="mt-2 space-y-1 px-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <li key={i} className="flex items-center gap-3 py-2.5">
                <span className="h-14 w-14 animate-pulse rounded-full bg-white/[0.07]" />
                <span className="flex-1 space-y-2">
                  <span className="block h-3 w-1/3 animate-pulse rounded-full bg-white/[0.07]" />
                  <span className="block h-3 w-2/3 animate-pulse rounded-full bg-white/[0.05]" />
                </span>
              </li>
            ))}
          </ul>
        )}

        {filtered !== null && filtered.length === 0 && (
          <motion.div className="flex flex-col items-center px-8 py-16 text-center" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.06]">
              <MessageCirclePlus className="h-7 w-7 text-white/60" />
            </span>
            <p className="mt-4 text-[17px] font-semibold">{query ? "No matches" : "No chats yet"}</p>
            <p className="mt-1 text-[14px] text-white/50">
              {query
                ? "Try a different name."
                : activeTab === "request"
                  ? "No message requests."
                  : "Start a conversation with anyone on xivago — or invite someone new."}
            </p>
            {!query && activeTab !== "request" && (
              <button
                type="button"
                onClick={() => setComposeOpen(true)}
                className="mt-5 rounded-full bg-white px-5 py-2.5 text-[14px] font-semibold text-black active:scale-95"
              >
                New message
              </button>
            )}
          </motion.div>
        )}

        {activeTab === "request" && filtered !== null && filtered.length > 0 && (
          <p className="px-4 pt-2 text-xs text-white/45">
            People you aren&apos;t connected with yet. They won&apos;t know you&apos;ve seen their message until you accept.
          </p>
        )}

        <ul className="mt-1">
          <AnimatePresence initial={false}>
            {filtered?.map((c, i) => {
              const name = c.otherParty.companyName ?? c.otherParty.name;
              const online = presence.get(c.otherParty.id)?.online ?? false;
              const unread = c.unreadCount > 0;
              const mineLast = c.lastMessage?.senderId === myId;
              return (
                <motion.li
                  key={c.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: Math.min(i, 12) * 0.02 }}
                >
                  <Link href={`/chats/${c.id}`} className="flex items-center gap-3 px-4 py-2.5 transition-colors active:bg-white/[0.04]">
                    <PresenceAvatar id={c.otherParty.id} name={name} src={c.otherParty.avatarUrl} size={56} online={online} />
                    <div className="min-w-0 flex-1 border-b border-white/[0.05] pb-2.5 pt-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="flex min-w-0 items-center gap-1 text-[16px] font-semibold">
                          <span className="truncate">{name}</span>
                          {c.otherParty.isVerified && <BadgeCheck className="h-4 w-4 shrink-0 fill-[#0A84FF] text-black" />}
                          {c.requestedByMe && c.status !== "ACTIVE" && (
                            <span className="ml-1 shrink-0 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-white/60">
                              {c.status === "DECLINED" ? "Declined" : "Request sent"}
                            </span>
                          )}
                        </p>
                        {c.lastMessage && (
                          <span className={cn("shrink-0 text-[12px]", unread ? "font-semibold text-[#0A84FF]" : "text-white/40")}>
                            {timeAgo(c.lastMessage.createdAt)}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-2">
                        <p className={cn("flex min-w-0 items-center gap-1 text-[14px]", unread ? "text-white" : "text-white/50")}>
                          {mineLast && c.lastMessage && !c.lastMessage.deletedAt && (
                            <MessageTicks deliveredAt={c.lastMessage.deliveredAt} readAt={c.lastMessage.readAt} className="shrink-0" />
                          )}
                          {c.lastMessage?.deletedAt && <Ban className="h-3.5 w-3.5 shrink-0" />}
                          <span className="truncate">{preview(c)}</span>
                        </p>
                        {unread && (
                          <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="flex h-[22px] min-w-[22px] shrink-0 items-center justify-center rounded-full bg-[#0A84FF] px-1.5 text-[12px] font-bold"
                          >
                            {c.unreadCount}
                          </motion.span>
                        )}
                      </div>
                    </div>
                  </Link>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
        {conversations === null && (
          <div className="sr-only">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}
      </div>

      <NewMessageSheet open={composeOpen} onClose={() => setComposeOpen(false)} />
    </main>
  );
}
