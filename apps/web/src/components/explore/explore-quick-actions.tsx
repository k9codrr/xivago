"use client";

import Link from "next/link";
import { useState } from "react";
import { Eye, EyeOff, History, QrCode } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import { useExploreIcons, EXPLORE_ICON_BASE } from "@/lib/explore-icons";
import { ProfileQrModal } from "@/components/profile-qr-modal";

interface ExploreQuickActionsProps {
  userId?: string;
  name?: string;
  /** null while loading or signed out. */
  credits: number | null;
}

/** Two rows of shortcuts under the hero: your QR · credits · history, then a
 *  scrolling strip of the things people do most on xivago. */
export function ExploreQuickActions({ userId, name, credits }: ExploreQuickActionsProps) {
  const [qrOpen, setQrOpen] = useState(false);
  const [showCredits, setShowCredits] = useState(false);

  return (
    <section className="mt-6 space-y-5">
      <div className="flex items-start gap-3 px-4">
        <Tile label="Your QR" onClick={userId ? () => setQrOpen(true) : undefined} href={userId ? undefined : "/login"}>
          <QrCode className="h-[26px] w-[26px] text-white/90" strokeWidth={1.6} />
        </Tile>

        <button
          type="button"
          onClick={() => {
            void haptic("light");
            setShowCredits((v) => !v);
          }}
          aria-pressed={showCredits}
          className="flex h-[60px] min-w-0 flex-1 items-center justify-center gap-3 rounded-3xl border border-white/[0.09] bg-[#0b0b0c] px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition active:scale-[0.98]"
        >
          {showCredits ? (
            <>
              <EyeOff className="h-[20px] w-[20px] shrink-0 text-white/70" strokeWidth={1.8} />
              <span className="min-w-0 text-left">
                <span className="block truncate text-[19px] font-semibold tabular-nums text-white">
                  {credits == null ? "—" : credits.toLocaleString("en-IN")}
                </span>
                <span className="block text-[11px] text-white/45">credits</span>
              </span>
            </>
          ) : (
            <>
              <Eye className="h-[20px] w-[20px] shrink-0 text-white/90" strokeWidth={1.8} />
              <span className="truncate text-[17px] font-medium text-white">Check Credits</span>
            </>
          )}
        </button>

        <Tile label="History" href="/activity">
          <History className="h-[26px] w-[26px] text-white/90" strokeWidth={1.6} />
        </Tile>
      </div>

      <div className="no-scrollbar flex items-start gap-3 overflow-x-auto overflow-y-hidden px-4 pt-2">
        {/* Wide tile with a tab on top, like a featured action */}
        <Link
          href="/spin"
          className="relative flex h-[60px] w-[190px] shrink-0 items-center gap-3 rounded-[24px] border border-white/[0.09] bg-[#0b0b0c] px-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] active:scale-[0.98]"
        >
          <span className="absolute -top-[9px] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-[8px] bg-[#232325] px-3 py-[3px] text-[10.5px] font-medium text-white/80">
            <span className="text-amber-300">✦</span> Win 500 credits <span className="text-amber-300">✦</span>
          </span>
          <ExploreIcon src="gift" className="h-9 w-9 rotate-[-8deg]" />
          <span className="text-[17px] font-medium text-white">Spin &amp; Win</span>
        </Link>
        <Tile label="Post" href="/post">
          <ExploreIcon src="megaphone" className="h-10 w-10" />
        </Tile>
        <Tile label="Featured" href="/featured">
          <ExploreIcon src="star" className="h-10 w-10" />
        </Tile>
        <Tile label="Groups" href="/communities">
          <ExploreIcon src="groups" className="h-10 w-10" />
        </Tile>
        <Tile label="Near me" href="/?local=true">
          <ExploreIcon src="pin" className="h-10 w-10" />
        </Tile>
        <Tile label="Invite" href="/invite">
          <ExploreIcon src="coin" className="h-10 w-10" />
        </Tile>
      </div>

      {userId && <ProfileQrModal open={qrOpen} onClose={() => setQrOpen(false)} userId={userId} name={name ?? ""} />}
    </section>
  );
}

/** Squircle tile with its label on a tab overlapping the bottom edge. */
function Tile({
  label,
  href,
  onClick,
  children,
}: {
  label: string;
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const body = (
    <>
      <span className="grid h-[60px] w-[88px] place-items-center rounded-[30px] border border-white/[0.09] bg-[#0b0b0c] pb-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
        {children}
      </span>
      <span className="absolute -bottom-[2px] left-1/2 -translate-x-1/2 whitespace-nowrap bg-[#1f1f21] px-3 py-[3px] text-[11.5px] text-white/90 shadow-[0_2px_6px_rgba(0,0,0,0.5)]">
        {label}
      </span>
    </>
  );
  const cls = "relative block h-[60px] w-[88px] shrink-0 transition active:scale-[0.97]";
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={cls}>
        {body}
      </button>
    );
  return (
    <Link href={href ?? "#"} className={cls}>
      {body}
    </Link>
  );
}

function ExploreIcon({ src, className }: { src: string; className?: string }) {
  const set = useExploreIcons();
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${EXPLORE_ICON_BASE[set]}/${src}.png`}
      alt=""
      aria-hidden
      draggable={false}
      loading="lazy"
      className={cn("pointer-events-none select-none object-contain drop-shadow-[0_6px_10px_rgba(0,0,0,0.6)]", className)}
    />
  );
}
