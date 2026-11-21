"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bookmark, Check, Facebook, Link2, Linkedin, Loader2, Mail, MessageCircle, MessageSquare, MoreHorizontal, Search, Send, X as Close } from "lucide-react";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import type { ForumPost } from "./types";

interface Person {
  id: string;
  name: string;
  avatarUrl: string | null;
  companyName: string | null;
}

type ExternalChannel = "copy" | "native" | "whatsapp" | "x" | "telegram" | "facebook" | "linkedin" | "email" | "sms";

interface ShareDrawerProps {
  post: ForumPost;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShared: (shareCount: number) => void;
  onToggleBookmark: () => void;
}

function displayName(p: Person) {
  return p.companyName ?? p.name;
}

/** X's logo isn't in lucide. */
function XLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

/** People to suggest first: recent chats, then who the viewer follows. */
function useSuggestedPeople(enabled: boolean, myId: string | undefined) {
  return useQuery<Person[]>({
    queryKey: ["share-suggestions", myId],
    enabled: enabled && Boolean(myId),
    staleTime: 60_000,
    queryFn: async () => {
      const [chatsRes, followingRes] = await Promise.all([
        fetch("/api/conversations"),
        fetch(`/api/users/${myId}/following`),
      ]);
      const chats = chatsRes.ok ? ((await chatsRes.json()).conversations as Array<{ otherParty: Person }>) : [];
      const following = followingRes.ok ? ((await followingRes.json()).users as Person[]) : [];
      const seen = new Set<string>();
      const people: Person[] = [];
      for (const p of [...chats.map((c) => c.otherParty), ...following]) {
        if (!p || p.id === myId || seen.has(p.id)) continue;
        seen.add(p.id);
        people.push(p);
      }
      return people;
    },
  });
}

function usePeopleSearch(q: string) {
  const [debounced, setDebounced] = useState(q);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  return useQuery<Person[]>({
    queryKey: ["share-people-search", debounced],
    enabled: debounced.length >= 2,
    staleTime: 30_000,
    queryFn: async () => {
      const res = await fetch(`/api/search?type=people&q=${encodeURIComponent(debounced)}`);
      if (!res.ok) return [];
      return (await res.json()).people as Person[];
    },
  });
}

