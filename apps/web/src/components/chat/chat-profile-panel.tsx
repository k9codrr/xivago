"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  AtSign,
  BadgeCheck,
  CalendarDays,
  Clock,
  ExternalLink,
  FileText,
  Globe,
  Image as ImageIcon,
  Link2,
  Loader2,
  MapPin,
  MessageCircle,
  Play,
  Share2,
  UserCheck,
  UserPlus,
  UserRound,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TierMark } from "@/components/tier-mark";
import { BADGE_LABEL, type BadgeCode, type TrustTierCode } from "@/lib/trust-labels";
import { formatLastSeen, type Presence } from "@/lib/presence";
import { PresenceAvatar } from "./chat-primitives";
import { MediaViewer, type ViewerItem } from "./media-viewer";

interface Details {
  profile: {
    id: string;
    name: string;
    username: string | null;
    bio: string | null;
    avatarUrl: string | null;
    companyName: string | null;
    website: string | null;
    services: string[];
    location: string | null;
    createdAt: string;
    followerCount: number;
    followingCount: number;
    isFollowedByViewer: boolean;
    isVerified: boolean;
    lastSeenAt: string | null;
    tier: TrustTierCode;
    badges: BadgeCode[];
  };
  demand: { id: string; summary: string; status: string } | null;
  chatStartedAt: string;
  commonCommunities: Array<{ id: string; name: string; coverImage: string | null }>;
  media: Array<{ id: string; messageId: string; url: string; contentType: string; createdAt: string }>;
  files: Array<{ id: string; messageId: string; url: string; contentType: string; createdAt: string; name: string }>;
  links: Array<{ id: string; messageId: string; url: string; host: string; text: string; createdAt: string }>;
}

type Tab = "media" | "files" | "links";

const BADGE_ICON: Record<BadgeCode, LucideIcon> = {
  VERIFIED: BadgeCheck,
  FAST_RESPONDER: Zap,
  ON_TIME: Clock,
  REPEAT_CLIENTS: Users,
};

/**
 * Tap the name / avatar in a chat → this panel slides in (Telegram style):
 * big photo with online dot, name with verified + tier, @handle, last seen,
 * quick actions, bio / location / website / services / badges, groups in
 * common, and everything shared in this chat under Media · Files · Links.
 */
