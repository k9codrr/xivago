"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BellOff,
  CheckCheck,
  ChevronLeft,
  Coins,
  Gift,
  Heart,
  History,
  Loader2,
  Megaphone,
  MessageCircle,
  Newspaper,
  Settings2,
  Star,
  Ticket,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
  AtSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/time";
import { NOTIFICATIONS_READ_EVENT, useOnPushReceived } from "@/lib/use-unread-notifications";

// ── Types ───────────────────────────────────────────────────────────────────

interface Person {
  id: string;
  name: string | null;
  avatarUrl: string | null;
}

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string;
  url: string | null;
  readAt: string | null;
  createdAt: string;
  actor: Person | null;
}

interface ActivityItem {
  id: string;
  kind: "credit" | "demand" | "slot" | "post" | "comment" | "reaction" | "follow" | "rating" | "community";
  title: string;
  detail: string | null;
  amount: number | null;
  url: string | null;
  createdAt: string;
  person: Person | null;
}

type Tab = "notifications" | "you";

// ── Visuals ─────────────────────────────────────────────────────────────────

interface Visual {
  icon: LucideIcon;
  tint: string; // icon colour
  bg: string; // badge background
}

const NOTIFICATION_VISUALS: Record<string, Visual> = {
  new_follower: { icon: UserPlus, tint: "text-sky-300", bg: "bg-sky-500" },
  slot_purchased: { icon: Ticket, tint: "text-amber-300", bg: "bg-amber-500" },
  post_reaction: { icon: Heart, tint: "text-rose-300", bg: "bg-rose-500" },
  comment_reaction: { icon: Heart, tint: "text-rose-300", bg: "bg-rose-500" },
  post_comment: { icon: MessageCircle, tint: "text-blue-300", bg: "bg-blue-500" },
  rating_received: { icon: Star, tint: "text-yellow-300", bg: "bg-yellow-500" },
  credits_purchased: { icon: Coins, tint: "text-emerald-300", bg: "bg-emerald-500" },
  credits_granted: { icon: Coins, tint: "text-emerald-300", bg: "bg-emerald-500" },
  credits_deducted: { icon: Coins, tint: "text-red-300", bg: "bg-red-500" },
  credits_refunded: { icon: Coins, tint: "text-emerald-300", bg: "bg-emerald-500" },
  refund_requested: { icon: Coins, tint: "text-amber-300", bg: "bg-amber-500" },
  referral_reward: { icon: Gift, tint: "text-fuchsia-300", bg: "bg-fuchsia-500" },
  following_demand: { icon: Megaphone, tint: "text-violet-300", bg: "bg-violet-500" },
  following_post: { icon: Newspaper, tint: "text-indigo-300", bg: "bg-indigo-500" },
  post_mention: { icon: AtSign, tint: "text-sky-300", bg: "bg-sky-500" },
};
const DEFAULT_VISUAL: Visual = { icon: History, tint: "text-white/70", bg: "bg-neutral-600" };

const ACTIVITY_VISUALS: Record<ActivityItem["kind"], Visual> = {
  credit: { icon: Wallet, tint: "text-emerald-300", bg: "bg-emerald-500/15" },
  demand: { icon: Megaphone, tint: "text-violet-300", bg: "bg-violet-500/15" },
  slot: { icon: Ticket, tint: "text-amber-300", bg: "bg-amber-500/15" },
  post: { icon: Newspaper, tint: "text-indigo-300", bg: "bg-indigo-500/15" },
  comment: { icon: MessageCircle, tint: "text-blue-300", bg: "bg-blue-500/15" },
  reaction: { icon: Heart, tint: "text-rose-300", bg: "bg-rose-500/15" },
  follow: { icon: UserPlus, tint: "text-sky-300", bg: "bg-sky-500/15" },
  rating: { icon: Star, tint: "text-yellow-300", bg: "bg-yellow-500/15" },
  community: { icon: Users, tint: "text-teal-300", bg: "bg-teal-500/15" },
};

const ACTIVITY_FILTERS = [
  { key: "all", label: "All", kinds: null },
  { key: "credits", label: "Credits", kinds: ["credit"] },
  { key: "demands", label: "Requests & responses", kinds: ["demand", "slot"] },
  { key: "posts", label: "Posts", kinds: ["post", "comment", "community"] },
  { key: "social", label: "Likes & follows", kinds: ["reaction", "follow", "rating"] },
] as const;

type FilterKey = (typeof ACTIVITY_FILTERS)[number]["key"];

// ── Helpers ─────────────────────────────────────────────────────────────────

