"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bookmark, FolderPlus, Loader2, Trash2 } from "lucide-react";
import { DemandCard, DemandCardData } from "@/components/demand-card";
import { toast } from "sonner";

/** `onCollect` adds a "Save to collection" button on each card. */
export function BookmarksList({ onCollect }: { onCollect?: (demandId: string) => void } = {}) {
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery<{ demands: DemandCardData[] }>({
    queryKey: ["bookmarks"],
    queryFn: async () => {
      const res = await fetch("/api/bookmarks");
      if (!res.ok) throw new Error("Failed to load bookmarks");
      return res.json();
    },
  });

  const removeBookmarkMutation = useMutation({
    mutationFn: async (demandId: string) => {
      const res = await fetch(`/api/bookmarks?demandId=${demandId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to remove bookmark");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Bookmark removed.");
      void queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
    },
    onError: () => {
      toast.error("Could not remove bookmark.");
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-16 text-neutral-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (isError || !data?.demands) {
    return (
      <div className="card-shell flex flex-col items-center gap-2 p-8 text-center">
        <p className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
          Could not load saved bookmarks.
        </p>
      </div>
    );
  }

  if (data.demands.length === 0) {
    return (
      <div className="card-shell flex flex-col items-center gap-3 p-10 text-center">
        <Bookmark className="h-10 w-10 text-neutral-300 dark:text-neutral-700" />
        <p className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
          No bookmarked requests yet
        </p>
        <p className="text-xs text-neutral-400">
          Swipe right on any card in the &quot;For you&quot; swipe deck to save it here!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {data.demands.map((demand) => (
        <div key={demand.id} className="relative group">
          <DemandCard demand={demand} />
          {onCollect && (
            <button
              type="button"
              onClick={() => onCollect(demand.id)}
              aria-label="Save to collection"
              className="absolute right-14 top-3 z-10 rounded-full bg-neutral-800/90 p-2 text-white shadow-sm backdrop-blur hover:bg-neutral-700"
            >
              <FolderPlus className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => removeBookmarkMutation.mutate(demand.id)}
            aria-label="Remove bookmark"
            className="absolute right-3 top-3 z-10 rounded-full bg-white/90 p-2 text-red-500 shadow-sm transition-opacity hover:bg-red-50 dark:bg-neutral-800 dark:hover:bg-neutral-700"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