export function ChatProfilePanel({
  open,
  conversationId,
  presence,
  onClose,
  onJumpToMessage,
}: {
  open: boolean;
  conversationId: string;
  presence: Presence | undefined;
  onClose: () => void;
  onJumpToMessage?: (messageId: string) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<Details | null>(null);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<Tab>("media");
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [following, setFollowing] = useState<boolean | null>(null);
  const [followBusy, setFollowBusy] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(false);
    fetch(`/api/conversations/${conversationId}/details`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: Details) => {
        if (cancelled) return;
        setData(d);
        setFollowing(d.profile.isFollowedByViewer);
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [open, conversationId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && viewerIndex === null && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, viewerIndex]);

  const viewerItems: ViewerItem[] = useMemo(
    () =>
      (data?.media ?? []).map((m) => ({
        id: m.id,
        url: m.url,
        contentType: m.contentType,
        meta: new Date(m.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }),
      })),
    [data?.media],
  );

  async function toggleFollow() {
    if (!data || followBusy) return;
    setFollowBusy(true);
    const next = !following;
    setFollowing(next);
    try {
      const res = await fetch(`/api/users/${data.profile.id}/follow`, { method: next ? "POST" : "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      setFollowing(!next);
      toast.error("Could not update follow.");
    } finally {
      setFollowBusy(false);
    }
  }

  async function shareProfile() {
    if (!data) return;
    const url = `${window.location.origin}/u/${data.profile.id}`;
    try {
      if (navigator.share) await navigator.share({ title: data.profile.name, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Profile link copied.");
      }
    } catch {
      // dismissed
    }
  }

  if (!mounted) return null;
  const p = data?.profile;
  const displayName = p ? (p.companyName ?? p.name) : "";
  const status = formatLastSeen(presence) ?? formatLastSeen(p ? { online: false, lastSeenAt: p.lastSeenAt } : undefined);

  const tabs: Array<{ id: Tab; label: string; count: number; icon: LucideIcon }> = [
    { id: "media", label: "Media", count: data?.media.length ?? 0, icon: ImageIcon },
    { id: "files", label: "Files", count: data?.files.length ?? 0, icon: FileText },
    { id: "links", label: "Links", count: data?.links.length ?? 0, icon: Link2 },
  ];

  return <>{createPortal(
    <>
      <AnimatePresence>
        {open && (
          <motion.aside
            key="chat-profile"
            role="dialog"
            aria-modal="true"
            aria-label="Contact info"
            className="fixed inset-0 z-[90] flex flex-col overflow-hidden bg-black text-white"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 40 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={{ left: 0, right: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.x > 120 || info.velocity.x > 600) onClose();
            }}
          >
            {/* Top bar */}
            <div className="flex shrink-0 items-center gap-2 px-2 pb-1 pt-[max(env(safe-area-inset-top),0.5rem)]">
              <button type="button" onClick={onClose} aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded-full active:bg-white/10">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <p className="flex-1 text-[17px] font-semibold">Contact info</p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[max(env(safe-area-inset-bottom),24px)]">
              {!data && !error && (
                <div className="flex justify-center py-24 text-white/50">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              )}
              {error && <p className="py-24 text-center text-sm text-white/50">Couldn&apos;t load this profile.</p>}

              {p && (
                <>
                  {/* Hero */}
                  <motion.div
                    className="flex flex-col items-center px-6 pt-3 text-center"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  >
                    <motion.div initial={{ scale: 0.7 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 18 }}>
                      <PresenceAvatar id={p.id} name={displayName} src={p.avatarUrl} size={112} online={presence?.online ?? false} ringClassName="ring-black ring-[3px]" />
                    </motion.div>
                    <h2 className="mt-4 flex max-w-full items-center justify-center gap-1.5 text-[24px] font-bold leading-tight">
                      <span className="truncate">{displayName}</span>
                      {(p.isVerified || p.badges.includes("VERIFIED")) && <BadgeCheck className="h-6 w-6 shrink-0 fill-[#0A84FF] text-black" />}
                    </h2>
                    {p.companyName && p.companyName !== p.name && <p className="mt-0.5 text-[14px] text-white/60">{p.name}</p>}
                    <div className="mt-1.5 flex flex-wrap items-center justify-center gap-2 text-[14px] text-white/55">
                      {p.username && <span>@{p.username}</span>}
                      <TierMark tier={p.tier} />
                    </div>
                    {status && <p className={cn("mt-1 text-[13px]", presence?.online ? "text-[#22C55E]" : "text-white/45")}>{status}</p>}

                    {/* Quick actions */}
                    <div className="mt-5 grid w-full max-w-sm grid-cols-4 gap-2">
                      <QuickAction icon={MessageCircle} label="Message" onClick={onClose} />
                      <QuickAction icon={UserRound} label="Profile" href={`/u/${p.id}`} />
                      <QuickAction
                        icon={following ? UserCheck : UserPlus}
                        label={following ? "Following" : "Follow"}
                        onClick={toggleFollow}
                        active={Boolean(following)}
                        busy={followBusy}
                      />
                      <QuickAction icon={Share2} label="Share" onClick={shareProfile} />
                    </div>
                  </motion.div>

                  {/* Info card */}
                  <section className="mx-4 mt-5 divide-y divide-white/[0.06] overflow-hidden rounded-2xl bg-[#1c1c1e]">
                    {p.bio && <InfoRow label="Bio" value={p.bio} multiline />}
                    {p.username && <InfoRow icon={AtSign} label="Username" value={`@${p.username}`} />}
                    {p.location && <InfoRow icon={MapPin} label="Location" value={p.location} />}
                    {p.website && (
                      <InfoRow
                        icon={Globe}
                        label="Website"
                        value={p.website.replace(/^https?:\/\//, "")}
                        href={p.website.startsWith("http") ? p.website : `https://${p.website}`}
                      />
                    )}
                    <InfoRow
                      icon={Users}
                      label="Followers"
                      value={`${p.followerCount.toLocaleString("en-IN")} followers · ${p.followingCount.toLocaleString("en-IN")} following`}
                    />
                    <InfoRow
                      icon={CalendarDays}
                      label="Joined"
                      value={new Date(p.createdAt).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
                    />
                    {data!.demand && (
                      <InfoRow icon={FileText} label="Chat about" value={data!.demand.summary} href={`/demands/${data!.demand.id}`} internal />
                    )}
                  </section>

                  {p.badges.length > 0 && (
                    <section className="mx-4 mt-3 rounded-2xl bg-[#1c1c1e] p-4">
                      <p className="text-[12px] font-semibold uppercase tracking-wider text-white/40">Badges</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {p.badges.map((b) => {
                          const Icon = BADGE_ICON[b];
                          return (
                            <span key={b} className="flex items-center gap-1.5 rounded-full bg-white/[0.07] px-3 py-1.5 text-[13px] font-medium">
                              <Icon className="h-4 w-4 text-[#0A84FF]" /> {BADGE_LABEL[b]}
                            </span>
                          );
                        })}
                      </div>
                    </section>
                  )}

                  {p.services.length > 0 && (
                    <section className="mx-4 mt-3 rounded-2xl bg-[#1c1c1e] p-4">
                      <p className="text-[12px] font-semibold uppercase tracking-wider text-white/40">Services</p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {p.services.map((s) => (
                          <span key={s} className="rounded-full bg-white/[0.07] px-2.5 py-1 text-[12px] text-white/80">
                            {s}
                          </span>
                        ))}
                      </div>
                    </section>
                  )}

                  {data!.commonCommunities.length > 0 && (
                    <section className="mx-4 mt-3 overflow-hidden rounded-2xl bg-[#1c1c1e]">
                      <p className="px-4 pt-4 text-[12px] font-semibold uppercase tracking-wider text-white/40">
                        {data!.commonCommunities.length} communit{data!.commonCommunities.length === 1 ? "y" : "ies"} in common
                      </p>
                      {data!.commonCommunities.map((c) => (
                        <Link key={c.id} href={`/communities/${c.id}`} className="flex items-center gap-3 px-4 py-2.5 active:bg-white/5">
                          {c.coverImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={c.coverImage} alt="" className="h-9 w-9 rounded-full object-cover" />
                          ) : (
                            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-sm">{c.name[0]}</span>
                          )}
                          <span className="truncate text-[15px]">{c.name}</span>
                        </Link>
                      ))}
                    </section>
                  )}

                  {/* Shared content tabs */}
                  <div className="sticky top-0 z-10 mt-5 bg-black/90 backdrop-blur-xl">
                    <div role="tablist" className="relative mx-4 grid grid-cols-3 rounded-xl bg-[#1c1c1e] p-1">
                      {tabs.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          role="tab"
                          aria-selected={tab === t.id}
                          onClick={() => setTab(t.id)}
                          className="relative z-10 flex h-9 items-center justify-center gap-1.5 text-[13px] font-semibold"
                        >
                          {tab === t.id && (
                            <motion.span
                              layoutId="chat-profile-tab"
                              className="absolute inset-0 -z-10 rounded-lg bg-[#3a3a3c]"
                              transition={{ type: "spring", stiffness: 500, damping: 38 }}
                            />
                          )}
                          <span className={tab === t.id ? "text-white" : "text-white/55"}>{t.label}</span>
                          {t.count > 0 && <span className="text-[11px] text-white/40">{t.count}</span>}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-3 min-h-[40vh]">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={tab}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.18 }}
                      >
                        {tab === "media" &&
                          (data!.media.length === 0 ? (
                            <Empty icon={ImageIcon} text="No photos or videos shared yet" />
                          ) : (
                            <div className="grid grid-cols-3 gap-0.5 px-0.5">
                              {data!.media.map((m, i) => (
                                <button
                                  key={m.id}
                                  type="button"
                                  onClick={() => setViewerIndex(i)}
                                  className="relative aspect-square overflow-hidden bg-[#1c1c1e]"
                                >
                                  {m.contentType.startsWith("video/") ? (
                                    <>
                                      <video src={`${m.url}#t=0.1`} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                                      <span className="absolute bottom-1 left-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60">
                                        <Play className="ml-px h-3 w-3 fill-white text-white" />
                                      </span>
                                    </>
                                  ) : (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={m.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                                  )}
                                </button>
                              ))}
                            </div>
                          ))}

                        {tab === "files" &&
                          (data!.files.length === 0 ? (
                            <Empty icon={FileText} text="No files shared yet" />
                          ) : (
                            <ul className="mx-4 divide-y divide-white/[0.06] overflow-hidden rounded-2xl bg-[#1c1c1e]">
                              {data!.files.map((f) => (
                                <li key={f.id}>
                                  <a href={f.url} target="_blank" rel="noreferrer noopener" className="flex items-center gap-3 px-4 py-3 active:bg-white/5">
                                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#FF453A] text-[10px] font-bold text-white">
                                      {f.contentType === "application/pdf" ? "PDF" : <FileText className="h-5 w-5" />}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                      <span className="block truncate text-[15px]">{f.name}</span>
                                      <span className="block text-[12px] text-white/45">
                                        {new Date(f.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                                      </span>
                                    </span>
                                    <ExternalLink className="h-4 w-4 text-white/40" />
                                  </a>
                                </li>
                              ))}
                            </ul>
                          ))}

                        {tab === "links" &&
                          (data!.links.length === 0 ? (
                            <Empty icon={Link2} text="No links shared yet" />
                          ) : (
                            <ul className="mx-4 divide-y divide-white/[0.06] overflow-hidden rounded-2xl bg-[#1c1c1e]">
                              {data!.links.map((l) => (
                                <li key={l.id} className="flex items-start gap-3 px-4 py-3">
                                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[16px] font-bold uppercase text-white/80">
                                    {l.host[0]}
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <a href={l.url} target="_blank" rel="noreferrer noopener" className="block truncate text-[15px] font-medium text-[#64A8FF]">
                                      {l.host}
                                    </a>
                                    <span className="block truncate text-[12px] text-white/45">{l.url}</span>
                                    {onJumpToMessage && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          onClose();
                                          setTimeout(() => onJumpToMessage(l.messageId), 350);
                                        }}
                                        className="mt-1 text-[12px] font-medium text-white/60"
                                      >
                                        Show in chat
                                      </button>
                                    )}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          ))}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </>
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
      <MediaViewer items={viewerItems} index={open ? viewerIndex : null} onIndexChange={setViewerIndex} onClose={() => setViewerIndex(null)} />
    </>,
    document.body,
  )}</>;
}

function QuickAction({
  icon: Icon,
  label,
  onClick,
  href,
  active,
  busy,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  href?: string;
  active?: boolean;
  busy?: boolean;
}) {
  const cls = cn(
    "flex flex-col items-center gap-1.5 rounded-2xl py-3 text-[12px] font-medium transition-transform active:scale-95",
    active ? "bg-[#0A84FF]/20 text-[#64A8FF]" : "bg-[#1c1c1e] text-white",
  );
  const body = (
    <>
      {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
      {label}
    </>
  );
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {body}
    </button>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  href,
  internal,
  multiline,
}: {
  icon?: LucideIcon;
  label: string;
  value: string;
  href?: string;
  internal?: boolean;
  multiline?: boolean;
}) {
  const content = (
    <div className="flex items-start gap-3 px-4 py-3">
      {Icon && <Icon className="mt-0.5 h-[18px] w-[18px] shrink-0 text-white/45" />}
      <div className="min-w-0 flex-1">
        <p className={cn("text-[15px] [overflow-wrap:anywhere]", multiline ? "whitespace-pre-wrap" : "truncate", href && "text-[#64A8FF]")}>{value}</p>
        <p className="mt-0.5 text-[12px] text-white/40">{label}</p>
      </div>
    </div>
  );
  if (!href) return content;
  return internal ? (
    <Link href={href} className="block active:bg-white/5">
      {content}
    </Link>
  ) : (
    <a href={href} target="_blank" rel="noreferrer noopener" className="block active:bg-white/5">
      {content}
    </a>
  );
}

function Empty({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="flex flex-col items-center py-16 text-white/40">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.06]">
        <Icon className="h-7 w-7" />
      </span>
      <p className="mt-3 text-[14px]">{text}</p>
    </div>
  );
}
