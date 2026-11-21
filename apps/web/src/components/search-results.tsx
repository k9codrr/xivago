"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Loader2, Users, MessageCircle } from "lucide-react";
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

/** Type tabs, category chips and result lists for a search query (shared by /search and inline search bars). */
export function SearchResults({ q }: { q: string }) {
  const [type, setType] = useState<ResultType>("all");
  const [category, setCategory] = useState<string | null>(null);
  const [results, setResults] = useState<Results>(EMPTY);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!q.trim() && !category) {
      setResults(EMPTY);
      return;
    }
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const url = new URL("/api/search", window.location.origin);
        if (q.trim()) url.searchParams.set("q", q.trim());
        url.searchParams.set("type", type);
        if (category) url.searchParams.set("category", category);
        const res = await fetch(url.toString());
        setResults(res.ok ? await res.json() : EMPTY);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(handle);
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

  return (
    <>
      <div className="flex gap-2 overflow-x-auto px-4 py-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setType(t.key)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold",
              type === t.key ? "bg-white text-black" : "bg-neutral-900 text-neutral-400",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {(type === "all" || type === "people" || type === "demands") && (
        <div className="flex gap-2 overflow-x-auto px-4 py-1">
          {CATEGORIES_DATA.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategory(category === cat.id ? null : cat.id)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 text-xs font-medium",
                category === cat.id
                  ? "border-brand-500 bg-brand-500/10 text-brand-400"
                  : "border-neutral-800 text-neutral-500",
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-10 text-neutral-500">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {!loading && !q.trim() && !category && (
        <p className="px-4 py-12 text-center text-sm text-neutral-500">Find the right person. Search people, requests, offers and communities.</p>
      )}

      {!loading && (q.trim() || category) && !hasAnyResults && (
        <p className="px-4 py-12 text-center text-sm text-neutral-500">No results found.</p>
      )}

      {!loading && type === "all" && results.categories.length > 0 && (
        <section className="px-4 py-2">
          <h2 className="mb-1 text-xs font-semibold uppercase text-neutral-500">Related categories</h2>
          {results.categories.map((c) => (
            <Link key={c.id} href={c.href} className="flex items-center justify-between gap-3 py-2 text-sm text-neutral-100">
              {c.label}
              <ChevronRight className="h-4 w-4 shrink-0 text-neutral-500" />
            </Link>
          ))}
        </section>
      )}

      {!loading && showPeople && results.people.length > 0 && (
        <section className="px-4 py-2">
          <h2 className="mb-1 text-xs font-semibold uppercase text-neutral-500">People</h2>
          {results.people.map((p) => (
            <Link key={p.id} href={`/u/${p.id}`} className="flex items-center gap-3 py-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.avatarUrl ?? "/icons/avatar-placeholder.svg"} alt={p.name} className="h-10 w-10 rounded-full bg-neutral-800 object-cover" />
              <div>
                <p className="text-sm font-semibold text-neutral-100">{p.companyName ?? p.name}</p>
                <p className="text-xs text-neutral-500">{p.offers ?? p.role}</p>
              </div>
            </Link>
          ))}
        </section>
      )}

      {!loading && showDemands && results.demands.length > 0 && (
        <section className="px-4 py-2">
          <h2 className="mb-1 text-xs font-semibold uppercase text-neutral-500">Requests</h2>
          {results.demands.map((d) => (
            <Link key={d.id} href={`/demands/${d.id}`} className="block py-2">
              <p className="text-sm text-neutral-100">{d.summary}</p>
              {(d.budgetMin || d.budgetMax) && (
                <p className="text-xs text-neutral-500">
                  {d.currency} {d.budgetMin ?? "?"}–{d.budgetMax ?? "?"}
                </p>
              )}
            </Link>
          ))}
        </section>
      )}

      {!loading && showCommunities && results.communities.length > 0 && (
        <section className="px-4 py-2">
          <h2 className="mb-1 text-xs font-semibold uppercase text-neutral-500">Communities</h2>
          {results.communities.map((c) => (
            <Link key={c.id} href={`/communities/${c.id}`} className="flex items-center gap-3 py-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-800 text-neutral-400">
                <Users className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-neutral-100">{c.name}</p>
                <p className="text-xs text-neutral-500">@{c.slug}</p>
              </div>
            </Link>
          ))}
        </section>
      )}

      {!loading && showPosts && results.posts.length > 0 && (
        <section className="px-4 py-2">
          <h2 className="mb-1 text-xs font-semibold uppercase text-neutral-500">Posts</h2>
          {results.posts.map((p) => (
            <Link key={p.id} href={`/forum/${p.id}`} className="block py-2">
              <p className="text-sm text-neutral-100">{p.text}</p>
              <p className="text-xs text-neutral-500">{p.sender.name} · {timeAgo(p.createdAt)}</p>
            </Link>
          ))}
        </section>
      )}

      {!loading && showMessages && results.messages.length > 0 && (
        <section className="px-4 py-2">
          <h2 className="mb-1 text-xs font-semibold uppercase text-neutral-500">My Chats</h2>
          {results.messages.map((m) => (
            <Link key={m.id} href={`/chats/${m.conversationId}`} className="flex items-start gap-2 py-2">
              <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" />
              <div>
                <p className="text-sm text-neutral-100">{m.text}</p>
                <p className="text-xs text-neutral-500">{timeAgo(m.createdAt)}</p>
              </div>
            </Link>
          ))}
        </section>
      )}
    </>
  );
}
