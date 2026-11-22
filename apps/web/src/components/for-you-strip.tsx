"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Heart, MessageCircle, Navigation, Play, Sparkles } from "lucide-react";
import { DemandCard, type DemandCardData } from "@/components/demand-card";
import { PresenceAvatar } from "@/components/chat/chat-primitives";
import { getRememberedLocation } from "@/lib/use-geolocation";
import { cn } from "@/lib/utils";

interface RecommendedPost {
  id: string;
  text: string;
  createdAt: string;
  media: { url: string; contentType: string } | null;
  commentCount: number;
  reactionCount: number;
  distanceKm: number | null;
  author: { id: string; name: string; avatarUrl: string | null; username: string | null };
}

type Item = { type: "demand"; demand: DemandCardData } | { type: "post"; post: RecommendedPost };

/** A fresh seed per page visit, shared by every strip on the page (each adds its own suffix). */
export function newVisitSeed(): string {
  return Math.random().toString(36).slice(2, 10).padEnd(8, "0");
}

/**
 * Horizontal "for you" row: up to 10 picks from /api/recommendations/posts,
 * chosen from the viewer's onboarding niches, what they viewed / liked /
 * saved, where they are and what's featured (see lib/recommendations.ts).
 *
 *   kind="demands" → offers & requests only (dropped between feed posts)
 *   kind="mixed"   → offers & requests and feed posts (Explore)
 */
export function ForYouStrip({
  kind,
  seed,
  title,
  subtitle,
  className,
}: {
  kind: "demands" | "mixed";
  seed: string;
  title: string;
  subtitle?: string;
  className?: string;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["for-you", kind, seed],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Item[]> => {
      const url = new URL("/api/recommendations/posts", window.location.origin);
      url.searchParams.set("kind", kind);
      url.searchParams.set("seed", seed);
      // Remembered location only -- this row never asks for permission.
      const geo = getRememberedLocation();
      if (geo) {
        url.searchParams.set("lat", String(geo.lat));
        url.searchParams.set("lng", String(geo.lng));
      }
      const res = await fetch(url.toString());
      if (!res.ok) return [];
      return (await res.json()).items ?? [];
    },
  });

  if (!isLoading && (!data || data.length === 0)) return null;

  return (
    <section className={cn("py-3", className)} aria-label={title}>
      <div className="flex items-end justify-between gap-3 px-4">
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 text-[15px] font-semibold text-white">
            <Sparkles className="h-4 w-4 text-[#FFD60A]" /> {title}
          </h2>
          {subtitle && <p className="mt-0.5 text-[12px] text-white/45">{subtitle}</p>}
        </div>
        {kind === "demands" && (
          <Link href="/" className="shrink-0 text-[12.5px] font-semibold text-[#64A8FF] active:opacity-60">
            See all
          </Link>
        )}
      </div>

      <div data-swipe-zone className="mt-2.5 flex gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {isLoading &&
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aspect-[3/4.4] w-[158px] shrink-0 animate-pulse rounded-[22px] bg-white/[0.05]" />
          ))}
        {data?.map((item, i) => (
          <motion.div
            key={item.type === "demand" ? `d-${item.demand.id}` : `p-${item.post.id}`}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(i, 8) * 0.04 }}
            className="w-[158px] shrink-0"
          >
            {item.type === "demand" ? <DemandCard demand={item.demand} /> : <PostTile post={item.post} />}
          </motion.div>
        ))}
      </div>
    </section>
  );
}

/** A feed post sized like a demand card, so a mixed row lines up. */
function PostTile({ post }: { post: RecommendedPost }) {
  const isVideo = post.media?.contentType.startsWith("video/");
  return (
    <Link
      href={`/forum/${post.id}`}
      className="flex aspect-[3/4.4] w-full flex-col overflow-hidden rounded-[22px] bg-[#1C1C1E] ring-1 ring-white/[0.08] active:scale-[0.97]"
    >
      {post.media ? (
        <div className="relative h-[46%] w-full shrink-0 bg-black">
          {isVideo ? (
            <>
              <video src={`${post.media.url}#t=0.1`} muted playsInline preload="metadata" className="h-full w-full object-cover" />
              <span className="absolute inset-0 flex items-center justify-center">
                <Play className="h-7 w-7 fill-white text-white drop-shadow" />
              </span>
            </>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.media.url} alt="" loading="lazy" className="h-full w-full object-cover" />
          )}
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col p-3">
        <span className="mb-1.5 w-fit rounded-full bg-white/10 px-2 py-[2px] text-[10px] font-semibold text-white/70">Feed post</span>
        <p className={cn("text-[13px] leading-[18px] text-white/85 [overflow-wrap:anywhere]", post.media ? "line-clamp-3" : "line-clamp-[8]")}>
          {post.text}
        </p>
        <div className="mt-auto flex items-center gap-1.5 pt-2 text-[11px] text-white/45">
          <PresenceAvatar id={post.author.id} name={post.author.name} src={post.author.avatarUrl} size={18} />
          <span className="min-w-0 truncate">{post.author.name}</span>
        </div>
        <div className="mt-1 flex items-center gap-2.5 text-[11px] text-white/45">
          <span className="flex items-center gap-0.5"><Heart className="h-3 w-3" /> {post.reactionCount}</span>
          <span className="flex items-center gap-0.5"><MessageCircle className="h-3 w-3" /> {post.commentCount}</span>
          {post.distanceKm != null && (
            <span className="ml-auto flex items-center gap-0.5"><Navigation className="h-3 w-3" /> {post.distanceKm} km</span>
          )}
        </div>
      </div>
    </Link>
  );
}
