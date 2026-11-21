import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError } from "@/lib/api-response";

const MAX_ENTRIES = 500;

/**
 * Full wallet history for /credits/send: every credit ledger row, plus slot
 * purchases paid directly through Razorpay (those never touch the credit
 * ledger). Credit-paid slots also write a synthetic `cred_slot_*` Payment row
 * (see demands/[id]/slots) -- those are skipped here so the slot isn't listed
 * twice.
 */

type Kind = "SLOT" | "POST_FEE" | "BOOST" | "FEATURED" | "SENT" | "RECEIVED" | "TOP_UP" | "GRANT" | "OTHER";

interface Person {
  id: string;
  name: string;
  avatarUrl: string | null;
  companyName: string | null;
}

const PERSON_SELECT = { id: true, name: true, avatarUrl: true, companyName: true } as const;

function ledgerKind(type: string, note: string | null): Kind {
  if (type === "TRANSFER_OUT") return "SENT";
  if (type === "TRANSFER_IN") return "RECEIVED";
  if (type === "PURCHASE") return "TOP_UP";
  if (type === "GRANT") return "GRANT";
  if (type === "FEATURED_HOLD" || type === "FEATURED_REFUND") return "FEATURED";
  if (note === "post-demand-fee") return "POST_FEE";
  if (note?.startsWith("priority-boost")) return "BOOST";
  if (note?.startsWith("slot-purchase")) return "SLOT";
  return "OTHER";
}

export async function GET() {
  try {
    const user = await requireUser();

    const [profile, txns, slotPayments] = await Promise.all([
      prisma.user.findUnique({
        where: { id: user.id },
        select: { ...PERSON_SELECT, creditBalance: true },
      }),
      prisma.creditTransaction.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: MAX_ENTRIES,
        select: { id: true, amount: true, type: true, note: true, demandId: true, createdAt: true },
      }),
      prisma.payment.findMany({
        where: {
          userId: user.id,
          type: "SLOT",
          status: { in: ["CAPTURED", "REFUNDED"] },
          NOT: { razorpayOrderId: { startsWith: "cred_" } },
        },
        orderBy: { createdAt: "desc" },
        take: MAX_ENTRIES,
        select: { id: true, amountPaise: true, status: true, demandId: true, createdAt: true },
      }),
    ]);
    if (!profile) return apiError(404, "NOT_FOUND", "Profile not found.");

    // Resolve every demand and transfer counterpart in two batched queries.
    const demandIds = new Set<string>();
    const personIds = new Set<string>();
    for (const t of txns) {
      if (t.demandId) demandIds.add(t.demandId);
      const other = t.note?.match(/^transfer (?:to|from) (\S+)$/)?.[1];
      if (other) personIds.add(other);
    }
    for (const p of slotPayments) if (p.demandId) demandIds.add(p.demandId);

    const [demands, people, bids] = await Promise.all([
      demandIds.size
        ? prisma.demand.findMany({
            where: { id: { in: [...demandIds] } },
            select: {
              id: true,
              summary: true,
              mediaUrls: true,
              categoryName: true,
              subCategoryName: true,
              maxSlots: true,
              status: true,
              timelineEnd: true,
              budgetMin: true,
              budgetMax: true,
              author: { select: PERSON_SELECT },
            },
          })
        : [],
      personIds.size ? prisma.user.findMany({ where: { id: { in: [...personIds] } }, select: PERSON_SELECT }) : [],
      demandIds.size
        ? prisma.bid.findMany({
            where: { bidderId: user.id, demandId: { in: [...demandIds] } },
            select: { demandId: true, slot: true, pitch: true, createdAt: true },
          })
        : [],
    ]);
    const demandById = new Map(demands.map((d) => [d.id, d]));
    const personById = new Map<string, Person>(people.map((p) => [p.id, p]));
    const bidByDemand = new Map(bids.map((b) => [b.demandId, b]));

    function demandDetail(demandId: string | null) {
      const d = demandId ? demandById.get(demandId) : undefined;
      if (!d) return null;
      const { mediaUrls, ...rest } = d;
      return { ...rest, imageUrl: mediaUrls[0] ?? null };
    }

    const entries = [
      ...txns.map((t) => {
        const kind = ledgerKind(t.type, t.note);
        const otherId = t.note?.match(/^transfer (?:to|from) (\S+)$/)?.[1];
        const demand = demandDetail(t.demandId);
        const bid = t.demandId && kind === "SLOT" ? bidByDemand.get(t.demandId) : undefined;
        const slotFromNote = t.note?.match(/^slot-purchase-slot-(\d+)$/)?.[1];
        return {
          id: t.id,
          kind,
          createdAt: t.createdAt,
          credits: t.amount,
          rupeesPaise: null as number | null,
          refunded: false,
          person: otherId ? (personById.get(otherId) ?? null) : kind === "SLOT" ? (demand?.author ?? null) : null,
          demand,
          slot:
            kind === "SLOT"
              ? { number: bid?.slot ?? (slotFromNote ? Number(slotFromNote) : null), pitch: bid?.pitch ?? null }
              : null,
        };
      }),
      ...slotPayments.map((p) => {
        const demand = demandDetail(p.demandId);
        const bid = p.demandId ? bidByDemand.get(p.demandId) : undefined;
        return {
          id: p.id,
          kind: "SLOT" as Kind,
          createdAt: p.createdAt,
          credits: 0,
          rupeesPaise: p.amountPaise,
          refunded: p.status === "REFUNDED",
          person: demand?.author ?? null,
          demand,
          slot: { number: bid?.slot ?? null, pitch: bid?.pitch ?? null },
        };
      }),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return NextResponse.json({
      profile: { id: profile.id, name: profile.name, avatarUrl: profile.avatarUrl, creditBalance: profile.creditBalance },
      entries,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("credits/history GET: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not load your credit history.");
  }
}
