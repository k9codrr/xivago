"use client";

import { useCallback, useEffect, useState } from "react";
import { Bookmark, FolderPlus, Loader2 } from "lucide-react";
import { ForumPostCard } from "@/components/forum/forum-post-card";
import type { ForumPost } from "@/components/forum/types";

/** Forum posts the user saved. Un-saving one removes it from the list. */
/** `onCollect` adds a "Save to collection" button on each post. */
export function SavedPostsList({ onCollect }: { onCollect?: (postId: string) => void } = {}) {
  const [posts, setPosts] = useState<ForumPost[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  const fetchPage = useCallback(async (cursor: string | null) => {
    const res = await fetch(`/api/forum/bookmarks${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`);
    if (!res.ok) throw new Error("load failed");
    return (await res.json()) as { posts: ForumPost[]; nextCursor: string | null };
  }, []);

  useEffect(() => {
    fetchPage(null)
      .then((data) => {
        setPosts(data.posts);
        setNextCursor(data.nextCursor);
      })
      .catch(() => setError(true));
  }, [fetchPage]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await fetchPage(nextCursor);
      setPosts((cur) => [...(cur ?? []), ...data.posts]);
      setNextCursor(data.nextCursor);
    } catch {
      setError(true);
    } finally {
      setLoadingMore(false);
    }
  }

  function update(id: string, updater: (p: ForumPost) => ForumPost) {
    setPosts((cur) =>
      (cur ?? []).flatMap((p) => {
        if (p.id !== id) return [p];
        const next = updater(p);
        return next.isBookmarked ? [next] : []; // un-saved here → gone from Saved
      }),
    );
  }

  if (error && !posts) {
    return <p className="card-shell p-8 text-center text-sm text-neutral-500">Could not load saved posts.</p>;
  }
  if (!posts) {
    return (
      <div className="flex justify-center py-16 text-neutral-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (posts.length === 0) {
    return (
      <div className="card-shell flex flex-col items-center gap-3 p-10 text-center">
        <Bookmark className="h-10 w-10 text-neutral-300 dark:text-neutral-700" />
        <p className="text-sm font-medium text-neutral-700 dark:text-neutral-200">No saved posts yet</p>
        <p className="text-xs text-neutral-400">Tap the bookmark on any feed post to keep it here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {posts.map((post) => (
        <div key={post.id} className="relative">
          <ForumPostCard
            post={post}
            onUpdate={update}
            onRemove={(id) => setPosts((cur) => (cur ?? []).filter((p) => p.id !== id))}
          />
          {onCollect && (
            <button
              type="button"
              onClick={() => onCollect(post.id)}
              aria-label="Save to collection"
              className="absolute right-12 top-3 z-10 flex items-center gap-1 rounded-full bg-neutral-800/90 px-2.5 py-1.5 text-[12px] font-medium text-white backdrop-blur"
            >
              <FolderPlus className="h-3.5 w-3.5" /> Collect
            </button>
          )}
        </div>
      ))}
      {nextCursor && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loadingMore}
          className="mx-auto flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm text-neutral-300 disabled:opacity-60"
        >
          {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
          Load more
        </button>
      )}
    </div>
  );
}
