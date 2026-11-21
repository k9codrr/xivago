import { createServer } from "node:http";
import { Server, type Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { prisma } from "@slotbook/db";
import { sendPushToUsers } from "@slotbook/push";
import { isImageSafe } from "./moderation.js";

const PORT = Number(process.env.SOCKET_PORT ?? 3001);
const JWT_SECRET = process.env.SOCKET_JWT_SECRET;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

if (!JWT_SECRET) {
  console.error(
    "FATAL: SOCKET_JWT_SECRET is not set. This must match the same variable " +
      "in apps/web's environment -- see .env.example.",
  );
  process.exit(1);
}

interface HandshakeTokenPayload {
  sub: string; // userId
  role: "VENDOR" | "BUSINESS" | "ADMIN";
}

interface SocketData {
  userId: string;
  isAdmin: boolean;
}

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
} as const;

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: { origin: APP_URL, credentials: true },
});

/**
 * JWT handshake auth (section 3.5: "Realtime rooms conversation:{id}, JWT
 * handshake auth"). apps/web mints a short-lived (60s) token via
 * POST /api/realtime/token after verifying the caller's NextAuth session --
 * this server never talks to NextAuth directly, it just verifies the token
 * apps/web already vouched for.
 */
io.use((socket, next) => {
  const token = socket.handshake.auth?.token as string | undefined;
  if (!token) return next(new Error("UNAUTHORIZED"));

  try {
    const payload = jwt.verify(token, JWT_SECRET as string) as HandshakeTokenPayload;
    (socket.data as SocketData) = { userId: payload.sub, isAdmin: payload.role === "ADMIN" };
    next();
  } catch {
    next(new Error("UNAUTHORIZED"));
  }
});

function roomName(conversationId: string): string {
  return `conversation:${conversationId}`;
}

function presenceRoom(userId: string): string {
  return `presence:${userId}`;
}

// ── Presence ────────────────────────────────────────────────────────────────
// Live sockets per user (a user can have several: the app-wide presence
// socket plus any open chat window, on more than one device). Online = > 0.
const liveSockets = new Map<string, number>();

function isOnline(userId: string): boolean {
  return (liveSockets.get(userId) ?? 0) > 0;
}

async function setLastSeen(userId: string, at: Date) {
  try {
    await prisma.user.update({ where: { id: userId }, data: { lastSeenAt: at } });
  } catch (err) {
    console.error("setLastSeen: failed (non-fatal)", { userId, err });
  }
}

/**
 * The user just came online: everything sent to them while they were away is
 * now on their device -> double grey tick for the senders, live.
 */
async function deliverPending(userId: string) {
  try {
    const pending = await prisma.message.findMany({
      where: {
        deliveredAt: null,
        senderId: { not: userId },
        conversation: { OR: [{ buyerId: userId }, { bidderId: userId }] },
      },
      select: { conversationId: true },
      distinct: ["conversationId"],
      take: 500,
    });
    if (pending.length === 0) return;
    const deliveredAt = new Date();
    const conversationIds = pending.map((p) => p.conversationId);
    await prisma.message.updateMany({
      where: { conversationId: { in: conversationIds }, senderId: { not: userId }, deliveredAt: null },
      data: { deliveredAt },
    });
    for (const conversationId of conversationIds) {
      io.to(roomName(conversationId)).emit("delivered", { conversationId, recipientId: userId, deliveredAt });
    }
  } catch (err) {
    console.error("deliverPending: failed (non-fatal)", { userId, err });
  }
}

async function getMembership(conversationId: string, userId: string, isAdmin: boolean) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, buyerId: true, bidderId: true, status: true },
  });
  if (!conversation) return { conversation: null, isParticipant: false, readOnly: false };

  const isParticipant = conversation.buyerId === userId || conversation.bidderId === userId;
  // Section 3.5: "Server enforces: only the 2 participants read/write; admin read-only."
  const allowed = isParticipant || isAdmin;
  const readOnly = isAdmin && !isParticipant;
  return { conversation: allowed ? conversation : null, isParticipant, readOnly };
}

type Gate = { status: "ACTIVE" | "PENDING" | "DECLINED"; buyerId: string; bidderId: string };

/**
 * Message requests (same rule as sendBlockReason in apps/web/src/lib/direct-conversation.ts):
 * on a PENDING request only the sender (buyerId) may post; the recipient has
 * to accept first. A DECLINED request is closed to both sides.
 */
