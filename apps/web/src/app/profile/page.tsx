import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  ChevronRight,
  Globe,
  ListChecks,
  MapPin,
  Pencil,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { getOptionalUser } from "@/lib/guards";
import { SignOutButton } from "@/components/sign-out-button";

const groupCard =
  "rounded-[20px] border border-black/[0.04] bg-white/80 backdrop-blur-xl backdrop-saturate-150 dark:border-white/[0.06] dark:bg-[#1C1C1E]/80";
const sectionTitle =
  "mb-2 px-4 text-[13px] font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400";

export default async function ProfilePage() {
  const sessionUser = await getOptionalUser();
  if (!sessionUser) redirect("/login?callbackUrl=/profile");

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      role: true,
      bio: true,
      avatarUrl: true,
      companyName: true,
      companyLogo: true,
      website: true,
      services: true,
      location: true,
      creditBalance: true,
      subscription: { select: { plan: true, status: true } },
    },
  });

  if (!user) redirect("/login");

  const isPro = user.subscription?.plan === "PRO" && user.subscription.status === "ACTIVE";
  const website = user.website?.replace(/^https?:\/\//, "");
  const avatar = user.avatarUrl ?? "/icons/avatar-placeholder.svg";

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-[#F2F2F7] pb-12 text-neutral-900 dark:bg-black dark:text-white">
      {/* ── Ambient backdrop: blurred avatar wash ── */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-80 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatar}
          alt=""
          className="h-full w-full scale-150 object-cover opacity-50 blur-3xl saturate-150 dark:opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#F2F2F7]/60 to-[#F2F2F7] dark:via-black/60 dark:to-black" />
      </div>

      {/* ── Frosted nav bar ── */}
      <header className="sticky top-0 z-20 pt-[env(safe-area-inset-top)] border-b border-black/[0.06] bg-[#F2F2F7]/70 backdrop-blur-2xl backdrop-saturate-[1.8] dark:border-white/[0.08] dark:bg-black/60">
        <div className="mx-auto grid h-12 max-w-xl grid-cols-[1fr_auto_1fr] items-center px-2">
          <Link
            href="/"
            aria-label="Back"
            className="flex h-9 w-9 items-center justify-center rounded-full text-emerald-600 transition active:scale-95 active:bg-black/5 dark:text-emerald-400 dark:active:bg-white/10"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2.25} />
          </Link>
          <p className="flex items-center gap-1 truncate text-[17px] font-semibold tracking-tight">
            {user.name}
            {isPro && <BadgeCheck className="h-4 w-4 shrink-0 fill-emerald-500 text-white dark:text-black" />}
          </p>
          <Link
            href="/profile/edit"
            className="justify-self-end rounded-full px-3 py-1.5 text-[17px] font-medium text-emerald-600 transition active:opacity-60 dark:text-emerald-400"
          >
            Edit
          </Link>
        </div>
      </header>

      <div className="relative mx-auto max-w-xl px-4">
        {/* ── Identity hero ── */}
        <section className="flex flex-col items-center pt-8 text-center">
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatar}
              alt={user.name}
              className="h-28 w-28 rounded-full bg-neutral-200 object-cover shadow-[0_12px_40px_-8px_rgba(0,0,0,0.35)] ring-4 ring-white/80 dark:bg-neutral-800 dark:ring-white/10"
            />
            <Link
              href="/profile/edit"
              aria-label="Edit profile"
              className="absolute bottom-0.5 right-0.5 flex h-8 w-8 items-center justify-center rounded-full border border-black/5 bg-white/90 text-neutral-700 shadow-md backdrop-blur-md transition active:scale-95 dark:border-white/10 dark:bg-neutral-800/90 dark:text-neutral-200"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Link>
          </div>

          <h1 className="mt-4 flex items-center gap-1.5 text-[28px] font-bold leading-tight tracking-tight">
            {user.name}
            {isPro && <BadgeCheck className="h-6 w-6 fill-emerald-500 text-white dark:text-black" />}
          </h1>
          {user.username && <p className="mt-0.5 text-[15px] text-neutral-500 dark:text-neutral-400">@{user.username}</p>}
          {user.companyName && (
            <p className="mt-0.5 text-[15px] text-neutral-500 dark:text-neutral-400">{user.companyName}</p>
          )}

          {(user.location || website) && (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              {user.location && (
                <span className="inline-flex items-center gap-1 rounded-full border border-black/[0.05] bg-white/60 px-3 py-1 text-[13px] text-neutral-600 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.06] dark:text-neutral-300">
                  <MapPin className="h-3.5 w-3.5" /> {user.location}
                </span>
              )}
              {website && (
                <a
                  href={user.website!}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 rounded-full border border-black/[0.05] bg-white/60 px-3 py-1 text-[13px] font-medium text-emerald-600 backdrop-blur-xl transition active:opacity-60 dark:border-white/[0.08] dark:bg-white/[0.06] dark:text-emerald-400"
                >
                  <Globe className="h-3.5 w-3.5" /> {website}
                </a>
              )}
            </div>
          )}

          {user.bio && (
            <p className="mt-4 max-w-md whitespace-pre-line text-[15px] leading-relaxed text-neutral-700 dark:text-neutral-300">
              {user.bio}
            </p>
          )}

          <div className="mt-5 flex w-full max-w-xs gap-2">
            <Link
              href="/profile/edit"
              className="flex h-11 flex-1 items-center justify-center rounded-full bg-neutral-900 text-[15px] font-semibold text-white shadow-sm transition active:scale-[0.98] dark:bg-pearl dark:text-slate-navy"
            >
              Edit profile
            </Link>
            <Link
              href={`/u/${user.id}`}
              className="flex h-11 flex-1 items-center justify-center rounded-full border border-black/[0.06] bg-white/70 text-[15px] font-semibold backdrop-blur-xl transition active:scale-[0.98] dark:border-white/[0.1] dark:bg-white/[0.08]"
            >
              Public view
            </Link>
          </div>
        </section>

        {/* ── Services ── */}
        {user.services.length > 0 && (
          <section className="mt-8">
            <h2 className={sectionTitle}>Services</h2>
            <div className={`${groupCard} flex flex-wrap gap-2 p-4`}>
              {user.services.map((s) => (
                <span
                  key={s}
                  className="rounded-full bg-[#787880]/10 px-3 py-1 text-[13px] font-medium text-neutral-700 dark:bg-white/10 dark:text-neutral-200"
                >
                  {s}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* ── Wallet ── */}
        <section className="mt-8">
          <h2 className={sectionTitle}>Wallet</h2>
          <Link
            href="/checkout"
            className={`${groupCard} group flex items-center gap-3 p-4 transition active:scale-[0.99]`}
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-sm">
              <Wallet className="h-5 w-5" />
            </span>
            <div className="flex-1 leading-tight">
              <p className="text-[22px] font-bold tabular-nums tracking-tight">
                {user.creditBalance}
                <span className="ml-1 text-[15px] font-medium text-neutral-500 dark:text-neutral-400">credits</span>
              </p>
              <p className="mt-0.5 text-[13px] text-neutral-500 dark:text-neutral-400">Used for featured boosts</p>
            </div>
            <ChevronRight className="h-5 w-5 text-neutral-300 transition-transform group-hover:translate-x-0.5 dark:text-neutral-600" />
          </Link>
        </section>

        {/* ── Activity ── */}
        <section className="mt-8">
          <h2 className={sectionTitle}>Activity</h2>
          <nav className={`${groupCard} overflow-hidden`}>
            <MenuRow
              href="/explore/sell"
              icon={<ListChecks className="h-4 w-4" />}
              tint="from-sky-400 to-blue-600"
              label="My posts"
            />
            <MenuRow
              href="/explore/buy"
              icon={<CalendarClock className="h-4 w-4" />}
              tint="from-orange-400 to-orange-600"
              label="My responses"
            />
            <MenuRow
              href="/checkout"
              icon={<Sparkles className="h-4 w-4" />}
              tint="from-amber-300 to-amber-500"
              label={isPro ? "Manage PRO subscription" : "Upgrade to PRO"}
              badge={!isPro}
            />
            {user.role === "ADMIN" && (
              <MenuRow
                href="/admin"
                icon={<ShieldCheck className="h-4 w-4" />}
                tint="from-emerald-400 to-emerald-600"
                label="Admin panel"
              />
            )}
          </nav>
        </section>

        {/* ── Log out ── */}
        <section
          className={`${groupCard} mt-8 overflow-hidden [&_button]:h-12 [&_button]:rounded-none [&_button]:text-[17px] [&_button]:font-medium [&_button:hover]:bg-red-500/5`}
        >
          <SignOutButton />
        </section>
      </div>
    </main>
  );
}

function MenuRow({
  href,
  icon,
  tint,
  label,
  badge,
}: {
  href: string;
  icon: ReactNode;
  tint: string;
  label: string;
  badge?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 pl-4 transition-colors active:bg-black/[0.04] dark:active:bg-white/[0.06]"
    >
      <span
        className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[8px] bg-gradient-to-br ${tint} text-white shadow-sm`}
      >
        {icon}
      </span>
      <span className="flex flex-1 items-center justify-between border-b border-black/[0.06] py-3.5 pr-4 group-last:border-0 dark:border-white/[0.08]">
        <span className="flex items-center gap-2 text-[16px] font-medium">
          {label}
          {badge && <span className="h-2 w-2 rounded-full bg-emerald-500" />}
        </span>
        <ChevronRight className="h-4 w-4 text-neutral-300 transition-transform group-hover:translate-x-0.5 dark:text-neutral-600" />
      </span>
    </Link>
  );
}
