"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import type { ForumPost } from "./types";

type FeedData = InfiniteData<{ posts: ForumPost[]; nextCursor: string | null }>;

const FEED_KEY = ["forum-feed"];

/**
 * One post for the post page and media viewer. Starts from the feed's copy so
 * opening a post is instant, then refreshes; changes are written back to the
 * feed so its counts are right when the user returns.
 */
export function useForumPost(id: string) {
  const queryClient = useQueryClient();

  const query = useQuery<ForumPost | null>({
    queryKey: ["forum-post", id],
    queryFn: async () => {
      const res = await fetch(`/api/forum/${id}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to load this post");
      return (await res.json()).post;
    },
    initialData: () => {
      for (const [, feed] of queryClient.getQueriesData<FeedData>({ queryKey: FEED_KEY })) {
        const found = feed?.pages.flatMap((p) => p.posts).find((p) => p.id === id);
        if (found) return found;
      }
      return undefined;
    },
    initialDataUpdatedAt: 0, // always refresh the feed's copy
  });

  const update = useCallback(
    (postId: string, updater: (post: ForumPost) => ForumPost) => {
      queryClient.setQueryData<ForumPost | null>(["forum-post", postId], (p) => (p ? updater(p) : p));
      queryClient.setQueriesData<FeedData>({ queryKey: FEED_KEY }, (feed) =>
        feed && {
          ...feed,
          pages: feed.pages.map((page) => ({
            ...page,
            posts: page.posts.map((p) => (p.id === postId ? updater(p) : p)),
          })),
        },
      );
    },
    [queryClient],
  );

  const removeFromFeed = useCallback(
    (postId: string) => {
      queryClient.setQueriesData<FeedData>({ queryKey: FEED_KEY }, (feed) =>
        feed && {
          ...feed,
          pages: feed.pages.map((page) => ({ ...page, posts: page.posts.filter((p) => p.id !== postId) })),
        },
      );
    },
    [queryClient],
  );

  return { post: query.data, isLoading: query.isLoading, isError: query.isError, update, removeFromFeed };
}
