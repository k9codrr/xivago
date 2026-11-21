"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { fetchCommunityPage, type CommunitySummary } from "@/components/community-list";
import { ImageUploadField } from "@/components/image-upload-field";

const INPUT = "w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900";
const BTN = "rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50";

function CommunityRow({ community }: { community: CommunitySummary }) {
  async function saveCover(coverImage: string) {
    const res = await fetch(`/api/admin/communities/${community.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coverImage }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      toast.error(data?.error?.message ?? "Could not save the cover image.");
    }
  }

  return (
    <li className="space-y-2 rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
      <div>
        <Link href={`/communities/${community.id}`} className="text-sm font-semibold hover:underline">
          {community.name}
        </Link>
        <p className="text-xs text-neutral-500">
          {community.memberCount} members · {community.postCount} posts
        </p>
      </div>
      <ImageUploadField
        kind="community"
        value={community.coverImage ?? undefined}
        onChange={(url) => void saveCover(url)}
        label="Cover image"
        shape="square"
      />
    </li>
  );
}

export default function AdminCommunitiesPage() {
  const queryClient = useQueryClient();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [coverImage, setCoverImage] = useState<string | undefined>();
  const [formKey, setFormKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ["admin-communities"],
    queryFn: ({ pageParam }) => fetchCommunityPage("", pageParam),
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

  async function create() {
    if (name.trim().length < 2 || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/communities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, coverImage }),
      });
      const result = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(result?.error?.message ?? "Could not create this community.");
        return;
      }
      toast.success("Community created.");
      setName("");
      setDescription("");
      setCoverImage(undefined);
      setFormKey((k) => k + 1); // clears the upload field's preview
      await queryClient.invalidateQueries({ queryKey: ["admin-communities"] });
      void queryClient.invalidateQueries({ queryKey: ["communities-list"] });
    } finally {
      setSubmitting(false);
    }
  }

  const communities = data?.pages.flatMap((p) => p.communities) ?? [];

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Communities</h1>

      <section className="mb-6 space-y-3 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="text-sm font-semibold">Create a community</h2>
        <ImageUploadField key={formKey} kind="community" value={coverImage} onChange={setCoverImage} label="Cover image" shape="square" />
        <input
          className={INPUT}
          aria-label="Community name"
          placeholder="Name, e.g. Delhi Packaging Providers"
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <textarea
          className={INPUT}
          aria-label="Community description"
          placeholder="What's this community about?"
          maxLength={500}
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <button type="button" className={BTN} disabled={name.trim().length < 2 || submitting} onClick={() => void create()}>
          {submitting ? "Creating…" : "Create community"}
        </button>
      </section>

      {isLoading && <Loader2 className="mx-auto h-5 w-5 animate-spin text-neutral-400" />}
      <ul className="space-y-2">
        {communities.map((community) => (
          <CommunityRow key={community.id} community={community} />
        ))}
      </ul>
      <div ref={sentinelRef} className="flex justify-center py-4">
        {isFetchingNextPage && <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />}
      </div>
    </div>
  );
}