function sendBlockReason(conversation: Gate, userId: string) {
  if (conversation.status === "DECLINED") return "REQUEST_DECLINED";
  if (conversation.status === "PENDING" && conversation.bidderId === userId) return "REQUEST_NOT_ACCEPTED";
  return null;
}

function describeAttachment(contentType: string | undefined): string {
  if (contentType?.startsWith("image/")) return "📷 Photo";
  if (contentType?.startsWith("video/")) return "🎥 Video";
  return "📎 Attachment";
}

/**
 * Push the recipient about a new message -- unless they already have this
 * conversation open (a socket of theirs is in the room), in which case the
 * live socket event is enough. Never throws.
 */
async function pushChatMessage(
  conversationId: string,
  senderId: string,
  recipientId: string,
  text: string,
  attachmentContentType: string | undefined,
  isRequest: boolean,
): Promise<void> {
  try {
    const sockets = await io.in(roomName(conversationId)).fetchSockets();
    if (sockets.some((s) => (s.data as SocketData).userId === recipientId)) return;

    const sender = await prisma.user.findUnique({ where: { id: senderId }, select: { name: true } });
    const preview = text || describeAttachment(attachmentContentType);

    await sendPushToUsers(recipientId, {
      title: isRequest ? `Message request from ${sender?.name ?? "someone"}` : sender?.name ?? "New message",
      body: preview.length > 140 ? `${preview.slice(0, 139)}…` : preview,
      url: `/chats/${conversationId}`,
      tag: `chat-${conversationId}`,
      category: "chatMessages",
      data: { type: "chat_message", conversationId },
    });
  } catch (err) {
    console.error("pushChatMessage: failed (non-fatal)", { conversationId, err });
  }
}

