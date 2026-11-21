import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendPushToUsers } from "@slotbook/push";
import { prisma } from "@/lib/db";
import { getOptionalUser, requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError, apiValidationError } from "@/lib/api-response";
import {
  findOrCreateDirectConversation,
  NotProError,
  SelfMessageError,
  sendBlockReason,
} from "@/lib/direct-conversation";

const EXTERNAL_SHARE_CHANNELS = [
  "copy",
  "native",
  "whatsapp",
  "x",
  "telegram",
  "facebook",
  "linkedin",
  "email",
  "sms",
] as const;

const shareSchema = z.union([
  // Shared outside the app (copy link, OS share sheet, or a specific app).
  z.object({ channel: z.enum(EXTERNAL_SHARE_CHANNELS) }),
  // Sent to people on the platform as a chat message.
  z.object({
    recipientIds: z.array(z.string().cuid()).min(1).max(20),
    note: z.string().trim().max(500).optional(),
  }),
]);

async function findConversationWith(userId: string, otherUserId: string) {
  // Same lookup as GET /api/users/[id]/conversation: any existing thread first,
  // then a direct one (a message request unless the sender is PRO).
  const existing = await prisma.conversation.findFirst({
    where: {
      OR: [
        { buyerId: userId, bidderId: otherUserId },
        { buyerId: otherUserId, bidderId: userId },
      ],
    },
    select: { id: true, status: true, buyerId: true, bidderId: true },
    orderBy: { createdAt: "desc" },
  });
  return existing ?? findOrCreateDirectConversation(userId, otherUserId);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
    }
    const parsed = shareSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const post = await prisma.forumMessage.findUnique({
      where: { id },
      select: { deletedAt: true, text: true, sender: { select: { name: true, companyName: true } } },
    });
    if (!post || post.deletedAt) return apiError(404, "NOT_FOUND", "This post doesn't exist.");

    // External share: counted for anyone, signed in or not.
    if ("channel" in parsed.data) {
      const viewer = await getOptionalUser();
      await prisma.forumShare.create({ data: { postId: id, userId: viewer?.id ?? null, channel: parsed.data.channel } });
      const shareCount = await prisma.forumShare.count({ where: { postId: id } });
      return NextResponse.json({ ok: true, shareCount });
    }

    // In-app send: one chat message per recipient.
    const user = await requireUser();
    const { recipientIds, note } = parsed.data;
    const link = `${new URL(req.url).origin}/forum/${id}`;
    const text = note ? `${note}\n${link}` : link;
    const author = post.sender.companyName ?? post.sender.name;

    const sent: string[] = [];
    const failed: Array<{ userId: string; reason: string }> = [];

    for (const recipientId of [...new Set(recipientIds)]) {
      try {
        const conversation = await findConversationWith(user.id, recipientId);
        if (!conversation) {
          failed.push({ userId: recipientId, reason: "This user doesn't exist." });
          continue;
        }
        const blocked = sendBlockReason(conversation, user.id);
        if (blocked) {
          failed.push({
            userId: recipientId,
            reason:
              blocked === "REQUEST_DECLINED"
                ? "They declined your message request."
                : "Accept their message request first.",
          });
          continue;
        }
        await prisma.$transaction([
          prisma.message.create({ data: { conversationId: conversation.id, senderId: user.id, text } }),
          prisma.forumShare.create({ data: { postId: id, userId: user.id, channel: "dm" } }),
        ]);
        sent.push(recipientId);

        void sendPushToUsers(recipientId, {
          title:
            conversation.status === "PENDING"
              ? `Message request from ${user.name ?? "someone"}`
              : user.name ?? "New message",
          body: `Shared a post by ${author}`,
          url: `/chats/${conversation.id}`,
          tag: `chat-${conversation.id}`,
          category: "chatMessages",
          data: { type: "chat_message", conversationId: conversation.id },
        }).catch(() => {});
      } catch (err) {
        if (err instanceof NotProError) {
          failed.push({ userId: recipientId, reason: "Upgrade to PRO to message people you haven't chatted with." });
        } else if (err instanceof SelfMessageError) {
          failed.push({ userId: recipientId, reason: err.message });
        } else {
          throw err;
        }
      }
    }

    const shareCount = await prisma.forumShare.count({ where: { postId: id } });
    return NextResponse.json({ ok: sent.length > 0, sent, failed, shareCount });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("forum/[id]/share POST: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not share this post.");
  }
}
