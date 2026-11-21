"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutGrid, List, Loader2, Search, Users } from "lucide-react";
import { CommunityJoinButton } from "@/components/community-join-button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface CommunitySummary {
  id: string;
  name: string;
  description: string | null;
  coverImage: string | null;
  memberCount: number;
  postCount: number;
  isMember: boolean;
}

export interface CommunityPage {
  communities: CommunitySummary[];
  nextCursor: string | null;
}

export type CommunityLayout = "list" | "card";

export async function fetchCommunityPage(query: string, cursor: string | null): Promise<CommunityPage> {
  const url = new URL("/api/communities", window.location.origin);
  if (query) url.searchParams.set("q", query);
  if (cursor) url.searchParams.set("cursor", cursor);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Failed to load communities");
  return res.json();
}

/** Seeded communities share a boilerplate description ("X: a community for <topic> on Xivago (<category>).");
 * show just the topic for those, and real descriptions as written. */
function communityBlurb(description: string | null) {
  if (!description) return null;
  const m = description.match(/a community for (.+) on Xivago \((.+)\)\.$/);
  return m ? m[1]! : description;
}

/** Unsplash covers can be resized by URL, so thumbnails don't download the full 1200px image. */
function coverSrc(url: string, width: number) {
  if (!url.startsWith("https://images.unsplash.com/")) return url;
  const u = new URL(url);
  u.searchParams.set("w", String(width));
  return u.toString();
}

function formatCount(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "")}k` : String(n);
}

interface CommunityListProps {
  onMembershipChange?: () => void;
  /** Controlled layout; leave unset to let the list manage it. */
  layout?: CommunityLayout;
  onLayoutChange?: (layout: CommunityLayout) => void;
}

/** Every community, searchable, as a list or a card grid. More load by themselves as the end nears. */
export function CommunityList({ onMembershipChange, layout: layoutProp, onLayoutChange }: CommunityListProps) {
  const queryClient = useQueryClient();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [ownLayout, setOwnLayout] = useState<CommunityLayout>("list");
  const layout = layoutProp ?? ownLayout;

  function changeLayout(next: CommunityLayout) {
    setOwnLayout(next);
    onLayoutChange?.(next);
  }

  useEffect(() => {
    const timer = setTimeout(() => setQuery(q.trim()), 300);
    return () => clearTimeout(timer);
  }, [q]);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } = useInfiniteQuery({
    queryKey: ["communities-list", query],
    queryFn: ({ pageParam }) => fetchCommunityPage(query, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) void fetchNextPage();
      },
      { rootMargin: "400px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const communities = data?.pages.flatMap((p) => p.communities) ?? [];

  function handleMembershipChange() {
    // Marks the list stale for the next visit, without reshuffling it under the user's finger.
    void queryClient.invalidateQueries({ queryKey: ["communities-list"], refetchType: "none" });
    onMembershipChange?.();
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search communities…"
            aria-label="Search communities"
            className="rounded-full pl-9 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          />
        </div>
        <div
          role="radiogroup"
          aria-label="Layout"
          className="flex shrink-0 rounded-full border border-neutral-200 p-0.5 dark:border-neutral-700"
        >
          {(
            [
              { id: "list", label: "List view", Icon: List },
              { id: "card", label: "Card view", Icon: LayoutGrid },
            ] as const
          ).map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={layout === id}
              aria-label={label}
              onClick={() => changeLayout(id)}
              className={cn(
                "grid h-8 w-8 place-items-center rounded-full transition-colors",
                layout === id
                  ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                  : "text-neutral-500 dark:text-neutral-400",
              )}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>

      {isLoading && (layout === "card" ? <CardSkeletons /> : <ListSkeletons />)}

      {!isLoading && communities.length === 0 && (
        <p className="py-10 text-center text-sm text-neutral-500 dark:text-neutral-400">
          {isError ? "Could not load communities." : query ? `No communities match “${query}”.` : "No communities yet."}
        </p>
      )}

      {layout === "card" ? (
        <ul className="grid grid-cols-2 gap-3">
          {communities.map((c) => (
            <li key={c.id}>
              <CommunityCard community={c} onMembershipChange={handleMembershipChange} />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {communities.map((c) => (
            <li key={c.id}>
              <CommunityRow community={c} onMembershipChange={handleMembershipChange} />
            </li>
          ))}
        </ul>
      )}

      <div ref={sentinelRef} className="flex justify-center py-4">
        {isFetchingNextPage && <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />}
      </div>
    </div>
  );
}

/* ---------- Layouts ---------- */

interface ItemProps {
  community: CommunitySummary;
  onMembershipChange: () => void;
}

function Cover({ src, width, className }: { src: string | null; width: number; className?: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={coverSrc(src, width)} alt="" loading="lazy" decoding="async" className={cn("object-cover", className)} />
  ) : (
    <span className={cn("grid place-items-center bg-gradient-to-br from-brand-400 to-brand-700", className)}>
      <Users className="h-1/3 w-1/3 text-white/80" />
    </span>
  );
}

function Stats({ c, className }: { c: CommunitySummary; className?: string }) {
  return (
    <span className={cn("flex items-center gap-1 text-xs text-neutral-400", className)}>
      <Users className="h-3 w-3" />
      {formatCount(c.memberCount)} {c.memberCount === 1 ? "member" : "members"}
      <span aria-hidden>·</span>
      {formatCount(c.postCount)} {c.postCount === 1 ? "post" : "posts"}
    </span>
  );
}

function CommunityRow({ community: c, onMembershipChange }: ItemProps) {
  const blurb = communityBlurb(c.description);
  return (
    <div className="flex items-center gap-3 py-3">
      <Link href={`/communities/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <Cover src={c.coverImage} width={160} className="h-14 w-14 shrink-0 rounded-2xl" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold dark:text-neutral-100">{c.name}</span>
          {blurb && <span className="block truncate text-xs text-neutral-500 dark:text-neutral-400">{blurb}</span>}
          <Stats c={c} className="mt-0.5" />
        </span>
      </Link>
      <CommunityJoinButton communityId={c.id} initialMember={c.isMember} onChange={onMembershipChange} />
    </div>
  );
}

