"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, LayoutGrid, Loader2, Megaphone, MessageCircle, Newspaper, Search, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/time";
import { CATEGORIES_DATA } from "@/lib/categories";

type ResultType = "all" | "people" | "demands" | "communities" | "posts" | "messages";

interface Results {
  people: Array<{
    id: string;
    name: string;
    avatarUrl: string | null;
    companyName: string | null;
    role: string;
    /** The matched service this person provides, when found through a category or tag. */
    offers: string | null;
  }>;
  demands: Array<{ id: string; summary: string; budgetMin: number | null; budgetMax: number | null; currency: string }>;
  communities: Array<{ id: string; name: string; slug: string; coverImage: string | null }>;
  posts: Array<{ id: string; text: string; createdAt: string; sender: { name: string } }>;
  messages: Array<{ id: string; text: string; createdAt: string; conversationId: string }>;
  categories: Array<{ id: string; label: string; href: string }>;
}

const EMPTY: Results = { people: [], demands: [], communities: [], posts: [], messages: [], categories: [] };

const TABS: Array<{ key: ResultType; label: string }> = [
  { key: "all", label: "All" },
  { key: "people", label: "People" },
  { key: "demands", label: "Requests" },
  { key: "communities", label: "Communities" },
  { key: "posts", label: "Posts" },
  { key: "messages", label: "My Chats" },
];

const ROW = "flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors active:bg-white/[0.06] hover:bg-white/[0.04]";

/**
 * Type tabs, category chips and result lists for a search query (shared by
 * /search and the search drawer). `onNavigate` runs when a result is tapped,
 * so a drawer can close itself.
 */
