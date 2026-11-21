"use client";

import { use as usePromise, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Loader2, Users } from "lucide-react";
import { CommunityJoinButton } from "@/components/community-join-button";
import { ForumComposer } from "@/components/forum/forum-composer";
import { ForumPostCard } from "@/components/forum/forum-post-card";
import type { ForumPost } from "@/components/forum/types";

interface CommunityDetail {
  id: string;
  name: string;
  description: string | null;
  coverImage: string | null;
  memberCount: number;
  postCount: number;
  isMember: boolean;
  isCreator: boolean;
  creator: { id: string; name: string };
}

interface FeedPage {
  posts: ForumPost[];
  nextCursor: string | null;
}

export default function CommunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [community, setCommunity] = useState<CommunityDetail | null | undefined>(undefined);
  const [localPosts, setLocalPosts] = useState<ForumPost[]>([]);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/communities/${id}`);
      setCommunity(res.ok ? (await res.json()).community : null);
    })();
  }, [id]);

  const queryKey = ["community-feed", id];
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam }): Promise<FeedPage> => {
      const url = new URL("/api/forum", window.location.origin);
      url.searchParams.set("communityId", id);
      if (pageParam) url.searchParams.set("cursor", pageParam);
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Failed to load posts");
      return res.json();
    },
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
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  function updatePost(postId: string, updater: (post: ForumPost) => ForumPost) {
    setLocalPosts((prev) => prev.map((p) => (p.id === postId ? updater(p) : p)));
    queryClient.setQueryData<{ pages: FeedPage[]; pageParams: unknown[] }>(queryKey, (old) =>
      old
        ? { ...old, pages: old.pages.map((pg) => ({ ...pg, posts: pg.posts.map((p) => (p.id === postId ? updater(p) : p)) })) }
        : old,
    );
  }

  function removePost(postId: string) {
    setLocalPosts((prev) => prev.filter((p) => p.id !== postId));
    queryClient.setQueryData<{ pages: FeedPage[]; pageParams: unknown[] }>(queryKey, (old) =>
      old ? { ...old, pages: old.pages.map((pg) => ({ ...pg, posts: pg.posts.filter((p) => p.id !== postId) })) } : old,
    );
  }

  if (community === undefined) {
    return (
      <div className="flex justify-center py-16 text-neutral-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (community === null) {
    return (
      <main className="px-4 pt-[max(env(safe-area-inset-top),1.5rem)]">
        <p className="card-shell p-8 text-center text-sm text-neutral-500">This community doesn&apos;t exist.</p>
      </main>
    );
  }

  const posts = [...localPosts, ...(data?.pages.flatMap((p) => p.posts) ?? [])];

  return (
    <main>
      <div className="relative">
        {community.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={community.coverImage} alt="" className="h-32 w-full object-cover" />
        ) : (
          <div className="h-32 w-full bg-gradient-to-br from-brand-400 to-brand-700" />
        )}
        <Link
          href="/communities"
          aria-label="Back"
          className="absolute left-3 top-[max(env(safe-area-inset-top),0.75rem)] rounded-full bg-black/40 p-1.5 text-white"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
      </div>

      <div className="px-4 pt-4">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold dark:text-neutral-100">{community.name}</h1>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-neutral-400">
              <Users className="h-3 w-3" /> {community.memberCount}{" "}
              {community.memberCount === 1 ? "member" : "members"} · by{" "}
              <Link href={`/u/${community.creator.id}`} className="font-medium text-brand-600">
                {community.creator.name}
              </Link>
            </p>
          </div>
          <CommunityJoinButton
            communityId={community.id}
            initialMember={community.isMember}
            isCreator={community.isCreator}
            onChange={(member) => setCommunity((c) => (c ? { ...c, isMember: member } : c))}
          />
        </div>

        {community.description && (
          <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-300">{community.description}</p>
        )}

        {session?.user ? (
          <ForumComposer
            isPro={false}
            communityId={community.id}
            isMember={community.isMember}
            onPosted={(post) => setLocalPosts((prev) => [post, ...prev])}
          />
        ) : (
          <div className="card-shell mb-4 p-4 text-center text-sm text-neutral-500 dark:text-neutral-400">
            Log in to join and post.
          </div>
        )}

        {isLoading && (
          <div className="flex justify-center py-10 text-neutral-400">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}

        {!isLoading && posts.length === 0 && (
          <p className="card-shell p-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
            No posts yet. Start the conversation.
          </p>
        )}

        <div className="space-y-3 pb-4">
          {posts.map((post) => (
            <ForumPostCard key={post.id} post={post} onUpdate={updatePost} onRemove={removePost} hideCommunity />
          ))}
          <div ref={sentinelRef} className="flex justify-center py-4">
            {isFetchingNextPage && <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />}
          </div>
        </div>
      </div>
    </main>
  );
}
