"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
// import { LayoutList, Newspaper } from "lucide-react";
import { Loader2 } from "lucide-react";
import { ForumComposer } from "@/components/forum/forum-composer";
import { ForumFilterMenu, type ForumSort } from "@/components/forum/forum-filter-menu";
import { ForumPostCard } from "@/components/forum/forum-post-card";
import type { ForumPost } from "@/components/forum/types";
import { AppHeader } from "@/components/app-header";
import { CommunityList, type CommunityLayout } from "@/components/community-list";
import { cn } from "@/lib/utils";
import { useGeolocation } from "@/lib/use-geolocation";
import { NearbyForYou } from "@/components/nearby-for-you";
import { ScrollToTop } from "@/components/scroll-to-top";

interface FeedPage {
  posts: ForumPost[];
  nextCursor: string | null;
}

interface FeedFilters {
  tab: ForumTab;
  sort: ForumSort;
  near: { lat: number; lng: number } | null;
}

type ForumTab = "threads" | "communities";

const TABS: { id: ForumTab; label: string }[] = [
  { id: "threads", label: "Feed" },
  { id: "communities", label: "Communities" },
];

async function fetchFeedPage(cursor: string | null, filters: FeedFilters): Promise<FeedPage> {
  const url = new URL("/api/forum", window.location.origin);
  if (cursor) url.searchParams.set("cursor", cursor);
  url.searchParams.set("sort", filters.sort);
  if (filters.tab === "communities") url.searchParams.set("scope", "joined");
  if (filters.near) {
    url.searchParams.set("lat", String(filters.near.lat));
    url.searchParams.set("lng", String(filters.near.lng));
  }
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Could not load the feed");
  return res.json();
}

// useSearchParams needs a Suspense boundary so the page can still prerender.
export default function ForumPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16 text-neutral-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      }
    >
      <Forum />
    </Suspense>
  );
}

