import "server-only";
import { prisma } from "@/lib/db";
import type { DemandStatus } from "@slotbook/db";
import { maskDemandAuthor } from "@/lib/demand-privacy";

/** Statuses that are hidden from the public feed/search entirely (§3.8). */
export const HIDDEN_FROM_FEED: DemandStatus[] = ["EXPIRED", "FILLED", "CANCELLED"];

export const DEMAND_CARD_SELECT = {
  id: true,
  postType: true,
  requirementRole: { select: { id: true, name: true } },
  summary: true,
  budgetMin: true,
  budgetMax: true,
  currency: true,
  timelineEnd: true,
  completionTimeline: true,
  completionDate: true,
  status: true,
  isPriority: true,
  priorityExpiresAt: true,
  shareContact: true,
  maxSlots: true,
  categoryParentId: true,
  categorySubId: true,
  categoryName: true,
  subCategoryName: true,
  categoryProviderId: true,
  categoryProblemIds: true,
  tags: true,
  selectedTechInputs: true,
  mediaUrls: true,
  lat: true,
  lng: true,
  locationName: true,
  createdAt: true,
  authorId: true,
  author: {
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      companyName: true,
      location: true,
      trust: { where: { role: "SEEKER" as const }, select: { tier: true } },
    },
  },
  // Up to 3 slot holders, embedded directly to avoid an N+1 fetch per card
  // on the feed — see DECISIONS.md #21. `slot` lets the client render them
  // in the correct 1/2/3 position even if bids arrive out of order.
  bids: {
    select: {
      slot: true,
      bidder: { select: { id: true, name: true, avatarUrl: true } },
    },
    orderBy: { slot: "asc" as const },
  },
} as const;

/**
 * Case-insensitive substring match of a query/service-tag term against a
 * demand's summary — the proxy for "service tag" filtering described in
 * DECISIONS.md #16, since the exact schema (§5) has no category column on
 * `Demand`. Reused as-is by M6's vendor-match notification targeting so
 * both features agree on what "matches" means.
 */
export function demandMatchesTerm(summary: string, term: string): boolean {
  return summary.toLowerCase().includes(term.trim().toLowerCase());
}

export type DemandDetail = NonNullable<Awaited<ReturnType<typeof getDemandDetail>>>;

interface RequesterContext {
  id: string;
  isAdmin: boolean;
}

/**
 * Fetches a single demand for the detail view/API, applying the strict
 * phone-privacy rule from §3.3e / §10 verbatim:
 *
 *   The author's phone number is included in the response IF AND ONLY IF
 *   ALL of the following hold:
 *     1. demand.shareContact === true, AND
 *     2. the requester is the demand's author, OR an ADMIN,
 *        OR holds at least one Bid (slot) on this demand.
 *   In every other case — no session, shareContact off, a signed-in user
 *   who isn't the author/admin/slot-holder — `authorPhone` is `null` on
 *   the returned object. This is enforced by never selecting `phone` from
 *   the author relation in the first place when the condition is false, so
 *   there's no field to accidentally leak downstream.
 */
export async function getDemandDetail(demandId: string, requester: RequesterContext | null) {
  const demand = await prisma.demand.findUnique({
    where: { id: demandId },
    select: {
      ...DEMAND_CARD_SELECT,
      author: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          companyName: true,
          companyLogo: true,
          location: true,
          bio: true,
          isVerified: true,
          createdAt: true,
          trust: { where: { role: "SEEKER" as const }, select: { tier: true } },
        },
      },
    },
  });
  if (!demand) return null;

  let authorPhone: string | null = null;

  if (demand.shareContact) {
    const isAuthor = requester?.id === demand.authorId;
    const isAdmin = Boolean(requester?.isAdmin);

    let holdsSlot = false;
    if (requester && !isAuthor && !isAdmin) {
      const bid = await prisma.bid.findFirst({
        where: { demandId: demand.id, bidderId: requester.id },
        select: { id: true },
      });
      holdsSlot = Boolean(bid);
    }

    if (isAuthor || isAdmin || holdsSlot) {
      const authorRow = await prisma.user.findUnique({
        where: { id: demand.authorId },
        select: { phone: true },
      });
      authorPhone = authorRow?.phone ?? null;
    }
  }

  return { ...maskDemandAuthor(demand, requester), authorPhone };
}
