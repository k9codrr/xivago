"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { publicEnv } from "@/lib/env";

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  createdAt: string;
  readAt: string | null;
  deliveredAt?: string | null;
  forwarded?: boolean;
  deletedAt?: string | null;
  replyToId: string | null;
  replyTo: { id: string; text: string; senderId: string; deletedAt?: string | null } | null;
  attachments: Array<{ id: string; url: string; contentType: string }>;
  reactions: Array<{ userId: string; emoji: string }>;
  /** Client-only: still on its way to the server (clock icon). */
  pending?: boolean;
}

export interface SendMessageInput {
  text: string;
  replyToId?: string;
  attachmentUrl?: string;
  attachmentContentType?: string;
  forwarded?: boolean;
}

export interface PeerPresence {
  online: boolean;
  lastSeenAt: string | null;
}

export interface ConversationSocketHandlers {
  onMessage: (message: ChatMessage) => void;
  onRead: (readerId: string, readAt: string) => void;
  onReaction: (messageId: string, userId: string, emoji: string | null) => void;
  onTyping?: (userId: string) => void;
  onDelivered?: (recipientId: string, deliveredAt: string) => void;
  onDeleted?: (messageId: string, deletedAt: string) => void;
  onPresence?: (presence: PeerPresence) => void;
}

interface UseConversationSocketResult {
  connected: boolean;
  readOnly: boolean;
  sendMessage: (input: SendMessageInput) => Promise<ChatMessage | { error: string } | null>;
  /** Sends into another conversation the viewer is part of (used by Forward). */
  sendTo: (conversationId: string, input: SendMessageInput) => Promise<ChatMessage | { error: string } | null>;
  markRead: () => void;
  react: (messageId: string, emoji: string) => void;
  unreact: (messageId: string) => void;
  deleteForEveryone: (messageId: string) => Promise<boolean>;
  notifyTyping: () => void;
}

/** Socket.IO calls this on every (re)connect, so a reconnect never reuses an expired 60s token. */
export function socketAuth(cb: (data: { token?: string }) => void) {
  fetch("/api/realtime/token")
    .then((r) => (r.ok ? r.json() : {}))
    .then((j: { token?: string }) => cb({ token: j.token }))
    .catch(() => cb({}));
}

/**
 * Owns the whole realtime lifecycle for one conversation: connect (fresh
 * handshake token per attempt), join the room, and wire message / read /
 * delivered / reaction / delete / presence events into the caller's state.
 * One socket per mounted chat window -- disconnects on unmount.
 */
export function useConversationSocket(
  conversationId: string,
  handlers: ConversationSocketHandlers,
): UseConversationSocketResult {
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const [connected, setConnected] = useState(false);
  const [readOnly, setReadOnly] = useState(false);

  useEffect(() => {
    const socket = io(publicEnv.NEXT_PUBLIC_SOCKET_URL, {
      auth: socketAuth,
      transports: ["websocket"],
    });
    socketRef.current = socket;
    const h = () => handlersRef.current;
    const mine = (p: { conversationId: string }) => p.conversationId === conversationId;

    socket.on("connect", () => {
      setConnected(true);
      socket.emit(
        "join",
        { conversationId },
        (res: { ok: boolean; readOnly?: boolean; peer?: { online: boolean; lastSeenAt: string | null } }) => {
          if (!res.ok) return;
          setReadOnly(Boolean(res.readOnly));
          if (res.peer) h().onPresence?.({ online: res.peer.online, lastSeenAt: res.peer.lastSeenAt });
        },
      );
    });
    socket.on("disconnect", () => setConnected(false));

    socket.on("message", (p: { conversationId: string; message: ChatMessage }) => {
      if (mine(p)) h().onMessage(p.message);
    });
    socket.on("read", (p: { conversationId: string; readerId: string; readAt: string }) => {
      if (mine(p)) h().onRead(p.readerId, p.readAt);
    });
    socket.on("delivered", (p: { conversationId: string; recipientId: string; deliveredAt: string }) => {
      if (mine(p)) h().onDelivered?.(p.recipientId, p.deliveredAt);
    });
    socket.on("reaction", (p: { conversationId: string; messageId: string; userId: string; emoji: string }) => {
      if (mine(p)) h().onReaction(p.messageId, p.userId, p.emoji);
    });
    socket.on("reaction-removed", (p: { conversationId: string; messageId: string; userId: string }) => {
      if (mine(p)) h().onReaction(p.messageId, p.userId, null);
    });
    socket.on("typing", (p: { conversationId: string; userId: string }) => {
      if (mine(p)) h().onTyping?.(p.userId);
    });
    socket.on("deleted", (p: { conversationId: string; messageId: string; deletedAt: string }) => {
      if (mine(p)) h().onDeleted?.(p.messageId, p.deletedAt);
    });
    socket.on("presence", (p: { userId: string; online: boolean; lastSeenAt: string | null }) => {
      h().onPresence?.({ online: p.online, lastSeenAt: p.lastSeenAt });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [conversationId]);

  function emitMessage(targetId: string, input: SendMessageInput): Promise<ChatMessage | { error: string } | null> {
    const socket = socketRef.current;
    if (!socket?.connected) return Promise.resolve({ error: "OFFLINE" });
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve({ error: "TIMEOUT" }), 20000);
      socket.emit(
        "message",
        { conversationId: targetId, ...input },
        (res: { ok: boolean; message?: ChatMessage; error?: string }) => {
          clearTimeout(timer);
          resolve(res.ok && res.message ? res.message : { error: res.error ?? "SEND_FAILED" });
        },
      );
    });
  }

  return {
    connected,
    readOnly,
    sendMessage: (input) => emitMessage(conversationId, input),
    sendTo: (targetId, input) => emitMessage(targetId, input),
    markRead: () => socketRef.current?.emit("read", { conversationId }),
    react: (messageId, emoji) => socketRef.current?.emit("react", { conversationId, messageId, emoji }),
    unreact: (messageId) => socketRef.current?.emit("unreact", { conversationId, messageId }),
    deleteForEveryone: (messageId) =>
      new Promise((resolve) => {
        const socket = socketRef.current;
        if (!socket?.connected) return resolve(false);
        socket.emit("delete", { conversationId, messageId }, (res: { ok: boolean }) => resolve(Boolean(res?.ok)));
      }),
    notifyTyping: () => socketRef.current?.emit("typing", { conversationId }),
  };
}
