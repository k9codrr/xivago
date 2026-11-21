import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendPushToUsers } from "@slotbook/push";
import { prisma } from "@/lib/db";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError, apiValidationError } from "@/lib/api-response";

const bodySchema = z.object({ action: z.enum(["accept", "decline"]) });

/**
 * Accept or decline a message request. Only the recipient (`bidderId` on a
 * request) can answer, and only while it is still PENDING. Accepting turns it
 * into a normal direct chat; declining closes it to both sides.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id: conversationId } = await params;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
    }
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);
    const accept = parsed.data.action === "accept";

    // Conditional update so a double tap, or answering an already-answered
    // request, can't flip the status twice.
    const { count } = await prisma.conversation.updateMany({
      where: { id: conversationId, bidderId: user.id, status: "PENDING" },
      data: accept ? { status: "ACTIVE", acceptedAt: new Date() } : { status: "DECLINED" },
    });
    if (count === 0) {
      return apiError(404, "NOT_FOUND", "This message request doesn't exist or has already been answered.");
    }

    if (accept) {
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { buyerId: true },
      });
      if (conversation) {
        void sendPushToUsers(conversation.buyerId, {
          title: user.name ?? "Message request accepted",
          body: "Accepted your message request. You can chat now.",
          url: `/chats/${conversationId}`,
          tag: `chat-${conversationId}`,
          category: "chatMessages",
          data: { type: "chat_message", conversationId },
        }).catch(() => {});
      }
    }

    return NextResponse.json({ ok: true, status: accept ? "ACTIVE" : "DECLINED" });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("conversations/request POST: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not answer this message request.");
  }
}
