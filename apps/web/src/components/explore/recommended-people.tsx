"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BadgeCheck, QrCode, ScanLine, ShoppingBag, Sparkles, Ticket } from "lucide-react";
import type { RecommendationReason } from "@/app/api/recommendations/people/route";

interface Person {
  id: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  companyName: string | null;
  isVerified: boolean;
  reason: RecommendationReason;
}

const REASON: Record<RecommendationReason, { label: string; icon: React.ElementType; tint: string }> = {
  scanned: { label: "You scanned", icon: ScanLine, tint: "#38bdf8" },
  bought_your_spot: { label: "Took your spot", icon: Ticket, tint: "#fb923c" },
  you_bought: { label: "You took a spot", icon: ShoppingBag, tint: "#a78bfa" },
  scanned_you: { label: "Scanned you", icon: QrCode, tint: "#34d399" },
  niche: { label: "In your niche", icon: Sparkles, tint: "#facc15" },
};

/** Gradient fallbacks for people without a photo, picked stably from their id. */
const HUES = [
  "linear-gradient(135deg,#7c3aed,#db2777)",
  "linear-gradient(135deg,#0ea5e9,#14b8a6)",
  "linear-gradient(135deg,#f97316,#eab308)",
  "linear-gradient(135deg,#6366f1,#22d3ee)",
  "linear-gradient(135deg,#e11d48,#f97316)",
];
const hue = (id: string) => HUES[[...id].reduce((n, c) => n + c.charCodeAt(0), 0) % HUES.length]!;

/** People you've scanned or dealt with (either side of a spot), then people in your niches. */
export function RecommendedPeople({ signedIn }: { signedIn: boolean }) {
  const [people, setPeople] = useState<Person[] | null>(null);

  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    fetch("/api/recommendations/people")
      .then((r) => (r.ok ? r.json() : { people: [] }))
      .then((j: { people: Person[] }) => !cancelled && setPeople(j.people))
      .catch(() => !cancelled && setPeople([]));
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  if (!signedIn) return null;

  return (
    <section className="mt-8">
      <h3 className="px-5 text-[17px] font-semibold tracking-[-0.01em] text-white/55">Recommended</h3>
      <div className="no-scrollbar mt-3 flex gap-3.5 overflow-x-auto px-4 pb-1">
        {/* Promo tile first, like a gift card */}
        <Link
          href="/invite"
          className="relative flex h-[92px] w-[132px] shrink-0 flex-col justify-between overflow-hidden rounded-[30px] bg-[linear-gradient(140deg,#14532d,#166534_45%,#052e16)] p-3.5 ring-1 ring-inset ring-white/10 active:scale-[0.98]"
        >
          <span className="absolute inset-0 bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.05)_0_6px,transparent_6px_14px)]" />
          <span className="relative text-[22px] font-black italic leading-none tracking-tight text-white [text-shadow:0_2px_0_rgba(0,0,0,0.5)]">
            GET 300
          </span>
          <span className="relative text-[11px] font-medium text-emerald-100/80">credits per invite</span>
        </Link>

        {people === null &&
          Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex w-[70px] shrink-0 flex-col items-center gap-2">
              <span className="h-[70px] w-[70px] animate-pulse rounded-[30px] bg-white/[0.06]" />
              <span className="h-2.5 w-14 animate-pulse rounded-full bg-white/[0.06]" />
            </div>
          ))}

        {people?.length === 0 && (
          <div className="flex h-[92px] w-[210px] shrink-0 items-center gap-3 rounded-[30px] border border-dashed border-white/15 px-4 text-[12px] leading-snug text-white/50">
            <ScanLine className="h-6 w-6 shrink-0 text-white/40" strokeWidth={1.6} />
            Scan someone&apos;s QR or take a spot to see people here
          </div>
        )}

        {people?.map((p) => {
          const r = REASON[p.reason];
          const Icon = r.icon;
          return (
            <Link key={p.id} href={`/u/${p.id}`} className="flex w-[70px] shrink-0 flex-col items-center active:scale-[0.97]">
              <span className="relative !h-[70px] !w-[70px]">
                <span
                  className="grid h-full w-full place-items-center overflow-hidden rounded-[30px] ring-1 ring-inset ring-white/10"
                  style={{ background: p.avatarUrl ? "#1a1a1c" : hue(p.id) }}
                >
                  {p.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.avatarUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-[26px] font-bold text-white/95">
                      {p.name
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((w) => w[0])
                        .join("")
                        .toUpperCase()}
                    </span>
                  )}
                </span>
                <span
                  title={r.label}
                  className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full border-[2.5px] border-[#0a0a0a]"
                  style={{ background: r.tint }}
                >
                  <Icon className="h-3.5 w-3.5 text-black" strokeWidth={2.4} />
                </span>
              </span>
              <span className="mt-2 flex w-full items-center justify-center gap-0.5 text-[12px] font-medium text-white/90">
                <span className="truncate">{p.name.split(/\s+/)[0]}</span>
                {p.isVerified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-sky-400" />}
              </span>
              <span className="w-full truncate text-center text-[10.5px] text-white/40">{r.label}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
