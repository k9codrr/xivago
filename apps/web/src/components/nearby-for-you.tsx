"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { BadgeCheck, Loader2, MapPin, MessageCircle, Navigation, Play } from "lucide-react";
import { useGeolocation } from "@/lib/use-geolocation";
import { getRememberedPermission } from "@/lib/permissions";
import { PresenceAvatar } from "@/components/chat/chat-primitives";
import { timeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";

interface NearbyPerson {
  id: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  companyName: string | null;
  isVerified: boolean;
  distanceKm: number;
  isFollowing: boolean;
}

interface NearbyPost {
  id: string;
  text: string;
  createdAt: string;
  media: { url: string; contentType: string } | null;
  commentCount: number;
  distanceKm: number;
  author: { id: string; name: string; avatarUrl: string | null; username: string | null };
}

/**
 * "Near you" — people and posts around the viewer, shown on the feed whether
 * or not the "near me" filter is on. Uses the remembered location (no prompt
 * if it was allowed before); otherwise offers a one-tap opt-in.
 */
export function NearbyForYou({
  className,
  show = "all",
}: {
  className?: string;
  /** "people": only the people row (the feed mixes it in between posts). */
  show?: "all" | "people";
}) {
  const { lat, lng, loading, requestLocation } = useGeolocation();
  // Read after mount (localStorage) so server and first client render match.
  const [denied, setDenied] = useState(false);
  useEffect(() => setDenied(getRememberedPermission("location") === "denied"), []);
  const hasGeo = lat != null && lng != null;
  // Round so tiny GPS jitter doesn't refetch.
  const key = hasGeo ? [Math.round(lat! * 100) / 100, Math.round(lng! * 100) / 100] : null;

  const { data, isLoading } = useQuery({
    queryKey: ["nearby", key],
    enabled: hasGeo,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<{ people: NearbyPerson[]; posts: NearbyPost[] }> => {
      const res = await fetch(`/api/nearby?lat=${lat}&lng=${lng}`);
      if (!res.ok) return { people: [], posts: [] };
      return res.json();
    },
  });

  if (!hasGeo) {
    if (denied) return null;
    return (
      <div className={cn("px-4 py-3", className)}>
        <button
          type="button"
          onClick={() => void requestLocation()}
          className="flex w-full items-center gap-3 rounded-2xl bg-gradient-to-r from-[#0A84FF]/15 to-[#BF5AF2]/15 p-3.5 text-left ring-1 ring-white/10 active:scale-[0.99]"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#0A84FF]/20">
            {loading ? <Loader2 className="h-5 w-5 animate-spin text-[#64A8FF]" /> : <Navigation className="h-5 w-5 text-[#64A8FF]" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-white">See people &amp; posts near you</span>
            <span className="block text-[13px] text-white/55">Turn on location once — we&apos;ll remember it.</span>
          </span>
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={cn("flex gap-3 overflow-hidden px-4 py-3", className)}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-[150px] w-[118px] shrink-0 animate-pulse rounded-2xl bg-white/[0.05]" />
        ))}
      </div>
    );
  }

  const people = data?.people ?? [];
  const posts = show === "people" ? [] : (data?.posts ?? []);
  if (people.length === 0 && posts.length === 0) return null;

  return (
    <section className={cn("py-3", className)} aria-label="Near you">
      {people.length > 0 && (
        <>
          <h2 className="flex items-center gap-1.5 px-4 text-[15px] font-semibold text-white">
            <MapPin className="h-4 w-4 text-[#FF453A]" /> People near you
          </h2>
          <div data-swipe-zone className="mt-2.5 flex gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {people.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 8) * 0.04 }}
              >
                <Link
                  href={`/u/${p.id}`}
                  className="flex w-[118px] shrink-0 flex-col items-center rounded-2xl bg-white/[0.05] px-2 pb-3 pt-4 text-center ring-1 ring-white/[0.06] active:scale-[0.97]"
                >
                  <PresenceAvatar id={p.id} name={p.name} src={p.avatarUrl} size={60} />
                  <span className="mt-2 flex max-w-full items-center gap-0.5 text-[13px] font-semibold text-white">
                    <span className="truncate">{p.companyName ?? p.name}</span>
                    {p.isVerified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 fill-[#0A84FF] text-black" />}
                  </span>
                  <span className="mt-0.5 text-[11.5px] text-white/50">{p.distanceKm} km away</span>
                  <span
                    className={cn(
                      "mt-2 rounded-full px-3 py-1 text-[12px] font-semibold",
                      p.isFollowing ? "bg-white/10 text-white/70" : "bg-white text-black",
                    )}
                  >
                    {p.isFollowing ? "Following" : "View"}
                  </span>
                </Link>
              </motion.div>
            ))}
          </div>
        </>
      )}

      {posts.length > 0 && (
        <>
          <h2 className="mt-4 flex items-center gap-1.5 px-4 text-[15px] font-semibold text-white">
            <Navigation className="h-4 w-4 text-[#64A8FF]" /> Posts near you
          </h2>
          <div data-swipe-zone className="mt-2.5 flex gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {posts.map((p, i) => (
              <motion.div key={p.id} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 8) * 0.04 }}>
                <Link
                  href={`/forum/${p.id}`}
                  className="flex h-[196px] w-[230px] shrink-0 flex-col overflow-hidden rounded-2xl bg-white/[0.05] ring-1 ring-white/[0.06] active:scale-[0.98]"
                >
                  {p.media ? (
                    <div className="relative h-[104px] w-full bg-black">
                      {p.media.contentType.startsWith("video/") ? (
                        <>
                          <video src={`${p.media.url}#t=0.1`} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                          <span className="absolute inset-0 flex items-center justify-center">
                            <Play className="h-7 w-7 fill-white text-white drop-shadow" />
                          </span>
                        </>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.media.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                      )}
                    </div>
                  ) : null}
                  <div className="flex min-h-0 flex-1 flex-col p-3">
                    <p className={cn("text-[13.5px] leading-[18px] text-white/85 [overflow-wrap:anywhere]", p.media ? "line-clamp-2" : "line-clamp-5")}>{p.text}</p>
                    <div className="mt-auto flex items-center gap-1.5 pt-2 text-[11.5px] text-white/45">
                      <PresenceAvatar id={p.author.id} name={p.author.name} src={p.author.avatarUrl} size={18} />
                      <span className="truncate">{p.author.name}</span>
                      <span>· {p.distanceKm} km</span>
                      <span className="ml-auto flex items-center gap-0.5">
                        <MessageCircle className="h-3 w-3" /> {p.commentCount}
                      </span>
                    </div>
                    <span className="sr-only">{timeAgo(p.createdAt)}</span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
