import "server-only";
import { prisma } from "@/lib/db";
import { isPro } from "@slotbook/db";

/** No longer thrown -- non-PRO senders now open a message request instead. Kept so existing catches compile. */
export class NotProError extends Error {
  constructor() {
    super("Upgrade to PRO to message anyone without taking a response spot first.");
    this.name = "NotProError";
  }
}

export class SelfMessageError extends Error {
  constructor() {
    super("You can't message yourself.");
    this.name = "SelfMessageError";
  }
}

type ConversationGate = { status: "ACTIVE" | "PENDING" | "DECLINED"; buyerId: string; bidderId: string };

/**
 * Why `userId` may not post in this conversation right now, or null if they
 * may. On a message request the sender is `buyerId` and the recipient is
 * `bidderId`: the recipient has to accept before replying, and a declined
 * request is closed to both sides. Mirrored in apps/realtime/src/index.ts.
 */
export function sendBlockReason(conversation: ConversationGate, userId: string) {
  if (conversation.status === "DECLINED") return "REQUEST_DECLINED" as const;
  if (conversation.status === "PENDING" && conversation.bidderId === userId) return "REQUEST_NOT_ACCEPTED" as const;
  return null;
}

/**
 * Finds or creates a demand-less ("direct") conversation between two users.
 * `demandId` stays null on these rows. A PRO requester opens a normal chat
 * straight away; anyone else opens a message request (status PENDING) that
 * the other person has to accept before it becomes a normal chat. Shared by
 * the "Message" button on a public profile, `POST /api/conversations`'s
 * `targetUserId` shape and in-app post sharing, so all three agree on what
 * counts as an existing thread (checked in both buyer/bidder orientations).
 */
export async function findOrCreateDirectConversation(requesterId: string, targetUserId: string) {
  if (requesterId === targetUserId) throw new SelfMessageError();

  const select = { id: true, status: true, buyerId: true, bidderId: true } as const;

  const existing = await prisma.conversation.findFirst({
    where: {
      demandId: null,
      OR: [
        { buyerId: requesterId, bidderId: targetUserId },
        { buyerId: targetUserId, bidderId: requesterId },
      ],
    },
    select,
  });
  if (existing) return existing;

  const [requester, target] = await Promise.all([
    prisma.user.findUnique({ where: { id: requesterId }, select: { subscription: true } }),
    prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true } }),
  ]);
  if (!target) return null;

  return prisma.conversation.create({
    data: {
      demandId: null,
      buyerId: requesterId,
      bidderId: targetUserId,
      status: isPro(requester?.subscription) ? "ACTIVE" : "PENDING",
    },
    select,
  });
}