io.on("connection", (socket: Socket) => {
  const { userId, isAdmin } = socket.data as SocketData;

  const before = liveSockets.get(userId) ?? 0;
  liveSockets.set(userId, before + 1);
  if (before === 0) {
    const now = new Date();
    io.to(presenceRoom(userId)).emit("presence", { userId, online: true, lastSeenAt: now });
    void setLastSeen(userId, now);
    void deliverPending(userId);
  }

  socket.on("disconnect", () => {
    const left = (liveSockets.get(userId) ?? 1) - 1;
    if (left > 0) {
      liveSockets.set(userId, left);
      return;
    }
    liveSockets.delete(userId);
    const now = new Date();
    io.to(presenceRoom(userId)).emit("presence", { userId, online: false, lastSeenAt: now });
    void setLastSeen(userId, now);
  });

  /**
   * Subscribe to online / last-seen updates for people the viewer has a chat
   * with (chat list + chat header). Only conversation partners can be watched,
   * so this can't be used to track arbitrary users.
   */
  socket.on("presence:watch", async (payload: { userIds?: string[] }, ack?: (res: unknown) => void) => {
    const requested = [...new Set((payload?.userIds ?? []).filter((id) => typeof id === "string"))].slice(0, 200);
    if (requested.length === 0) return ack?.({ ok: true, statuses: {} });
    const partners = await prisma.conversation.findMany({
      where: {
        OR: [
          { buyerId: userId, bidderId: { in: requested } },
          { bidderId: userId, buyerId: { in: requested } },
        ],
      },
      select: { buyerId: true, bidderId: true },
    });
    const allowed = new Set(partners.map((c) => (c.buyerId === userId ? c.bidderId : c.buyerId)));
    const users = await prisma.user.findMany({
      where: { id: { in: [...allowed] } },
      select: { id: true, lastSeenAt: true },
    });
    const statuses: Record<string, { online: boolean; lastSeenAt: Date | null }> = {};
    for (const u of users) {
      await socket.join(presenceRoom(u.id));
      statuses[u.id] = { online: isOnline(u.id), lastSeenAt: u.lastSeenAt };
    }
    ack?.({ ok: true, statuses });
  });

  socket.on("leave", async (payload: { conversationId?: string }) => {
    if (payload?.conversationId) await socket.leave(roomName(payload.conversationId));
  });

  /** "Delete for everyone" -- only the sender, and only their own message. */
  socket.on(
    "delete",
    async (payload: { conversationId?: string; messageId?: string }, ack?: (res: unknown) => void) => {
      const { conversationId, messageId } = payload ?? {};
      if (!conversationId || !messageId) return ack?.({ ok: false, error: "INVALID_PAYLOAD" });
      const { conversation, isParticipant } = await getMembership(conversationId, userId, isAdmin);
      if (!conversation || !isParticipant) return ack?.({ ok: false, error: "FORBIDDEN" });
      const message = await prisma.message.findUnique({
        where: { id: messageId },
        select: { conversationId: true, senderId: true, deletedAt: true },
      });
      if (!message || message.conversationId !== conversationId) return ack?.({ ok: false, error: "NOT_FOUND" });
      if (message.senderId !== userId) return ack?.({ ok: false, error: "FORBIDDEN" });
      const deletedAt = message.deletedAt ?? new Date();
      if (!message.deletedAt) {
        await prisma.$transaction([
          prisma.message.update({ where: { id: messageId }, data: { deletedAt, text: "" } }),
          prisma.messageAttachment.deleteMany({ where: { messageId } }),
          prisma.messageReaction.deleteMany({ where: { messageId } }),
        ]);
      }
      io.to(roomName(conversationId)).emit("deleted", { conversationId, messageId, deletedAt });
      ack?.({ ok: true });
    },
  );

  socket.on("join", async (payload: { conversationId?: string }, ack?: (res: unknown) => void) => {
    const conversationId = payload?.conversationId;
    if (!conversationId) return ack?.({ ok: false, error: "MISSING_CONVERSATION_ID" });

    const { conversation, readOnly } = await getMembership(conversationId, userId, isAdmin);
    if (!conversation) return ack?.({ ok: false, error: "FORBIDDEN" });

    await socket.join(roomName(conversationId));
    const peerId = conversation.buyerId === userId ? conversation.bidderId : conversation.buyerId;
    const peer = await prisma.user.findUnique({ where: { id: peerId }, select: { lastSeenAt: true } });
    await socket.join(presenceRoom(peerId));
    ack?.({ ok: true, readOnly, peer: { id: peerId, online: isOnline(peerId), lastSeenAt: peer?.lastSeenAt ?? null } });
  });

  socket.on(
    "message",
    async (
      payload: {
        conversationId?: string;
        text?: string;
        replyToId?: string;
        attachmentUrl?: string;
        attachmentContentType?: string;
        forwarded?: boolean;
      },
      ack?: (res: unknown) => void,
    ) => {
      const conversationId = payload?.conversationId;
      const text = payload?.text?.trim() ?? "";
      const hasAttachment = Boolean(payload?.attachmentUrl);
      if (!conversationId || (!text && !hasAttachment)) return ack?.({ ok: false, error: "INVALID_PAYLOAD" });
      if (text.length > 4000) return ack?.({ ok: false, error: "MESSAGE_TOO_LONG" });

      const { conversation, isParticipant } = await getMembership(conversationId, userId, isAdmin);
      if (!conversation) return ack?.({ ok: false, error: "FORBIDDEN" });
      if (!isParticipant) return ack?.({ ok: false, error: "ADMIN_READ_ONLY" });
      const blocked = sendBlockReason(conversation, userId);
      if (blocked) return ack?.({ ok: false, error: blocked });

      // Reply target, if any, must belong to this same conversation -- a
      // client can't make a message appear to reply into a different
      // conversation by passing an arbitrary id.
      let replyToId: string | undefined;
      if (payload.replyToId) {
        const target = await prisma.message.findUnique({
          where: { id: payload.replyToId },
          select: { conversationId: true },
        });
        if (target?.conversationId === conversationId) replyToId = payload.replyToId;
      }

      // Fail-open image check -- see moderation.ts doc comment / DECISIONS.md #50.
      // Only images go through this; video/PDF attachments skip it entirely.
      if (hasAttachment && payload.attachmentUrl && payload.attachmentContentType?.startsWith("image/")) {
        const safe = await isImageSafe(payload.attachmentUrl);
        if (!safe) return ack?.({ ok: false, error: "IMAGE_MODERATION_FAILED" });
      }

      const recipientId = conversation.buyerId === userId ? conversation.bidderId : conversation.buyerId;
      const message = await prisma.message.create({
        data: {
          conversationId,
          senderId: userId,
          text,
          replyToId,
          forwarded: Boolean(payload.forwarded),
          // Recipient has the app open somewhere -> it lands on their device right now.
          deliveredAt: isOnline(recipientId) ? new Date() : null,
          ...(hasAttachment && payload.attachmentUrl && payload.attachmentContentType
            ? { attachments: { create: { url: payload.attachmentUrl, contentType: payload.attachmentContentType } } }
            : {}),
        },
        select: MESSAGE_SELECT,
      });

      const shaped = { ...message, reactions: [] as Array<{ userId: string; emoji: string }> };
      io.to(roomName(conversationId)).emit("message", { conversationId, message: shaped });
      ack?.({ ok: true, message: shaped });

      void pushChatMessage(
        conversationId,
        userId,
        recipientId,
        text,
        payload.attachmentContentType,
        conversation.status === "PENDING",
      );
    },
  );

  socket.on(
    "react",
    async (payload: { conversationId?: string; messageId?: string; emoji?: string }, ack?: (res: unknown) => void) => {
      const { conversationId, messageId, emoji } = payload ?? {};
      if (!conversationId || !messageId || !emoji) return ack?.({ ok: false, error: "INVALID_PAYLOAD" });
      // Free-text column (see schema.prisma comment) -- any single emoji is
      // allowed now that the client has a full picker, not just the curated
      // quick-react set. Still bounded so this can't become a text field.
      if (emoji.length > 8) return ack?.({ ok: false, error: "INVALID_EMOJI" });

      const { conversation, isParticipant } = await getMembership(conversationId, userId, isAdmin);
      if (!conversation || !isParticipant) return ack?.({ ok: false, error: "FORBIDDEN" });
      const blocked = sendBlockReason(conversation, userId);
      if (blocked) return ack?.({ ok: false, error: blocked });

      const message = await prisma.message.findUnique({ where: { id: messageId }, select: { conversationId: true } });
      if (message?.conversationId !== conversationId) return ack?.({ ok: false, error: "NOT_FOUND" });

      await prisma.messageReaction.upsert({
        where: { messageId_userId: { messageId, userId } },
        update: { emoji },
        create: { messageId, userId, emoji },
      });

      io.to(roomName(conversationId)).emit("reaction", { conversationId, messageId, userId, emoji });
      ack?.({ ok: true });
    },
  );

  socket.on(
    "unreact",
    async (payload: { conversationId?: string; messageId?: string }, ack?: (res: unknown) => void) => {
      const { conversationId, messageId } = payload ?? {};
      if (!conversationId || !messageId) return ack?.({ ok: false, error: "INVALID_PAYLOAD" });

      const { conversation, isParticipant } = await getMembership(conversationId, userId, isAdmin);
      if (!conversation || !isParticipant) return ack?.({ ok: false, error: "FORBIDDEN" });

      await prisma.messageReaction.deleteMany({ where: { messageId, userId } });
      io.to(roomName(conversationId)).emit("reaction-removed", { conversationId, messageId, userId });
      ack?.({ ok: true });
    },
  );

  socket.on("read", async (payload: { conversationId?: string }, ack?: (res: unknown) => void) => {
    const conversationId = payload?.conversationId;
    if (!conversationId) return ack?.({ ok: false, error: "MISSING_CONVERSATION_ID" });

    const { conversation, isParticipant } = await getMembership(conversationId, userId, isAdmin);
    if (!conversation || !isParticipant) return ack?.({ ok: false, error: "FORBIDDEN" });
    // Looking at a request you haven't accepted doesn't tell the sender you saw it.
    if (sendBlockReason(conversation, userId)) return ack?.({ ok: true });

    const readAt = new Date();
    // Read implies delivered (covers messages that arrived while the reader was offline).
    await prisma.message.updateMany({
      where: { conversationId, senderId: { not: userId }, deliveredAt: null },
      data: { deliveredAt: readAt },
    });
    await prisma.message.updateMany({
      where: { conversationId, senderId: { not: userId }, readAt: null },
      data: { readAt },
    });

    io.to(roomName(conversationId)).emit("read", { conversationId, readerId: userId, readAt });
    ack?.({ ok: true });
  });

  // Ephemeral -- no DB write, no ack needed. `socket.to()` (not `io.to()`)
  // so the typer doesn't see their own indicator.
  socket.on("typing", async (payload: { conversationId?: string }) => {
    const conversationId = payload?.conversationId;
    if (!conversationId) return;

    const { conversation, isParticipant } = await getMembership(conversationId, userId, isAdmin);
    if (!conversation || !isParticipant || sendBlockReason(conversation, userId)) return;

    socket.to(roomName(conversationId)).emit("typing", { conversationId, userId });
  });
});

httpServer.listen(PORT, () => {
  console.log(`SlotBook realtime server listening on :${PORT}`);
});