export function ShareDrawer({ post, open, onOpenChange, onShared, onToggleBookmark }: ShareDrawerProps) {
  const { data: session } = useSession();
  const myId = session?.user?.id;
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Map<string, Person>>(new Map());
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);

  const suggestions = useSuggestedPeople(open, myId);
  const search = usePeopleSearch(query);

  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  // Fresh state each time the drawer opens.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelected(new Map());
    setNote("");
  }, [open]);

  const url = typeof window !== "undefined" ? `${window.location.origin}/forum/${post.id}` : `/forum/${post.id}`;
  const author = post.sender.companyName ?? post.sender.name;
  const snippet = post.text.length > 120 ? `${post.text.slice(0, 117)}…` : post.text;
  const shareText = snippet ? `${author}: "${snippet}"` : `A post by ${author} on xivago`;

  const people = useMemo(() => {
    const list = query.trim().length >= 2 ? (search.data ?? []) : (suggestions.data ?? []);
    return list.filter((p) => p.id !== myId);
  }, [query, search.data, suggestions.data, myId]);
  const loadingPeople = query.trim().length >= 2 ? search.isFetching : suggestions.isLoading;

  function togglePerson(p: Person) {
    void haptic("selection");
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(p.id)) next.delete(p.id);
      else next.set(p.id, p);
      return next;
    });
  }

  async function recordExternal(channel: ExternalChannel) {
    try {
      const res = await fetch(`/api/forum/${post.id}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel }),
      });
      if (res.ok) onShared((await res.json()).shareCount);
    } catch {
      // Counting is best-effort; the share itself already happened.
    }
  }

  async function sendToPeople() {
    if (selected.size === 0 || sending) return;
    if (!myId) {
      toast.error("Sign in to send posts.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`/api/forum/${post.id}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientIds: [...selected.keys()], note: note.trim() || undefined }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok && !data?.failed) {
        void haptic("error");
        toast.error(data?.error?.message ?? "Could not send this post.");
        return;
      }
      if (typeof data.shareCount === "number") onShared(data.shareCount);
      const sent: string[] = data.sent ?? [];
      const failed: Array<{ userId: string; reason: string }> = data.failed ?? [];
      if (sent.length > 0) {
        void haptic("success");
        toast.success(sent.length === 1 ? `Sent to ${displayName(selected.get(sent[0]!)!)}` : `Sent to ${sent.length} people`);
      }
      if (failed.length > 0) {
        void haptic(sent.length ? "warning" : "error");
        const first = failed[0]!;
        const who = selected.get(first.userId);
        toast.error(`${who ? `${displayName(who)}: ` : ""}${first.reason}${failed.length > 1 ? ` (+${failed.length - 1} more)` : ""}`);
      }
      if (failed.length === 0) onOpenChange(false);
      else setSelected(new Map(failed.flatMap((f) => (selected.has(f.userId) ? [[f.userId, selected.get(f.userId)!]] : []))));
    } finally {
      setSending(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      void haptic("success");
      toast.success("Link copied");
      void recordExternal("copy");
      onOpenChange(false);
    } catch {
      void haptic("error");
      toast.error("Could not copy link");
    }
  }

  /** The OS share sheet: every app installed on the phone (iOS and Android). */
  async function nativeShare() {
    try {
      await navigator.share({ title: `Post by ${author}`, text: shareText, url });
      void recordExternal("native");
      onOpenChange(false);
    } catch (err) {
      if ((err as DOMException)?.name !== "AbortError") toast.error("Could not open the share sheet");
    }
  }

  function openExternal(channel: ExternalChannel, href: string) {
    void haptic("light");
    void recordExternal(channel);
    // mailto:/sms: must open in place; web intents open in a new tab (or the app, via universal links).
    if (href.startsWith("mailto:") || href.startsWith("sms:")) window.location.href = href;
    else window.open(href, "_blank", "noopener,noreferrer");
    onOpenChange(false);
  }

  const eu = encodeURIComponent(url);
  const et = encodeURIComponent(shareText);
  const apps: Array<{ key: string; label: string; icon: ReactNode; bg: string; onClick: () => void }> = [
    { key: "copy", label: "Copy link", icon: <Link2 className="h-6 w-6" />, bg: "bg-neutral-700", onClick: copyLink },
    ...(canNativeShare
      ? [{ key: "native", label: "More", icon: <MoreHorizontal className="h-6 w-6" />, bg: "bg-neutral-700", onClick: nativeShare }]
      : []),
    { key: "whatsapp", label: "WhatsApp", icon: <MessageCircle className="h-6 w-6" />, bg: "bg-[#25D366]", onClick: () => openExternal("whatsapp", `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${url}`)}`) },
    { key: "x", label: "X", icon: <XLogo className="h-5 w-5" />, bg: "bg-black ring-1 ring-neutral-700", onClick: () => openExternal("x", `https://x.com/intent/post?text=${et}&url=${eu}`) },
    { key: "telegram", label: "Telegram", icon: <Send className="h-6 w-6" />, bg: "bg-[#229ED9]", onClick: () => openExternal("telegram", `https://t.me/share/url?url=${eu}&text=${et}`) },
    { key: "facebook", label: "Facebook", icon: <Facebook className="h-6 w-6" />, bg: "bg-[#1877F2]", onClick: () => openExternal("facebook", `https://www.facebook.com/sharer/sharer.php?u=${eu}`) },
    { key: "linkedin", label: "LinkedIn", icon: <Linkedin className="h-6 w-6" />, bg: "bg-[#0A66C2]", onClick: () => openExternal("linkedin", `https://www.linkedin.com/sharing/share-offsite/?url=${eu}`) },
    { key: "sms", label: "Messages", icon: <MessageSquare className="h-6 w-6" />, bg: "bg-[#34C759]", onClick: () => openExternal("sms", `sms:?&body=${encodeURIComponent(`${shareText}\n${url}`)}`) },
    { key: "email", label: "Email", icon: <Mail className="h-6 w-6" />, bg: "bg-neutral-600", onClick: () => openExternal("email", `mailto:?subject=${encodeURIComponent(`Post by ${author}`)}&body=${encodeURIComponent(`${shareText}\n\n${url}`)}`) },
  ];

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        data-post-no-open
        onClick={(e) => e.stopPropagation()}
        className="mx-auto max-w-lg border-neutral-800 bg-neutral-950 text-white"
      >
        <div className="flex items-center justify-between px-4 pb-2 pt-3">
          <span className="w-8" />
          <DrawerTitle className="text-base font-semibold text-white">Share</DrawerTitle>
          <button
            type="button"
            aria-label="Close"
            onClick={() => onOpenChange(false)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 hover:bg-white/10"
          >
            <Close className="h-5 w-5" />
          </button>
        </div>
        <DrawerDescription className="sr-only">Send this post to people on xivago or share it to another app.</DrawerDescription>

        {/* search */}
        <div className="px-4">
          <label className="flex items-center gap-2 rounded-xl bg-neutral-900 px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-neutral-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-neutral-500"
            />
          </label>
        </div>

        {/* people grid */}
        <div className="mt-3 max-h-[38vh] min-h-[7rem] overflow-y-auto px-2">
          {loadingPeople && people.length === 0 ? (
            <div className="flex justify-center py-8 text-neutral-500">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : people.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-neutral-500">
              {!myId ? "Sign in to send posts to people." : query.trim().length >= 2 ? "No one found." : "Search for someone to send this to."}
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-y-3 sm:grid-cols-5">
              {people.map((p) => {
                const isSelected = selected.has(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePerson(p)}
                    className="flex flex-col items-center gap-1.5 rounded-xl px-1 py-1.5 active:bg-white/5"
                  >
                    <span className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.avatarUrl ?? "/icons/avatar-placeholder.svg"}
                        alt=""
                        className={cn(
                          "h-14 w-14 rounded-full bg-neutral-800 object-cover transition",
                          isSelected && "ring-2 ring-brand-500 ring-offset-2 ring-offset-neutral-950",
                        )}
                      />
                      {isSelected && (
                        <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-neutral-950 bg-brand-500">
                          <Check className="h-3 w-3 text-white" strokeWidth={3} />
                        </span>
                      )}
                    </span>
                    <span className="line-clamp-2 w-full text-center text-[11px] leading-tight text-neutral-300">
                      {displayName(p)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {selected.size > 0 ? (
          /* compose + send, like Instagram once someone is picked */
          <div className="space-y-2 border-t border-neutral-800 px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              placeholder="Write a message…"
              className="w-full rounded-xl bg-neutral-900 px-3 py-2.5 text-[15px] text-white outline-none placeholder:text-neutral-500"
            />
            <button
              type="button"
              disabled={sending}
              onClick={sendToPeople}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 text-[15px] font-semibold text-white transition active:scale-[0.99] disabled:opacity-60"
            >
              {sending && <Loader2 className="h-4 w-4 animate-spin" />}
              {selected.size === 1 ? "Send" : `Send separately (${selected.size})`}
            </button>
          </div>
        ) : (
          /* share to other apps */
          <div className="border-t border-neutral-800 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3">
            <div className="flex gap-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
              <ShareTarget
                label={post.isBookmarked ? "Saved" : "Save"}
                bg={post.isBookmarked ? "bg-amber-500" : "bg-neutral-700"}
                icon={<Bookmark className={cn("h-6 w-6", post.isBookmarked && "fill-current")} />}
                onClick={onToggleBookmark}
              />
              {apps.map((a) => (
                <ShareTarget key={a.key} label={a.label} bg={a.bg} icon={a.icon} onClick={a.onClick} />
              ))}
            </div>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}

function ShareTarget({ label, icon, bg, onClick }: { label: string; icon: ReactNode; bg: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-16 shrink-0 flex-col items-center gap-1.5">
      <span className={cn("flex h-14 w-14 items-center justify-center rounded-full text-white transition active:scale-95", bg)}>
        {icon}
      </span>
      <span className="w-full truncate text-center text-[11px] text-neutral-300">{label}</span>
    </button>
  );
}