export function SearchResults({ q, onNavigate }: { q: string; onNavigate?: () => void }) {
  const [type, setType] = useState<ResultType>("all");
  const [category, setCategory] = useState<string | null>(null);
  const [results, setResults] = useState<Results>(EMPTY);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!q.trim() && !category) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const url = new URL("/api/search", window.location.origin);
        if (q.trim()) url.searchParams.set("q", q.trim());
        url.searchParams.set("type", type);
        if (category) url.searchParams.set("category", category);
        const res = await fetch(url.toString(), { signal: controller.signal });
        setResults(res.ok ? await res.json() : EMPTY);
        setLoading(false);
      } catch {
        // Aborted by a newer query: that one owns the loading state now.
      }
    }, 300);
    return () => {
      clearTimeout(handle);
      controller.abort();
    };
  }, [q, type, category]);

  const showPeople = type === "all" || type === "people";
  const showDemands = type === "all" || type === "demands";
  const showCommunities = type === "all" || type === "communities";
  const showPosts = type === "all" || type === "posts";
  const showMessages = type === "all" || type === "messages";
  const hasAnyResults =
    results.people.length +
      results.demands.length +
      results.communities.length +
      results.posts.length +
      results.messages.length +
      results.categories.length >
    0;
  const searching = Boolean(q.trim() || category);

  return (
    <div className="pb-4">
      {/* Type tabs */}
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-4 pb-2 pt-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setType(t.key)}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors",
              type === t.key ? "bg-white text-black" : "bg-white/[0.07] text-neutral-400 active:bg-white/[0.12]",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Category filter chips */}
      {(type === "all" || type === "people" || type === "demands") && (
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-4 pb-2">
          {CATEGORIES_DATA.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategory(category === cat.id ? null : cat.id)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 text-[12px] font-medium transition-colors",
                category === cat.id
                  ? "border-[#0A84FF]/60 bg-[#0A84FF]/15 text-[#5AB0FF]"
                  : "border-white/[0.08] text-neutral-500",
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      <div className="mx-4 mt-1 border-t border-white/[0.06]" />

      {loading && (
        <div className="flex justify-center py-12 text-neutral-500">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {!loading && !searching && (
        <EmptyState
          icon={<Search className="h-6 w-6" />}
          title="Find the right person"
          body="Search people, requests, offers and communities."
        />
      )}

      {!loading && searching && !hasAnyResults && (
        <EmptyState icon={<Search className="h-6 w-6" />} title="No results" body="Try a different word or category." />
      )}

      {!loading && type === "all" && results.categories.length > 0 && (
        <Section title="Related categories">
          {results.categories.map((c) => (
            <Link key={c.id} href={c.href} onClick={onNavigate} className={ROW}>
              <Thumb>
                <LayoutGrid className="h-4 w-4" />
              </Thumb>
              <span className="min-w-0 flex-1 truncate text-[14px] text-neutral-100">{c.label}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-neutral-600" />
            </Link>
          ))}
        </Section>
      )}

      {!loading && showPeople && results.people.length > 0 && (
        <Section title="People">
          {results.people.map((p) => (
            <Link key={p.id} href={`/u/${p.id}`} onClick={onNavigate} className={ROW}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.avatarUrl ?? "/icons/avatar-placeholder.svg"}
                alt={p.name}
                className="h-10 w-10 shrink-0 rounded-full bg-neutral-800 object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-neutral-100">{p.companyName ?? p.name}</p>
                <p className="truncate text-[12px] text-neutral-500">{p.offers ?? p.role}</p>
              </div>
            </Link>
          ))}
        </Section>
      )}

      {!loading && showDemands && results.demands.length > 0 && (
        <Section title="Requests">
          {results.demands.map((d) => (
            <Link key={d.id} href={`/demands/${d.id}`} onClick={onNavigate} className={ROW}>
              <Thumb>
                <Megaphone className="h-4 w-4" />
              </Thumb>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-[14px] text-neutral-100">{d.summary}</p>
                {(d.budgetMin || d.budgetMax) && (
                  <p className="text-[12px] text-neutral-500">
                    {d.currency} {d.budgetMin ?? "?"}–{d.budgetMax ?? "?"}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </Section>
      )}

      {!loading && showCommunities && results.communities.length > 0 && (
        <Section title="Communities">
          {results.communities.map((c) => (
            <Link key={c.id} href={`/communities/${c.id}`} onClick={onNavigate} className={ROW}>
              {c.coverImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.coverImage} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
              ) : (
                <Thumb round>
                  <Users className="h-4 w-4" />
                </Thumb>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-neutral-100">{c.name}</p>
                <p className="truncate text-[12px] text-neutral-500">@{c.slug}</p>
              </div>
            </Link>
          ))}
        </Section>
      )}

      {!loading && showPosts && results.posts.length > 0 && (
        <Section title="Posts">
          {results.posts.map((p) => (
            <Link key={p.id} href={`/forum/${p.id}`} onClick={onNavigate} className={ROW}>
              <Thumb>
                <Newspaper className="h-4 w-4" />
              </Thumb>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-[14px] text-neutral-100">{p.text}</p>
                <p className="text-[12px] text-neutral-500">
                  {p.sender.name} · {timeAgo(p.createdAt)}
                </p>
              </div>
            </Link>
          ))}
        </Section>
      )}

      {!loading && showMessages && results.messages.length > 0 && (
        <Section title="My Chats">
          {results.messages.map((m) => (
            <Link key={m.id} href={`/chats/${m.conversationId}`} onClick={onNavigate} className={ROW}>
              <Thumb>
                <MessageCircle className="h-4 w-4" />
              </Thumb>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-[14px] text-neutral-100">{m.text}</p>
                <p className="text-[12px] text-neutral-500">{timeAgo(m.createdAt)}</p>
              </div>
            </Link>
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="px-2 pt-4">
      <h2 className="mb-1 px-2 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-neutral-500">{title}</h2>
      {children}
    </section>
  );
}

function Thumb({ children, round }: { children: ReactNode; round?: boolean }) {
  return (
    <span
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center bg-white/[0.07] text-neutral-400",
        round ? "rounded-full" : "rounded-xl",
      )}
    >
      {children}
    </span>
  );
}

function EmptyState({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center px-8 py-14 text-center">
      <span className="mb-3 grid h-14 w-14 place-items-center rounded-full bg-white/[0.06] text-neutral-500">{icon}</span>
      <p className="text-[15px] font-semibold text-neutral-200">{title}</p>
      <p className="mt-1 text-[13px] text-neutral-500">{body}</p>
    </div>
  );
}
