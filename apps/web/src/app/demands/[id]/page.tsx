import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  BadgeCheck,
  CalendarDays,
  ChevronRight,
  Clock,
  FileText,
  HelpCircle,
  LifeBuoy,
  Mail,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  Tag,
  Users,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { getOptionalUser } from "@/lib/guards";
import { getDemandDetail, HIDDEN_FROM_FEED } from "@/lib/demand-access";
import { isBoostActive } from "@/lib/boost-shared";
import { CountdownBadge } from "@/components/countdown-badge";
import { PriorityBadge } from "@/components/priority-badge";
import { SlotStrip } from "@/components/slot-strip";
import { DemandDetailActions } from "@/components/demand-detail-actions";
import { formatBudgetRange } from "@/lib/money";
import { withPriceUnit } from "@/lib/price-units";
import { serviceAreaLabel } from "@/lib/service-area";
import { DemandProviderProblems } from "@/components/category-flow/demand-provider-problems";
import { DemandStatsPanel } from "@/components/demand-stats-panel";
import { demandTypeLabel } from "@/lib/demand-type";
import { TierMark } from "@/components/tier-mark";
import { publicEnv } from "@/lib/env";
import { postReference } from "@/lib/validation/report";
import { completionLabel } from "@/lib/completion-timeline";
import { DemandMediaGallery } from "@/components/demand-detail/demand-media-gallery";
import { DemandLocationMap } from "@/components/demand-detail/demand-location-map";
import { ScreenshotGuard } from "@/components/screenshot-guard";
import {
  CopyPostId,
  DemandReportProvider,
  DemandTopBar,
  ReportButton,
} from "@/components/demand-detail/demand-detail-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const demand = await getDemandDetail(id, null);
  if (!demand) return { title: "Request not found" };
  return { title: demand.summary.slice(0, 60) };
}

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });
const monthFmt = new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric" });
const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function timeAgo(date: Date): string {
  const secs = Math.round((date.getTime() - Date.now()) / 1000);
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, size] of steps) {
    if (Math.abs(secs) >= size) return rtf.format(Math.round(secs / size), unit);
  }
  return "just now";
}

const SAFETY_TIPS = [
  "Chat and pay inside xivago. Never pay advance fees outside the app.",
  "Meet in a public place and check the work before you release any payment.",
  "Never share OTPs, passwords or your transaction PIN with anyone.",
];

function DetailRow({ icon: Icon, label, value }: { icon: typeof Tag; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
      <span className="w-32 shrink-0 text-sm text-neutral-500">{label}</span>
      <span className="min-w-0 flex-1 text-sm font-medium text-neutral-900 dark:text-neutral-100">{value}</span>
    </div>
  );
}

