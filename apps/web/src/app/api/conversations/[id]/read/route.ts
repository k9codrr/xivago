import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError } from "@/lib/api-response";
import { sendBlockReason } from "@/lib/direct-conversation";

/**
 * REST fallback for marking a conversation read -- mirrors the Socket.IO
 * "read" event handler in apps/realtime (same rule, same effect), for
 * clients that haven't established a socket connection yet (e.g. opening
 * the chat list, or a page load before the socket handshake completes).
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id: conversationId } = await params;

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { buyerId: true, bidderId: true, status: true },
    });
    if (!conversation) return apiError(404, "NOT_FOUND", "This chat doesn't exist.");

    const isParticipant = conversation.buyerId === user.id || conversation.bidderId === user.id;
    if (!isParticipant) return apiError(403, "FORBIDDEN", "You're not part of this chat.");
    // Looking at a request you haven't accepted doesn't tell the sender you saw it.
    if (sendBlockReason(conversation, user.id)) return NextResponse.json({ ok: true, readAt: null });

    const readAt = new Date();
    await prisma.message.updateMany({
      where: { conversationId, senderId: { not: user.id }, deliveredAt: null },
      data: { deliveredAt: readAt },
    });
    await prisma.message.updateMany({
      where: { conversationId, senderId: { not: user.id }, readAt: null },
      data: { readAt },
    });

    return NextResponse.json({ ok: true, readAt });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("conversations/read: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not mark this chat as read.");
  }
}
