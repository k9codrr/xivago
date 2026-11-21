import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError, apiValidationError } from "@/lib/api-response";
import { tierFor, topTier } from "@/lib/trust-labels";
import { findOrCreateDirectConversation, NotProError, SelfMessageError } from "@/lib/direct-conversation";

const PARTY_SELECT = {
  id: true,
  name: true,
  username: true,
  avatarUrl: true,
  companyName: true,
  isVerified: true,
  lastSeenAt: true,
  trust: { select: { role: true, tier: true } },
} as const;

export async function GET() {
  try {
    const user = await requireUser();

    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [{ buyerId: user.id }, { bidderId: user.id }],
        // A request the viewer declined disappears from their inbox; the
        // sender still sees it, marked declined.
        NOT: { status: "DECLINED", bidderId: user.id },
      },
      select: {
        id: true,
        createdAt: true,
        status: true,
        buyerId: true,
        bidderId: true,
        demand: { select: { id: true, summary: true, status: true } },
        buyer: { select: PARTY_SELECT },
        bidder: { select: PARTY_SELECT },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            text: true,
            createdAt: true,
            senderId: true,
            readAt: true,
            deliveredAt: true,
            deletedAt: true,
            attachments: { select: { contentType: true }, take: 1 },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const conversationIds = conversations.map((c) => c.id);
    const unreadCounts = conversationIds.length
      ? await prisma.message.groupBy({
          by: ["conversationId"],
          where: { conversationId: { in: conversationIds }, senderId: { not: user.id }, readAt: null },
          _count: { _all: true },
        })
      : [];
    const unreadByConversation = new Map(unreadCounts.map((u) => [u.conversationId, u._count._all]));

    // Conversation <-> Bid aren't FK-linked in the schema (they're joined by
    // demandId+bidderId), so look up each conversation's bid id in one batch
    // query -- used to gate the "Rate" action to engagements that actually
    // had a slot purchase. Direct (demand-less) conversations never have a bid.
    const withDemand = conversations.filter((c) => c.demand);
    const bids = withDemand.length
      ? await prisma.bid.findMany({
          where: { OR: withDemand.map((c) => ({ demandId: c.demand!.id, bidderId: c.bidderId })) },
          select: { id: true, demandId: true, bidderId: true },
        })
      : [];
    const bidByKey = new Map(bids.map((b) => [`${b.demandId}:${b.bidderId}`, b.id]));

    const shaped = conversations.map((c) => {
      const { trust, ...otherParty } = c.buyerId === user.id ? c.bidder : c.buyer;
      // The other side's tier in the role they play here (vendor = slot holder).
      const otherTier = !c.demand ? topTier(trust) : tierFor(trust, c.buyerId === user.id ? "VENDOR" : "SEEKER");
      // Tab grouping: "slot" = chats from a demand I bought a slot on,
      // "demand" = chats on a demand I posted, "direct" = direct message
      // with no demand/bid behind it, "request" = a message request someone
      // sent me that I haven't answered yet. On a request the sender is buyerId.
      const requestedByMe = c.status !== "ACTIVE" && c.buyerId === user.id;
      const kind: "slot" | "demand" | "direct" | "request" = !c.demand
        ? c.status === "PENDING" && !requestedByMe
          ? "request"
          : "direct"
        : c.bidderId === user.id
          ? "slot"
          : "demand";
      return {
        id: c.id,
        kind,
        status: c.status,
        requestedByMe,
        demand: c.demand,
        otherParty,
        otherTier,
        bidId: c.demand ? bidByKey.get(`${c.demand.id}:${c.bidderId}`) ?? null : null,
        lastMessage: c.messages[0] ?? null,
        unreadCount: unreadByConversation.get(c.id) ?? 0,
      };
    });

    // Most recently active first (last message time, falling back to creation time).
    shaped.sort((a, b) => {
      const aTime = new Date(a.lastMessage?.createdAt ?? 0).getTime();
      const bTime = new Date(b.lastMessage?.createdAt ?? 0).getTime();
      return bTime - aTime;
    });

    return NextResponse.json({ conversations: shaped });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("conversations GET: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not load your chats.");
  }
}

const createSchema = z.union([
  z.object({ demandId: z.string().cuid() }),
  z.object({ targetUserId: z.string().cuid() }),
]);

/**
 * Conversations are normally auto-created the instant a slot payment
 * captures (see lib/slot-allocation.ts). This POST exists per section 6's
 * API surface as a defensive "get or verify" -- for the `demandId` shape it
 * can only succeed if the caller already holds a Bid on the demand (i.e.
 * the conversation SHOULD already exist); it never fabricates a conversation
 * out of thin air for someone who hasn't bought a slot.
 *
 * The `targetUserId` shape opens a demand-less ("direct") conversation with
 * anyone: a normal chat for a PRO subscriber, otherwise a message request
 * the other person has to accept (see lib/direct-conversation.ts).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
    }
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    if ("demandId" in parsed.data) {
      const { demandId } = parsed.data;
      const bid = await prisma.bid.findFirst({
        where: { demandId, bidderId: user.id },
        select: { demandId: true },
      });
      if (!bid) {
        return apiError(403, "NO_SLOT_HELD", "You need a response spot on this request to open a chat.");
      }

      const demand = await prisma.demand.findUnique({
        where: { id: demandId },
        select: { authorId: true },
      });
      if (!demand) return apiError(404, "NOT_FOUND", "This request doesn't exist.");

      const conversation = await prisma.conversation.upsert({
        where: { demandId_buyerId_bidderId: { demandId, buyerId: demand.authorId, bidderId: user.id } },
        update: {},
        create: { demandId, buyerId: demand.authorId, bidderId: user.id },
        select: { id: true },
      });

      return NextResponse.json({ conversation });
    }

    const { targetUserId } = parsed.data;
    const conversation = await findOrCreateDirectConversation(user.id, targetUserId);
    if (!conversation) return apiError(404, "NOT_FOUND", "This user doesn't exist.");

    return NextResponse.json({ conversation });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    if (err instanceof SelfMessageError) return apiError(400, "INVALID_TARGET", err.message);
    if (err instanceof NotProError) return apiError(403, "PRO_REQUIRED", err.message);
    console.error("conversations POST: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not open this chat.");
  }
}