function sectionOf(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const t = d.getTime();
  if (t >= startOfToday) return "Today";
  if (t >= startOfToday - 86_400_000) return "Yesterday";
  if (t >= startOfToday - 6 * 86_400_000) return "This week";
  if (t >= startOfToday - 29 * 86_400_000) return "This month";
  return "Earlier";
}

function groupBy<T>(items: T[], key: (item: T) => string): Array<[string, T[]]> {
  const groups: Array<[string, T[]]> = [];
  for (const item of items) {
    const k = key(item);
    const last = groups[groups.length - 1];
    if (last && last[0] === k) last[1].push(item);
    else groups.push([k, [item]]);
  }
  return groups;
}

function fullTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function Avatar({ person, size = 44 }: { person: Person; size?: number }) {
  const initial = (person.name ?? "?").trim().charAt(0).toUpperCase() || "?";
  return person.avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={person.avatarUrl}
      alt=""
      className="shrink-0 rounded-full object-cover ring-1 ring-white/10"
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-neutral-600 to-neutral-800 font-semibold text-white ring-1 ring-white/10"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initial}
    </span>
  );
}

function useInfiniteSentinel(onReach: () => void, enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    const io = new IntersectionObserver((entries) => entries[0]?.isIntersecting && onReach(), {
      rootMargin: "400px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [onReach, enabled]);
  return ref;
}

// ── Notifications tab ───────────────────────────────────────────────────────

function NotificationsTab({ onUnreadChange }: { onUnreadChange: (n: number) => void }) {
  const router = useRouter();
  const [items, setItems] = useState<NotificationRow[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  // Unread when the page opened -- stays highlighted for this visit after we mark them read.
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());

  const markAllRead = useCallback(async () => {
    await fetch("/api/notifications/read", { method: "POST" }).catch(() => {});
    window.dispatchEvent(new CustomEvent(NOTIFICATIONS_READ_EVENT));
    onUnreadChange(0);
  }, [onUnreadChange]);

  const loadFirst = useCallback(async () => {
    const res = await fetch("/api/notifications", { cache: "no-store" });
    if (!res.ok) {
      setItems((prev) => prev ?? []);
      return;
    }
    const data = (await res.json()) as { notifications: NotificationRow[]; nextCursor: string | null; unreadCount: number };
    setItems((prev) => {
      if (!prev) return data.notifications;
      // Merge newly-arrived rows on top without dropping already-paged ones.
      const known = new Set(prev.map((n) => n.id));
      const incoming = data.notifications.filter((n) => !known.has(n.id));
      return [...incoming, ...prev.map((p) => data.notifications.find((n) => n.id === p.id) ?? p)];
    });
    setCursor((prev) => prev ?? data.nextCursor);
    const unread = data.notifications.filter((n) => !n.readAt).map((n) => n.id);
    if (unread.length) {
      setFreshIds((prev) => new Set([...prev, ...unread]));
      void markAllRead();
    }
  }, [markAllRead]);

  useEffect(() => {
    void loadFirst();
  }, [loadFirst]);
  useOnPushReceived(loadFirst);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/notifications?cursor=${encodeURIComponent(cursor)}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { notifications: NotificationRow[]; nextCursor: string | null };
      setItems((prev) => [...(prev ?? []), ...data.notifications]);
      setCursor(data.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore]);

  const sentinel = useInfiniteSentinel(loadMore, Boolean(cursor));

  if (!items) return <ListSkeleton />;

  if (items.length === 0) {
    return (
      <EmptyState
        icon={BellOff}
        title="No notifications yet"
        text="When people follow you, react to or comment on your posts, respond to your requests, or send you credits, you'll see it here."
      />
    );
  }

  const groups = groupBy(items, (n) => (freshIds.has(n.id) ? "New" : sectionOf(n.createdAt)));

  return (
    <div className="pb-6">
      {groups.map(([section, rows]) => (
        <section key={section} className="mt-4">
          <h2 className="px-4 pb-1.5 text-[15px] font-semibold text-white">{section}</h2>
          <ul>
            {rows.map((n) => {
              const visual = NOTIFICATION_VISUALS[n.type] ?? DEFAULT_VISUAL;
              const Icon = visual.icon;
              const fresh = freshIds.has(n.id);
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => n.url && router.push(n.url)}
                    className={cn(
                      "flex w-full items-start gap-3 px-4 py-3 text-left transition active:bg-white/[0.06]",
                      fresh && "bg-blue-500/[0.07]",
                    )}
                  >
                    <span className="relative shrink-0">
                      {n.actor ? (
                        <Avatar person={n.actor} />
                      ) : (
                        <span className="grid h-11 w-11 place-items-center rounded-full bg-white/[0.07] ring-1 ring-white/10">
                          <Icon className={cn("h-5 w-5", visual.tint)} />
                        </span>
                      )}
                      {n.actor && (
                        <span
                          className={cn(
                            "absolute -bottom-0.5 -right-0.5 grid h-[18px] w-[18px] place-items-center rounded-full ring-2 ring-[#0a0a0a]",
                            visual.bg,
                          )}
                        >
                          <Icon className="h-2.5 w-2.5 text-white" strokeWidth={2.6} />
                        </span>
                      )}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] leading-snug text-white/90">
                        <span className="font-semibold text-white">{n.title}</span>{" "}
                        <span className="text-white/70">{n.body}</span>{" "}
                        <time className="whitespace-nowrap text-white/40" dateTime={n.createdAt} title={fullTime(n.createdAt)}>
                          · {timeAgo(n.createdAt)}
                        </time>
                      </span>
                    </span>

                    {fresh && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-500" aria-label="New" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <div ref={sentinel} />
      {loadingMore && <Spinner />}
    </div>
  );
}

// ── Your activity tab ───────────────────────────────────────────────────────

function YourActivityTab() {
  const router = useRouter();
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("all");

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/activity", { cache: "no-store" });
      if (!res.ok) {
        setItems([]);
        return;
      }
      const data = await res.json();
      setItems(data.items);
      setNextBefore(data.nextBefore);
      setBalance(data.creditBalance);
    })();
  }, []);

  const loadMore = useCallback(async () => {
    if (!nextBefore || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/activity?before=${encodeURIComponent(nextBefore)}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setItems((prev) => [...(prev ?? []), ...data.items]);
      setNextBefore(data.nextBefore);
    } finally {
      setLoadingMore(false);
    }
  }, [nextBefore, loadingMore]);

  const sentinel = useInfiniteSentinel(loadMore, Boolean(nextBefore));

  const visible = useMemo(() => {
    const kinds = ACTIVITY_FILTERS.find((f) => f.key === filter)?.kinds;
    return (items ?? []).filter((i) => !kinds || (kinds as readonly string[]).includes(i.kind));
  }, [items, filter]);

  const { earned, spent } = useMemo(() => {
    let e = 0;
    let s = 0;
    for (const i of items ?? []) {
      if (i.kind !== "credit" || i.amount == null) continue;
      if (i.amount > 0) e += i.amount;
      else s += -i.amount;
    }
    return { earned: e, spent: s };
  }, [items]);

  return (
    <div className="pb-6">
      {/* Wallet summary */}
      <section className="mx-4 mt-4 rounded-[20px] border border-white/10 bg-gradient-to-br from-[#10261d] to-[#0b1220] p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[12px] uppercase tracking-wide text-white/50">Credit balance</p>
            <p className="mt-0.5 text-[28px] font-bold leading-tight text-white">
              {balance == null ? "—" : balance.toLocaleString("en-IN")}
            </p>
          </div>
          <span className="grid h-12 w-12 place-items-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-400/30">
            <Wallet className="h-6 w-6 text-emerald-300" />
          </span>
        </div>
        <div className="mt-3 flex gap-2 text-[12px]">
          <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-emerald-300">
            +{earned.toLocaleString("en-IN")} in
          </span>
          <span className="rounded-full bg-red-500/15 px-2.5 py-1 text-red-300">
            −{spent.toLocaleString("en-IN")} out
          </span>
          <span className="ml-auto self-center text-white/40">loaded history</span>
        </div>
        <div className="mt-3 flex gap-2">
          <Link
            href="/spends"
            className="flex-1 rounded-full bg-white/10 py-2 text-center text-[13px] font-medium text-white active:bg-white/15"
          >
            Spends
          </Link>
        </div>
      </section>

      {/* Filters */}
      <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto px-4">
        {ACTIVITY_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition",
              filter === f.key ? "bg-white text-black" : "bg-white/[0.08] text-white/75 active:bg-white/15",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {!items ? (
        <ListSkeleton />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={History}
          title="Nothing here yet"
          text="Your posts, requests, responses, comments, likes, follows and every credit movement will show up on this timeline."
        />
      ) : (
        groupBy(visible, (i) => sectionOf(i.createdAt)).map(([section, rows]) => (
          <section key={section} className="mt-5">
            <h2 className="px-4 pb-1 text-[15px] font-semibold text-white">{section}</h2>
            <ol className="relative ml-[37px] border-l border-white/10">
              {rows.map((item) => {
                const v = ACTIVITY_VISUALS[item.kind];
                const Icon = v.icon;
                const positive = (item.amount ?? 0) > 0;
                return (
                  <li key={item.id} className="relative">
                    <button
                      type="button"
                      disabled={!item.url}
                      onClick={() => item.url && router.push(item.url)}
                      className="flex w-full items-start gap-3 py-2.5 pl-6 pr-4 text-left transition enabled:active:bg-white/[0.05]"
                    >
                      <span
                        className={cn(
                          "absolute -left-[17px] top-2.5 grid h-[34px] w-[34px] place-items-center rounded-full ring-4 ring-[#0a0a0a]",
                          v.bg,
                        )}
                      >
                        <Icon className={cn("h-4 w-4", v.tint)} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-medium leading-snug text-white">{item.title}</span>
                        {item.detail && (
                          <span className="mt-0.5 line-clamp-2 block text-[13px] leading-snug text-white/55">
                            {item.detail}
                          </span>
                        )}
                        <time className="mt-0.5 block text-[12px] text-white/35" dateTime={item.createdAt}>
                          {fullTime(item.createdAt)}
                        </time>
                      </span>
                      {item.amount != null && (
                        <span
                          className={cn(
                            "shrink-0 pt-0.5 text-[14px] font-semibold tabular-nums",
                            positive ? "text-emerald-400" : "text-red-400",
                          )}
                        >
                          {positive ? "+" : "−"}
                          {Math.abs(item.amount).toLocaleString("en-IN")}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        ))
      )}
      <div ref={sentinel} />
      {loadingMore && <Spinner />}
    </div>
  );
}

// ── Shared bits ─────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex justify-center py-4">
      <Loader2 className="h-5 w-5 animate-spin text-white/40" />
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="mt-4 space-y-1 px-4" aria-busy>
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-2.5">
          <div className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-white/[0.07]" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-3/4 animate-pulse rounded bg-white/[0.07]" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-white/[0.05]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="flex flex-col items-center px-10 pt-20 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-full border border-white/15">
        <Icon className="h-7 w-7 text-white/60" />
      </span>
      <p className="mt-4 text-[16px] font-semibold text-white">{title}</p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-white/50">{text}</p>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

function ActivityPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>(params.get("tab") === "you" ? "you" : "notifications");
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    fetch("/api/notifications/unread-count", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setUnread(d.unreadCount ?? 0))
      .catch(() => {});
  }, []);

  function switchTab(next: Tab) {
    setTab(next);
    router.replace(next === "you" ? "/activity?tab=you" : "/activity", { scroll: false });
  }

  return (
    <main className="min-h-dvh bg-black">
      <div className="relative mx-auto min-h-dvh w-full max-w-[430px] bg-[#0a0a0a] pb-10 text-white antialiased">
        <header className="sticky top-0 z-20 bg-[#0a0a0a]/90 backdrop-blur-xl">
          <div className="flex items-center gap-2 px-2 pt-[max(env(safe-area-inset-top),0.75rem)]">
            <button
              type="button"
              onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
              aria-label="Back"
              className="grid h-10 w-10 place-items-center rounded-full active:bg-white/10"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <h1 className="flex-1 text-[22px] font-bold">Activity</h1>
            {tab === "notifications" && (
              <button
                type="button"
                onClick={async () => {
                  await fetch("/api/notifications/read", { method: "POST" }).catch(() => {});
                  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_READ_EVENT));
                  setUnread(0);
                }}
                aria-label="Mark all as read"
                className="grid h-10 w-10 place-items-center rounded-full text-white/70 active:bg-white/10"
              >
                <CheckCheck className="h-5 w-5" />
              </button>
            )}
            <Link
              href="/profile/edit"
              aria-label="Notification settings"
              className="grid h-10 w-10 place-items-center rounded-full text-white/70 active:bg-white/10"
            >
              <Settings2 className="h-5 w-5" />
            </Link>
          </div>

          <div role="tablist" className="mt-2 flex border-b border-white/10">
            {(
              [
                { key: "notifications", label: "Notifications" },
                { key: "you", label: "Your activity" },
              ] as const
            ).map((t) => (
              <button
                key={t.key}
                role="tab"
                type="button"
                aria-selected={tab === t.key}
                onClick={() => switchTab(t.key)}
                className={cn(
                  "relative flex flex-1 items-center justify-center gap-1.5 py-3 text-[14px] font-semibold transition",
                  tab === t.key ? "text-white" : "text-white/45",
                )}
              >
                {t.label}
                {t.key === "notifications" && unread > 0 && (
                  <span className="rounded-full bg-blue-500 px-1.5 text-[11px] font-semibold leading-[18px] text-white">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
                {tab === t.key && <span className="absolute inset-x-8 bottom-0 h-[2px] rounded-full bg-white" />}
              </button>
            ))}
          </div>
        </header>

        {tab === "notifications" ? <NotificationsTab onUnreadChange={setUnread} /> : <YourActivityTab />}
      </div>
    </main>
  );
}

export default function ActivityPage() {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-black" />}>
      <ActivityPageInner />
    </Suspense>
  );
}