function CommunityCard({ community: c, onMembershipChange }: ItemProps) {
  const blurb = communityBlurb(c.description);
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <Link href={`/communities/${c.id}`} className="flex flex-1 flex-col">
        <span className="relative block aspect-[4/3] w-full">
          <Cover src={c.coverImage} width={480} className="absolute inset-0 h-full w-full" />
          <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent" />
          <span className="absolute bottom-2 left-2 right-2 line-clamp-2 text-sm font-semibold leading-tight text-white">
            {c.name}
          </span>
        </span>
        <span className="flex flex-1 flex-col gap-1 px-2.5 pt-2">
          {blurb && <span className="line-clamp-2 text-xs text-neutral-500 dark:text-neutral-400">{blurb}</span>}
          <Stats c={c} className="mt-auto" />
        </span>
      </Link>
      <div className="p-2.5 pt-2 [&_button]:w-full">
        <CommunityJoinButton communityId={c.id} initialMember={c.isMember} onChange={onMembershipChange} />
      </div>
    </div>
  );
}

/* ---------- Loading placeholders ---------- */

function ListSkeletons() {
  return (
    <ul className="divide-y divide-neutral-200 dark:divide-neutral-800" aria-hidden>
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i} className="flex items-center gap-3 py-3">
          <span className="h-14 w-14 shrink-0 animate-pulse rounded-2xl bg-neutral-200 dark:bg-neutral-800" />
          <span className="flex-1 space-y-2">
            <span className="block h-3 w-2/3 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
            <span className="block h-2.5 w-1/2 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
          </span>
        </li>
      ))}
    </ul>
  );
}

function CardSkeletons() {
  return (
    <ul className="grid grid-cols-2 gap-3" aria-hidden>
      {Array.from({ length: 4 }, (_, i) => (
        <li key={i} className="overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800">
          <span className="block aspect-[4/3] animate-pulse bg-neutral-200 dark:bg-neutral-800" />
          <span className="block space-y-2 p-2.5">
            <span className="block h-2.5 w-3/4 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
            <span className="block h-7 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-800" />
          </span>
        </li>
      ))}
    </ul>
  );
}
