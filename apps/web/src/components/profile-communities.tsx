"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Users } from "lucide-react";
import { CommunityJoinButton } from "@/components/community-join-button";
import type { CommunitySummary } from "@/components/community-list";

const COLLAPSED_COUNT = 6;

function blurb(description: string | null) {
  if (!description) return null;
  return description.match(/a community for (.+) on Xivago \((.+)\)\.$/)?.[1] ?? description;
}

function coverSrc(url: string, width: number) {
  if (!url.startsWith("https://images.unsplash.com/")) return url;
  const u = new URL(url);
  u.searchParams.set("w", String(width));
  return u.toString();
}

/** Communities a user has joined, shown on their public profile. */
export function ProfileCommunities({ userId, isSelf }: { userId: string; isSelf: boolean }) {
  const [communities, setCommunities] = useState<CommunitySummary[] | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/users/${userId}/communities`);
      const data = res.ok ? await res.json() : { communities: [] };
      if (!cancelled) setCommunities(data.communities);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (communities === null) {
    return (
      <div className="flex justify-center py-8 text-neutral-500">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  const shown = expanded ? communities : communities.slice(0, COLLAPSED_COUNT);

  return (
    <section>
      <div className="mb-2.5 flex items-baseline justify-between">
        <h2 className="text-lg font-bold text-white">
          Communities <span className="text-sm font-medium text-neutral-500">{communities.length}</span>
        </h2>
        {isSelf && (
          <Link href="/forum?tab=communities" className="text-sm font-semibold text-sapphire">
            Discover
          </Link>
        )}
      </div>

      {communities.length === 0 ? (
        <div className="rounded-3xl border border-white/5 bg-neutral-950/60 px-6 py-8 text-center">
          <Users className="mx-auto h-6 w-6 text-neutral-600" />
          <p className="mt-2 text-sm text-neutral-500">
            {isSelf ? "You haven't joined any communities yet." : "Hasn't joined any communities yet."}
          </p>
          {isSelf && (
            <Link href="/forum?tab=communities" className="mt-3 inline-block text-sm font-semibold text-sapphire">
              Browse communities
            </Link>
          )}
        </div>
      ) : (
        <div className="divide-y divide-white/5 rounded-3xl border border-white/5 bg-neutral-950/60 px-4">
          {shown.map((c) => {
            const topic = blurb(c.description);
            return (
              <div key={c.id} className="flex items-center gap-3 py-3">
                <Link href={`/communities/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  {c.coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={coverSrc(c.coverImage, 160)}
                      alt=""
                      loading="lazy"
                      className="h-12 w-12 shrink-0 rounded-2xl object-cover"
                    />
                  ) : (
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-700">
                      <Users className="h-5 w-5 text-white/80" />
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-neutral-100">{c.name}</span>
                    {topic && <span className="block truncate text-xs text-neutral-500">{topic}</span>}
                    <span className="block text-xs text-neutral-500">
                      {c.memberCount} {c.memberCount === 1 ? "member" : "members"}
                    </span>
                  </span>
                </Link>
                {!isSelf && <CommunityJoinButton communityId={c.id} initialMember={c.isMember} />}
              </div>
            );
          })}
          {communities.length > COLLAPSED_COUNT && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="w-full py-3 text-center text-sm font-semibold text-sapphire"
            >
              {expanded ? "Show less" : `Show all ${communities.length}`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