function Forum() {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [isPro, setIsPro] = useState(false);
  const [me, setMe] = useState<{ name: string | null; avatarUrl: string | null } | null>(null);
  const [localPosts, setLocalPosts] = useState<ForumPost[]>([]);
  const [sort, setSort] = useState<ForumSort>("new");
  const [near, setNear] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const { requestLocation } = useGeolocation();

  // Kept in the URL so coming back from a thread lands on the same tab and view.
  const tab: ForumTab = searchParams.get("tab") === "communities" ? "communities" : "threads";
  // Communities tab now lists every community (list or card layout) instead of a feed of posts
  // from joined communities. The old posts/list toggle is kept below, commented out.
  // const showingList = tab === "communities" && searchParams.get("view") === "list";
  const communityLayout: CommunityLayout = searchParams.get("layout") === "card" ? "card" : "list";

  // function goTo(nextTab: ForumTab, list = false) {
  //   const params = new URLSearchParams();
  //   if (nextTab === "communities") params.set("tab", "communities");
  //   if (list) params.set("view", "list");
  //   const qs = params.toString();
  //   router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  // }
  function goTo(nextTab: ForumTab, layout: CommunityLayout = communityLayout) {
    const params = new URLSearchParams();
    if (nextTab === "communities") {
      params.set("tab", "communities");
      if (layout === "card") params.set("layout", "card");
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  async function toggleNearMe() {
    if (near) {
      setNear(null);
      return;
    }
    if (locating) return;
    setLocating(true);
    // Remembered once allowed -- no prompt, no wait on later visits.
    const coords = await requestLocation();
    setLocating(false);
    if (coords) setNear(coords);
    else toast.error("Allow location access to see posts near you.");
  }

  useEffect(() => {
    if (!session?.user) return;
    (async () => {
      const res = await fetch("/api/users/me");
      if (res.ok) {
        const { profile } = await res.json();
        setMe({ name: profile.name ?? null, avatarUrl: profile.avatarUrl ?? null });
        setIsPro(profile.subscription?.plan === "PRO" && profile.subscription.status === "ACTIVE");
      }
    })();
  }, [session?.user]);

  const feedKey = ["forum-feed", tab, sort, near];
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: feedKey,
    queryFn: ({ pageParam }) => fetchFeedPage(pageParam, { tab, sort, near }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    // enabled: !showingList,
    enabled: tab === "threads",
  });

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) void fetchNextPage();
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, tab]);

  const fetchedPosts = data?.pages.flatMap((p) => p.posts) ?? [];
  // Just-posted items stay on top of Threads, where they were posted, until the refetched feed includes them.
  const fetchedIds = new Set(fetchedPosts.map((p) => p.id));
  const posts = [...(tab === "threads" ? localPosts.filter((p) => !fetchedIds.has(p.id)) : []), ...fetchedPosts];

  function updatePost(postId: string, updater: (post: ForumPost) => ForumPost) {
    setLocalPosts((prev) => prev.map((p) => (p.id === postId ? updater(p) : p)));
    queryClient.setQueryData<{ pages: FeedPage[]; pageParams: unknown[] }>(feedKey, (old) => {
      if (!old) return old;
      return {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          posts: page.posts.map((p) => (p.id === postId ? updater(p) : p)),
        })),
      };
    });
  }

  function removePost(postId: string) {
    setLocalPosts((prev) => prev.filter((p) => p.id !== postId));
    queryClient.setQueryData<{ pages: FeedPage[]; pageParams: unknown[] }>(feedKey, (old) => {
      if (!old) return old;
      return { ...old, pages: old.pages.map((page) => ({ ...page, posts: page.posts.filter((p) => p.id !== postId) })) };
    });
  }

  return (
    <main className="min-h-screen pb-16">
      <ScrollToTop path="/forum" />
      <header className="relative z-50 mb-2 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-2">
        <AppHeader
          user={{
            name: me?.name ?? session?.user?.name ?? "",
            handle: (me?.name ?? session?.user?.name ?? "user").toLowerCase().replace(/\s+/g, ""),
            avatarUrl: me?.avatarUrl ?? session?.user?.image ?? null,
            followingCount: 0,
            followerCount: 0,
            isPro,
          }}
        />
      </header>

      <div role="tablist" aria-label="Feed" className="grid grid-cols-2 border-b border-neutral-200 dark:border-neutral-800">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => goTo(id)}
            className={cn(
              "-mb-px border-b-2 py-2.5 text-sm font-semibold transition-colors",
              tab === id
                ? "border-neutral-900 text-neutral-900 dark:border-neutral-100 dark:text-neutral-100"
                : "border-transparent text-neutral-400",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "threads" &&
        (session?.user ? (
          <ForumComposer variant="drawer" isPro={isPro} onPosted={(post) => {
            setLocalPosts((prev) => [post, ...prev]);
            // Local state is gone once they open a thread and come back, so the cached feed must know too.
            void queryClient.invalidateQueries({ queryKey: ["forum-feed"] });
          }} />
        ) : (
          <div className="border-b border-neutral-200 px-4 py-4 text-center text-sm text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
            Log in to join the conversation.
          </div>
        ))}

      {tab === "communities" ? (
        <div className="px-4 pt-3">
          <CommunityList
            layout={communityLayout}
            onLayoutChange={(layout) => goTo("communities", layout)}
            onMembershipChange={() => void queryClient.invalidateQueries({ queryKey: ["forum-feed", "communities"] })}
          />
        </div>
      ) : (
        <>
          {!near && <NearbyForYou className="border-b border-neutral-200 dark:border-neutral-800" />}

          <div className="flex items-center justify-between gap-2 border-b border-neutral-100 px-4 py-2 dark:border-neutral-800/70">
            <ForumFilterMenu
              sort={sort}
              nearMe={Boolean(near)}
              locating={locating}
              onSortChange={setSort}
              onNearMeToggle={() => void toggleNearMe()}
            />
          </div>

          {isLoading && (
            <div className="flex justify-center py-10 text-neutral-400">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}

          {!isLoading && posts.length === 0 && (
            <div className="px-4 py-12 text-center text-sm text-neutral-500 dark:text-neutral-400">
              {near ? <p>No posts near you yet.</p> : <p>No posts yet. Be the first to share something.</p>}
            </div>
          )}

          {/* Hairline-separated feed — no cards */}
          <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {posts.map((post) => (
              <ForumPostCard key={post.id} post={post} onUpdate={updatePost} onRemove={removePost} />
            ))}
            <div ref={sentinelRef} className="flex justify-center py-4">
              {isFetchingNextPage && <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />}
            </div>
          </div>
        </>
      )}

      {/*
        Previous Communities tab: a feed of posts from joined communities, with a
        "List view" toggle to browse all communities. Replaced by the list above.

              <div className="flex items-center justify-between gap-2 border-b border-neutral-100 px-4 py-2 dark:border-neutral-800/70">
                {showingList ? (
                  <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">All communities</p>
                ) : (
                  <ForumFilterMenu
                    sort={sort}
                    nearMe={Boolean(near)}
                    locating={locating}
                    onSortChange={setSort}
                    onNearMeToggle={toggleNearMe}
                  />
                )}
                {tab === "communities" && (
                  <button
                    type="button"
                    onClick={() => goTo("communities", !showingList)}
                    className="flex items-center gap-1.5 rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-700 dark:border-neutral-700 dark:text-neutral-200"
                  >
                    {showingList ? <Newspaper className="h-3.5 w-3.5" /> : <LayoutList className="h-3.5 w-3.5" />}
                    {showingList ? "Posts" : "List view"}
                  </button>
                )}
              </div>

              {showingList ? (
                <div className="px-4 pt-3">
                  <CommunityList onMembershipChange={() => void queryClient.invalidateQueries({ queryKey: ["forum-feed", "communities"] })} />
                </div>
              ) : (
                <>
                  {isLoading && (
                    <div className="flex justify-center py-10 text-neutral-400">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  )}

                  {!isLoading && posts.length === 0 && (
                    <div className="px-4 py-12 text-center text-sm text-neutral-500 dark:text-neutral-400">
                      {near ? (
                        <p>No posts near you yet.</p>
                      ) : tab === "threads" ? (
                        <p>No posts yet. Be the first to share something.</p>
                      ) : (
                        <>
                          <p>No posts from your communities yet.</p>
                          <button type="button" onClick={() => goTo("communities", true)} className="mt-2 font-semibold text-brand-600">
                            Browse all communities
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {/ * Hairline-separated feed — no cards * /}
                  <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {posts.map((post) => (
                      <ForumPostCard key={post.id} post={post} onUpdate={updatePost} onRemove={removePost} />
                    ))}
                    <div ref={sentinelRef} className="flex justify-center py-4">
                      {isFetchingNextPage && <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />}
                    </div>
                  </div>
                </>
              )}
      */}
    </main>
  );
}
