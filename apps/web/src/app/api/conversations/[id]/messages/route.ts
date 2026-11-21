import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError, apiValidationError } from "@/lib/api-response";

const querySchema = z.object({
  cursor: z.string().cuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

const MESSAGE_SELECT = {
  id: true,
  senderId: true,
  text: true,
  createdAt: true,
  readAt: true,
  deliveredAt: true,
  forwarded: true,
  deletedAt: true,
  replyToId: true,
  replyTo: { select: { id: true, text: true, senderId: true, deletedAt: true } },
  attachments: { select: { id: true, url: true, contentType: true } },
  reactions: { select: { userId: true, emoji: true } },
} as const;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id: conversationId } = await params;

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true, buyerId: true, bidderId: true },
    });
    if (!conversation) return apiError(404, "NOT_FOUND", "This chat doesn't exist.");

    const isParticipant = conversation.buyerId === user.id || conversation.bidderId === user.id;
    if (!isParticipant && !user.isAdmin) {
      return apiError(403, "FORBIDDEN", "You're not part of this chat.");
    }

    const url = new URL(req.url);
    const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) return apiValidationError(parsed.error);
    const { cursor, limit } = parsed.data;

    // Newest-first pages for infinite-scroll-up history loading; the client
    // reverses each page before rendering so messages read top-to-bottom.
    const messages = await prisma.message.findMany({
      where: { conversationId },
      select: MESSAGE_SELECT,
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = messages.length > limit;
    const page = hasMore ? messages.slice(0, limit) : messages;

    return NextResponse.json({
      messages: page,
      nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("conversations/messages: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not load messages.");
  }
}