export default async function DemandDetailPage({ params }: PageProps) {
  const { id } = await params;
  const sessionUser = await getOptionalUser();

  const demand = await getDemandDetail(
    id,
    sessionUser ? { id: sessionUser.id, isAdmin: sessionUser.isAdmin } : null,
  );

  if (!demand) notFound();

  // §3.8: EXPIRED/FILLED/CANCELLED demands are gone for everyone but admins.
  const isHidden = HIDDEN_FROM_FEED.includes(demand.status);
  if (isHidden && !sessionUser?.isAdmin) notFound();

  const isSaved = sessionUser
    ? Boolean(
        await prisma.bookmark.findUnique({
          where: { userId_demandId: { userId: sessionUser.id, demandId: demand.id } },
          select: { id: true },
        }),
      )
    : false;

  const budgetLabel = withPriceUnit(formatBudgetRange(demand.budgetMin, demand.budgetMax), demand.priceUnit);
  const typeLabel = demandTypeLabel(demand);
  const isAuthor = sessionUser?.id === demand.authorId;
  const viewerHoldsSlot = Boolean(sessionUser && demand.bids.some((b) => b.bidder.id === sessionUser.id));
  const maxSlots = demand.maxSlots ?? 3;
  const createdAt = new Date(demand.createdAt);
  const memberSince = demand.author.createdAt ? new Date(demand.author.createdAt) : null;
  const authorTier = demand.author.trust?.[0]?.tier ?? null;
  const techInputs = (demand.selectedTechInputs ?? {}) as Record<string, string[]>;
  const techEntries = Object.entries(techInputs).filter(([, opts]) => Array.isArray(opts) && opts.length > 0);
  const postId = postReference(demand.id);
  const completionText = completionLabel(demand.completionTimeline, demand.completionDate);
  const isOffer = demand.postType === "PROMOTE";
  const areaText = serviceAreaLabel(demand, 6);
  const supportEmail = publicEnv.NEXT_PUBLIC_SUPPORT_EMAIL;
  const supportWhatsApp = publicEnv.NEXT_PUBLIC_SUPPORT_WHATSAPP.replace(/\D/g, "");
  const supportSubject = encodeURIComponent(`Help with post ${postId}`);

  return (
    <DemandReportProvider demandId={demand.id} signedIn={Boolean(sessionUser)}>
      <ScreenshotGuard>
      <main className="mx-auto max-w-6xl pb-8 lg:px-6 lg:pt-6">
        {isHidden && (
          <div className="mx-4 mb-3 mt-[max(env(safe-area-inset-top),0.75rem)] rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs font-medium text-amber-700 lg:mx-0 lg:mt-0">
            Viewing as admin. This demand is {demand.status.toLowerCase()} and hidden from other users.
          </div>
        )}

        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-6">
          {/* ---------- Left column: media + post details ---------- */}
          <div className="space-y-4">
            <DemandMediaGallery
              urls={demand.mediaUrls ?? []}
              overlay={
                <DemandTopBar
                  demandId={demand.id}
                  title={demand.summary.slice(0, 80)}
                  signedIn={Boolean(sessionUser)}
                  initiallySaved={isSaved}
                />
              }
            />

            <div className="space-y-4 px-4 lg:px-0">
              {/* Price + headline */}
              <section className="card-shell p-5">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {typeLabel && (
                      <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                        {typeLabel}
                      </span>
                    )}
                    {isBoostActive(demand.isPriority, demand.priorityExpiresAt) && <PriorityBadge />}
                  </div>
                  <CountdownBadge timelineEnd={demand.timelineEnd} />
                </div>

                <p className="text-2xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
                  {budgetLabel ?? "Price on request"}
                </p>
                <h1 className="mt-1.5 line-clamp-3 text-base font-medium leading-snug text-neutral-800 dark:text-neutral-100">
                  {demand.summary}
                </h1>

                <div className="mt-3 flex items-center justify-between gap-3 border-t border-neutral-100 pt-3 text-xs text-neutral-500 dark:border-neutral-800">
                  <span className="flex min-w-0 items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{demand.author.location ?? "Location not shared"}</span>
                  </span>
                  <time dateTime={createdAt.toISOString()} className="shrink-0">
                    {timeAgo(createdAt)}
                  </time>
                </div>
              </section>

              {/* Details */}
              <section className="card-shell p-5">
                <h2 className="mb-1 text-base font-bold text-neutral-900 dark:text-neutral-100">Details</h2>
                <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {typeLabel && <DetailRow icon={FileText} label="Post type" value={typeLabel} />}
                  {demand.requirementRole && (
                    <DetailRow icon={Users} label="Looking for" value={demand.requirementRole.name} />
                  )}
                  {demand.categoryName && <DetailRow icon={Tag} label="Category" value={demand.categoryName} />}
                  {demand.subCategoryName && (
                    <DetailRow icon={Tag} label="Sub-category" value={demand.subCategoryName} />
                  )}
                  <DetailRow icon={CalendarDays} label="Posted on" value={dateFmt.format(createdAt)} />
                  <DetailRow icon={Clock} label={isOffer ? "Live until" : "Connect by"} value={dateFmt.format(new Date(demand.timelineEnd))} />
                  {areaText && <DetailRow icon={MapPin} label="Serves" value={areaText} />}
                  {completionText && (
                    <DetailRow
                      icon={CalendarDays}
                      label={demand.postType === "REQUIREMENT" ? "Completion" : "Delivery"}
                      value={completionText}
                    />
                  )}
                  {!isOffer && (
                    <DetailRow
                      icon={Users}
                      label="Response spots"
                      value={`${demand.bids.length} of ${maxSlots} filled`}
                    />
                  )}
                  {techEntries.map(([label, opts]) => (
                    <DetailRow key={label} icon={BadgeCheck} label={label} value={opts.join(", ")} />
                  ))}
                </div>

                <DemandProviderProblems
                  providerId={demand.categoryProviderId}
                  problemIds={demand.categoryProblemIds}
                  className="mt-3"
                />

                {demand.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {demand.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-brand-500/10 px-2.5 py-1 text-xs font-semibold text-brand-600 dark:text-brand-400"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </section>

              {/* Description */}
              <section className="card-shell p-5">
                <h2 className="mb-2 text-base font-bold text-neutral-900 dark:text-neutral-100">Description</h2>
                <p className="whitespace-pre-line break-words text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
                  {demand.summary}
                </p>
              </section>

              <DemandLocationMap lat={demand.lat} lng={demand.lng} locationLabel={demand.author.location} />
            </div>
          </div>

          {/* ---------- Right column: poster, actions, trust & support ---------- */}
          <aside className="mt-4 space-y-4 px-4 lg:sticky lg:top-6 lg:mt-0 lg:px-0">
            {/* Posted by */}
            <section className="card-shell p-5">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-neutral-500">Posted by</h2>
              {demand.authorHidden ? (
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/icons/avatar-placeholder.svg" alt="" className="h-14 w-14 rounded-full bg-neutral-100 object-cover" />
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 font-semibold">
                      {demand.author.name} <TierMark tier={authorTier} />
                    </p>
                    <p className="text-xs text-neutral-500">Take a response spot to see who posted</p>
                  </div>
                </div>
              ) : (
                <Link href={`/u/${demand.author.id}`} className="group flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={demand.author.avatarUrl ?? "/icons/avatar-placeholder.svg"}
                    alt={demand.author.name}
                    className="h-14 w-14 rounded-full bg-neutral-100 object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate font-semibold text-neutral-900 dark:text-neutral-100">
                      <span className="truncate">{demand.author.companyName ?? demand.author.name}</span>
                      {demand.author.isVerified && (
                        <BadgeCheck className="h-4 w-4 shrink-0 text-brand-500" aria-label="Verified" />
                      )}
                      <TierMark tier={authorTier} />
                    </p>
                    {demand.author.companyName && (
                      <p className="truncate text-xs text-neutral-500">{demand.author.name}</p>
                    )}
                    {memberSince && (
                      <p className="text-xs text-neutral-500">Member since {monthFmt.format(memberSince)}</p>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-neutral-400 transition group-hover:translate-x-0.5" />
                </Link>
              )}

              {demand.author.bio && !demand.authorHidden && (
                <p className="mt-3 line-clamp-3 text-sm text-neutral-600 dark:text-neutral-400">{demand.author.bio}</p>
              )}

              {!isAuthor && (
                <div className="mt-4 flex items-center justify-between border-t border-neutral-100 pt-3 dark:border-neutral-800">
                  {!demand.authorHidden ? (
                    <Link href={`/u/${demand.author.id}`} className="text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400">
                      View profile
                    </Link>
                  ) : (
                    <span />
                  )}
                  <ReportButton target="USER" />
                </div>
              )}
            </section>

            {/* Response spots + actions */}
            <section className="card-shell space-y-3 p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">
                Response spots ({demand.bids.length} of {maxSlots} filled)
              </p>
              <SlotStrip
                demandId={demand.id}
                bids={demand.bids}
                maxSlots={maxSlots}
                budgetMax={demand.budgetMax}
                budgetMin={demand.budgetMin}
                disabled={demand.status !== "OPEN"}
                isAuthorView={isAuthor}
              />
              <DemandDetailActions
                demandId={demand.id}
                isAuthor={isAuthor}
                isOpen={demand.status === "OPEN"}
                isPriority={demand.isPriority}
                priorityExpiresAt={demand.priorityExpiresAt ? new Date(demand.priorityExpiresAt).toISOString() : null}
                shareContact={demand.shareContact}
                authorPhone={demand.authorPhone}
                summary={demand.summary}
                viewerHoldsSlot={viewerHoldsSlot}
              />
            </section>

            <DemandStatsPanel demandId={demand.id} />

            {/* Post ID + report */}
            <section className="card-shell flex flex-wrap items-center justify-between gap-2 px-5 py-3.5">
              <CopyPostId label="Post ID" value={postId} />
              {!isAuthor && <ReportButton target="DEMAND" />}
            </section>

            {/* Safety tips */}
            <section className="card-shell p-5">
              <h2 className="mb-2.5 flex items-center gap-2 text-sm font-bold text-neutral-900 dark:text-neutral-100">
                <ShieldCheck className="h-4 w-4 text-brand-500" /> Stay safe on xivago
              </h2>
              <ul className="space-y-2">
                {SAFETY_TIPS.map((tip) => (
                  <li key={tip} className="flex gap-2 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-neutral-400" />
                    {tip}
                  </li>
                ))}
              </ul>
            </section>

            {/* Help & support */}
            <section className="card-shell overflow-hidden">
              <h2 className="flex items-center gap-2 px-5 pb-2 pt-4 text-sm font-bold text-neutral-900 dark:text-neutral-100">
                <LifeBuoy className="h-4 w-4 text-brand-500" /> Help &amp; Support
              </h2>
              <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {supportWhatsApp && (
                  <a
                    href={`https://wa.me/${supportWhatsApp}?text=${supportSubject}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-900"
                  >
                    <HelpCircle className="h-4 w-4 text-neutral-400" />
                    <span className="flex-1">Chat with support on WhatsApp</span>
                    <ChevronRight className="h-4 w-4 text-neutral-400" />
                  </a>
                )}
                {supportEmail && (
                  <a
                    href={`mailto:${supportEmail}?subject=${supportSubject}`}
                    className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-900"
                  >
                    <Mail className="h-4 w-4 text-neutral-400" />
                    <span className="flex-1">Email support</span>
                    <ChevronRight className="h-4 w-4 text-neutral-400" />
                  </a>
                )}
                {!isAuthor && (
                  <ReportButton
                    target="DEMAND"
                    className="flex w-full items-center gap-3 px-5 py-3 text-left text-sm font-normal text-neutral-800 hover:bg-neutral-50 hover:no-underline dark:text-neutral-200 dark:hover:bg-neutral-900"
                  >
                    <ShieldAlert className="h-4 w-4 text-neutral-400" />
                    <span className="flex-1">Report a problem with this post</span>
                    <ChevronRight className="h-4 w-4 text-neutral-400" />
                  </ReportButton>
                )}
                <Link
                  href="/terms"
                  className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-900"
                >
                  <FileText className="h-4 w-4 text-neutral-400" />
                  <span className="flex-1">Terms &amp; posting rules</span>
                  <ChevronRight className="h-4 w-4 text-neutral-400" />
                </Link>
              </div>
              <p className="px-5 pb-4 pt-2 text-[11px] text-neutral-400">
                Quote Post ID <span className="font-mono font-semibold">{postId}</span> when you contact support.
              </p>
            </section>
          </aside>
        </div>
      </main>
      </ScreenshotGuard>
    </DemandReportProvider>
  );
}
