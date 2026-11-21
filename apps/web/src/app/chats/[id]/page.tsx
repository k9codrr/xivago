"use client";

/*
 * Chat window. Earlier designs (Instagram DM style, Apple Messages style)
 * live in git history -- see this file before commit "Chat: pro redesign".
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, use as usePromise, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowDown,
  BadgeCheck,
  Camera,
  ChevronLeft,
  ClipboardCheck,
  FileText,
  Image as ImageIcon,
  Loader2,
  Lock,
  Paperclip,
  Reply as ReplyIcon,
  Send,
  ShieldAlert,
  Smile,
  Star,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useConversationSocket, type ChatMessage, type PeerPresence } from "@/lib/use-conversation-socket";
import { RateUserModal } from "@/components/rate-user-modal";
import { DealCheckInDrawer, type CheckInData } from "@/components/deal-checkin-drawer";
import { TierMark } from "@/components/tier-mark";
import type { TrustTierCode } from "@/lib/trust-labels";
import { EmojiPopover } from "@/components/emoji-popover";
import { ComposerTextarea } from "@/components/ui/composer-textarea";
import { formatLastSeen } from "@/lib/presence";
import { playSound } from "@/lib/sounds";
import { haptic } from "@/lib/haptics";
import { useVisualViewport } from "@/lib/use-visual-viewport";
import { PresenceAvatar, formatDayLabel } from "@/components/chat/chat-primitives";
import { MessageRow } from "@/components/chat/message-row";
import { MessageActions, type MessageAction } from "@/components/chat/message-actions";
import { MediaViewer, type ViewerItem } from "@/components/chat/media-viewer";
import { ChatProfilePanel } from "@/components/chat/chat-profile-panel";
import { ForwardSheet } from "@/components/chat/forward-sheet";
import {
  ALLOWED_IMAGE_TYPES,
  ALLOWED_VIDEO_TYPES,
  ALLOWED_DOCUMENT_TYPES,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  MAX_DOCUMENT_BYTES,
} from "@/lib/validation/upload";

interface ConversationHeader {
  id: string;
  demand: { id: string; summary: string; status: string } | null;
  otherParty: {
    id: string;
    name: string;
    avatarUrl: string | null;
    companyName: string | null;
    isVerified?: boolean;
    lastSeenAt?: string | null;
  };
  bidId: string | null;
  otherTier?: TrustTierCode;
  status: "ACTIVE" | "PENDING" | "DECLINED";
  requestedByMe: boolean;
}

/** New-run spacing: a different sender, or a pause longer than this. */
const GROUP_GAP_MS = 5 * 60 * 1000;
const PAGE = 40;

const ERROR_TEXT: Record<string, string> = {
  IMAGE_MODERATION_FAILED: "This image may violate our content guidelines.",
  REQUEST_DECLINED: "This message request was declined.",
  REQUEST_NOT_ACCEPTED: "Accept the request before replying.",
  OFFLINE: "You're offline. Reconnecting…",
  TIMEOUT: "Sending timed out. Please try again.",
};

/** PUT to the signed URL with progress (fetch can't report upload progress). */
function uploadWithProgress(url: string, file: File, onProgress: (p: number) => void): Promise<boolean> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
    xhr.onerror = () => resolve(false);
    xhr.send(file);
  });
}

export default function ChatWindowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: conversationId } = usePromise(params);
  const { data: session } = useSession();
  const router = useRouter();
  const viewport = useVisualViewport();
  const myId = session?.user?.id;

  const [header, setHeader] = useState<ConversationHeader | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const [attachPreview, setAttachPreview] = useState<string | null>(null);
  const [uploads, setUploads] = useState<Record<string, number>>({});
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [composerEmojiOpen, setComposerEmojiOpen] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [checkIn, setCheckIn] = useState<CheckInData | null>(null);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [presence, setPresence] = useState<PeerPresence | undefined>(undefined);
  const [answeringRequest, setAnsweringRequest] = useState(false);
  const [menu, setMenu] = useState<{ m: ChatMessage; rect: DOMRect; preview: ReactNode } | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [forwarding, setForwarding] = useState<ChatMessage | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [unseen, setUnseen] = useState(0);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const typingClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef(0);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const atBottomRef = useRef(true);
  atBottomRef.current = atBottom;
  const myIdRef = useRef(myId);
  myIdRef.current = myId;

  const peerName = header ? (header.otherParty.companyName ?? header.otherParty.name) : "";

  // ── Realtime ──────────────────────────────────────────────────────────────
  const { connected, readOnly, sendMessage, sendTo, markRead, react, unreact, deleteForEveryone, notifyTyping } =
    useConversationSocket(conversationId, {
      onMessage: (incoming) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === incoming.id)) return prev;
          // My own message echoed back before the ack: swap it in for the optimistic copy.
          if (incoming.senderId === myIdRef.current) {
            const i = prev.findIndex((m) => m.pending && m.text === incoming.text.trim() && m.attachments.length === incoming.attachments.length);
            if (i >= 0) {
              const next = [...prev];
              next[i] = incoming;
              return next;
            }
          }
          return [...prev, incoming];
        });
        if (incoming.senderId !== myIdRef.current) {
          setPeerTyping(false);
          if (document.visibilityState === "visible") playSound("receive");
          if (!atBottomRef.current) setUnseen((n) => n + 1);
        }
      },
      onRead: (readerId, readAt) =>
        setMessages((prev) =>
          prev.map((m) => (m.senderId !== readerId && !m.readAt ? { ...m, readAt, deliveredAt: m.deliveredAt ?? readAt } : m)),
        ),
      onDelivered: (recipientId, deliveredAt) =>
        setMessages((prev) => prev.map((m) => (m.senderId !== recipientId && !m.deliveredAt ? { ...m, deliveredAt } : m))),
      onReaction: (messageId, userId, emoji) =>
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== messageId) return m;
            const without = m.reactions.filter((r) => r.userId !== userId);
            return { ...m, reactions: emoji ? [...without, { userId, emoji }] : without };
          }),
        ),
      onDeleted: (messageId, deletedAt) =>
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id === messageId) return { ...m, deletedAt, text: "", attachments: [], reactions: [] };
            if (m.replyTo?.id === messageId) return { ...m, replyTo: { ...m.replyTo, deletedAt } };
            return m;
          }),
        ),
      onTyping: () => {
        setPeerTyping(true);
        if (typingClearRef.current) clearTimeout(typingClearRef.current);
        typingClearRef.current = setTimeout(() => setPeerTyping(false), 3500);
      },
      onPresence: setPresence,
    });

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const [listRes, historyRes] = await Promise.all([
        fetch("/api/conversations"),
        fetch(`/api/conversations/${conversationId}/messages?limit=${PAGE}`),
      ]);
      if (listRes.ok) {
        const { conversations } = await listRes.json();
        const h = conversations.find((c: ConversationHeader) => c.id === conversationId) ?? null;
        setHeader(h);
        if (h?.otherParty.lastSeenAt) setPresence((p) => p ?? { online: false, lastSeenAt: h.otherParty.lastSeenAt });
      }
      if (historyRes.ok) {
        const { messages: page, nextCursor: cursor } = await historyRes.json();
        setMessages([...page].reverse());
        setNextCursor(cursor);
      }
      setLoadingHistory(false);
    })();
  }, [conversationId]);

  // Land on the newest message, instantly, once history is in.
  useLayoutEffect(() => {
    if (loadingHistory) return;
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [loadingHistory]);

  // New messages: follow along when at the bottom (or when it's mine).
  const lastId = messages[messages.length - 1]?.id;
  const lastMine = messages[messages.length - 1]?.senderId === myId;
  useEffect(() => {
    if (loadingHistory) return;
    const el = scrollerRef.current;
    if (!el) return;
    if (atBottomRef.current || lastMine) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastId, peerTyping]);

  // Keyboard opened / closed: keep the latest message in view.
  useEffect(() => {
    const el = scrollerRef.current;
    if (el && atBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [viewport?.height]);

  // Read receipts: only while the chat is actually on screen.
  useEffect(() => {
    if (!connected) return;
    const sendRead = () => document.visibilityState === "visible" && markRead();
    sendRead();
    document.addEventListener("visibilitychange", sendRead);
    return () => document.removeEventListener("visibilitychange", sendRead);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, messages.length]);

  // Project check-in drawer.
  const bidId = header?.bidId ?? null;
  useEffect(() => {
    if (!bidId) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/deals/checkin?bidId=${bidId}`);
      if (!res.ok || cancelled) return;
      const { checkIn: data } = (await res.json()) as { checkIn: CheckInData };
      setCheckIn(data);
      if (data.due) timer = setTimeout(() => setCheckInOpen(true), 4000 + Math.random() * 8000);
    })();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [bidId]);

  async function loadOlder() {
    if (!nextCursor || loadingOlder) return;
    const el = scrollerRef.current;
    const before = el ? el.scrollHeight - el.scrollTop : 0;
    setLoadingOlder(true);
    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages?limit=${PAGE}&cursor=${nextCursor}`);
      if (!res.ok) return;
      const { messages: page, nextCursor: cursor } = await res.json();
      setMessages((prev) => [...[...page].reverse().filter((m: ChatMessage) => !prev.some((p) => p.id === m.id)), ...prev]);
      setNextCursor(cursor);
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - before;
      });
    } finally {
      setLoadingOlder(false);
    }
  }

  function onScroll() {
    const el = scrollerRef.current;
    if (!el) return;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (bottom !== atBottom) setAtBottom(bottom);
    if (bottom && unseen) setUnseen(0);
    if (el.scrollTop < 200) void loadOlder();
  }

  function scrollToBottom() {
    const el = scrollerRef.current;
    el?.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setUnseen(0);
  }

  // ── Composer ──────────────────────────────────────────────────────────────
  function handleDraftChange(value: string) {
    setDraft(value);
    const now = Date.now();
    if (value && now - lastTypingSentRef.current > 2000) {
      lastTypingSentRef.current = now;
      notifyTyping();
    }
  }

  function handleFileSelected(file: File) {
    const isImage = file.type in ALLOWED_IMAGE_TYPES;
    const isVideo = file.type in ALLOWED_VIDEO_TYPES;
    const isDocument = file.type in ALLOWED_DOCUMENT_TYPES;
    if (!isImage && !isVideo && !isDocument) {
      toast.error("Only images, videos, or PDFs are allowed.");
      return;
    }
    const maxBytes = isVideo ? MAX_VIDEO_BYTES : isDocument ? MAX_DOCUMENT_BYTES : MAX_IMAGE_BYTES;
    if (file.size > maxBytes) {
      toast.error(`File is too large — max ${Math.round(maxBytes / (1024 * 1024))}MB.`);
      return;
    }
    setAttachFile(file);
    setAttachPreview(isDocument ? null : URL.createObjectURL(file));
    setAttachMenuOpen(false);
  }

  function clearAttachment() {
    setAttachFile(null);
    setAttachPreview(null);
  }

  async function handleSend() {
    const text = draft.trim();
    if ((!text && !attachFile) || readOnly || !myId) return;

    const file = attachFile;
    const preview = attachPreview;
    const reply = replyTo;
    const tempId = `tmp-${Date.now()}`;
    const optimistic: ChatMessage = {
      id: tempId,
      senderId: myId,
      text,
      createdAt: new Date().toISOString(),
      readAt: null,
      deliveredAt: null,
      replyToId: reply?.id ?? null,
      replyTo: reply ? { id: reply.id, text: reply.text, senderId: reply.senderId } : null,
      attachments: file ? [{ id: `${tempId}-a`, url: preview ?? "", contentType: file.type }] : [],
      reactions: [],
      pending: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    setDraft("");
    setReplyTo(null);
    clearAttachment();
    playSound("send");
    void haptic("light");
    const drop = () => setMessages((prev) => prev.filter((m) => m.id !== tempId));

    let attachmentUrl: string | undefined;
    let attachmentContentType: string | undefined;
    if (file) {
      setUploads((u) => ({ ...u, [tempId]: 0 }));
      const signRes = await fetch("/api/uploads/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "chat", contentType: file.type, fileSizeBytes: file.size }),
      });
      const signData = await signRes.json().catch(() => ({}));
      const ok =
        signRes.ok &&
        (await uploadWithProgress(signData.uploadUrl, file, (p) => setUploads((u) => ({ ...u, [tempId]: p }))));
      setUploads((u) => {
        const rest = { ...u };
        delete rest[tempId];
        return rest;
      });
      if (!ok) {
        drop();
        toast.error(signData?.error?.message ?? "Upload failed. Please try again.");
        setDraft(text);
        return;
      }
      attachmentUrl = signData.publicUrl;
      attachmentContentType = file.type;
    }

    const sent = await sendMessage({ text, replyToId: reply?.id, attachmentUrl, attachmentContentType });
    if (!sent || "error" in sent) {
      drop();
      setDraft((d) => d || text);
      playSound("error");
      toast.error(ERROR_TEXT[sent && "error" in sent ? sent.error : ""] ?? "Could not send your message.");
      return;
    }
    setMessages((prev) => {
      const withoutTemp = prev.filter((m) => m.id !== tempId);
      return withoutTemp.some((m) => m.id === sent.id) ? withoutTemp : [...withoutTemp, sent];
    });
  }

  async function answerRequest(action: "accept" | "decline") {
    setAnsweringRequest(true);
    try {
      const res = await fetch(`/api/conversations/${conversationId}/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error?.message ?? "Could not answer this request.");
        return;
      }
      if (action === "decline") {
        toast.success("Request declined.");
        router.replace("/chats");
        return;
      }
      setHeader((h) => (h ? { ...h, status: "ACTIVE" } : h));
      markRead();
    } finally {
      setAnsweringRequest(false);
    }
  }

  // ── Message interactions ──────────────────────────────────────────────────
  const startReply = useCallback((m: ChatMessage) => {
    setReplyTo(m);
    requestAnimationFrame(() => textareaRef.current?.focus({ preventScroll: true }));
  }, []);

  const openMenu = useCallback((m: ChatMessage, rect: DOMRect, preview: ReactNode) => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    setMenu({ m, rect, preview });
  }, []);

  const mediaItems: ViewerItem[] = useMemo(
    () =>
      messages.flatMap((m) =>
        m.deletedAt || m.pending
          ? []
          : m.attachments
              .filter((a) => a.contentType.startsWith("image/") || a.contentType.startsWith("video/"))
              .map((a) => ({
                id: a.id,
                url: a.url,
                contentType: a.contentType,
                caption: m.text || undefined,
                meta: `${m.senderId === myId ? "You" : peerName} · ${new Date(m.createdAt).toLocaleString("en-IN", {
                  day: "numeric",
                  month: "short",
                  hour: "numeric",
                  minute: "2-digit",
                })}`,
              })),
      ),
    [messages, myId, peerName],
  );
  const mediaItemsRef = useRef(mediaItems);
  mediaItemsRef.current = mediaItems;

  const openMedia = useCallback((attachmentId: string) => {
    const i = mediaItemsRef.current.findIndex((x) => x.id === attachmentId);
    if (i >= 0) setViewerIndex(i);
  }, []);

  const jumpTo = useCallback((messageId: string) => {
    const el = rowRefs.current.get(messageId);
    if (!el) {
      toast("That message is further back — scroll up to load it.");
      return;
    }
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightId(messageId);
    setTimeout(() => setHighlightId((h) => (h === messageId ? null : h)), 1400);
  }, []);

  const registerRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) rowRefs.current.set(id, el);
    else rowRefs.current.delete(id);
  }, []);

  const onReactionsTap = useCallback(
    (m: ChatMessage) => {
      if (m.reactions.some((r) => r.userId === myIdRef.current)) {
        unreact(m.id);
        void haptic("light");
      } else {
        const el = rowRefs.current.get(m.id);
        if (el) openMenu(m, el.getBoundingClientRect(), null);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [openMenu],
  );

  async function handleAction(action: MessageAction) {
    const m = menu?.m;
    setMenu(null);
    if (!m) return;
    switch (action) {
      case "reply":
        startReply(m);
        break;
      case "copy":
        try {
          await navigator.clipboard.writeText(m.text);
          toast.success("Copied");
        } catch {
          toast.error("Couldn't copy.");
        }
        break;
      case "forward":
        setForwarding(m);
        break;
      case "save": {
        const a = m.attachments[0];
        if (a) window.open(a.url, "_blank", "noopener");
        break;
      }
      case "delete": {
        const ok = await deleteForEveryone(m.id);
        if (!ok) toast.error("Couldn't delete this message.");
        else void haptic("medium");
        break;
      }
    }
  }

  function handleReact(emoji: string) {
    const m = menu?.m;
    setMenu(null);
    if (!m) return;
    const mine = m.reactions.find((r) => r.userId === myId)?.emoji;
    if (mine === emoji) unreact(m.id);
    else react(m.id, emoji);
    playSound("pop");
    void haptic("light");
  }

  async function forwardTo(ids: string[]) {
    const m = forwarding;
    if (!m) return;
    const a = m.attachments[0];
    const results = await Promise.all(
      ids.map((id) =>
        id === conversationId
          ? sendMessage({ text: m.text, attachmentUrl: a?.url, attachmentContentType: a?.contentType, forwarded: true })
          : sendTo(id, { text: m.text, attachmentUrl: a?.url, attachmentContentType: a?.contentType, forwarded: true }),
      ),
    );
    const failed = results.filter((r) => !r || "error" in r).length;
    setForwarding(null);
    if (failed) toast.error(`Couldn't forward to ${failed} chat${failed === 1 ? "" : "s"}.`);
    else {
      playSound("send");
      toast.success(ids.length === 1 ? "Forwarded" : `Forwarded to ${ids.length} chats`);
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const canSend = draft.trim().length > 0 || attachFile !== null;
  const incomingRequest = header?.status === "PENDING" && !header.requestedByMe;
  const outgoingRequest = header?.status === "PENDING" && header.requestedByMe;
  const requestDeclined = header?.status === "DECLINED";
  const composerHidden = readOnly || incomingRequest || requestDeclined;
  const statusLine = peerTyping ? "typing…" : (formatLastSeen(presence) ?? header?.demand?.summary ?? "");

  const menuActions: MessageAction[] = menu
    ? [
        ...(!menu.m.deletedAt && !composerHidden ? (["reply"] as const) : []),
        ...(menu.m.text && !menu.m.deletedAt ? (["copy"] as const) : []),
        ...(!menu.m.deletedAt ? (["forward"] as const) : []),
        ...(menu.m.attachments.length > 0 && !menu.m.deletedAt ? (["save"] as const) : []),
        ...(menu.m.senderId === myId && !menu.m.deletedAt ? (["delete"] as const) : []),
      ]
    : [];

  return (
    <main
      className="fixed inset-x-0 top-0 z-40 flex flex-col overflow-hidden bg-black text-white"
      style={{ height: viewport ? viewport.height : "100dvh", transform: viewport ? `translateY(${viewport.top}px)` : undefined }}
    >
      {/* Header */}
      <header className="relative z-20 flex shrink-0 items-center gap-1 border-b border-white/[0.06] bg-black/85 px-1.5 pb-2 pt-[max(env(safe-area-inset-top),0.5rem)] backdrop-blur-xl">
        <Link href="/chats" aria-label="Back" className="flex h-10 w-10 items-center justify-center rounded-full text-white active:bg-white/10">
          <ChevronLeft className="h-6 w-6" />
        </Link>
        {header ? (
          <button
            type="button"
            onClick={() => setProfileOpen(true)}
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl py-0.5 pr-2 text-left active:bg-white/5"
          >
            <PresenceAvatar
              id={header.otherParty.id}
              name={peerName}
              src={header.otherParty.avatarUrl}
              size={40}
              online={presence?.online ?? false}
            />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1 text-[16px] font-semibold leading-5">
                <span className="truncate">{peerName}</span>
                {header.otherParty.isVerified && <BadgeCheck className="h-4 w-4 shrink-0 fill-[#0A84FF] text-black" />}
                {header.otherTier && <TierMark tier={header.otherTier} className="ml-0.5 shrink-0" />}
              </span>
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={peerTyping ? "typing" : presence?.online ? "online" : "status"}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className={cn(
                    "block truncate text-[12.5px] leading-4",
                    peerTyping || presence?.online ? "text-[#22C55E]" : "text-white/50",
                  )}
                >
                  {statusLine || "tap for info"}
                </motion.span>
              </AnimatePresence>
            </span>
          </button>
        ) : (
          <div className="flex flex-1 items-center gap-2.5">
            <span className="h-10 w-10 animate-pulse rounded-full bg-white/10" />
            <span className="h-3 w-28 animate-pulse rounded-full bg-white/10" />
          </div>
        )}
        {checkIn && (
          <button
            type="button"
            onClick={() => setCheckInOpen(true)}
            aria-label="Project status"
            className="flex h-10 w-10 items-center justify-center rounded-full text-white/80 active:bg-white/10"
          >
            <ClipboardCheck className="h-5 w-5" />
          </button>
        )}
        {header?.bidId && (
          <button
            type="button"
            onClick={() => setRateOpen(true)}
            aria-label="Rate"
            className="flex h-10 w-10 items-center justify-center rounded-full text-amber-400 active:bg-white/10"
          >
            <Star className="h-5 w-5" />
          </button>
        )}
      </header>

      {readOnly && (
        <div className="flex shrink-0 items-center justify-center gap-2 bg-amber-950/40 px-4 py-2 text-xs font-medium text-amber-400">
          <ShieldAlert className="h-3.5 w-3.5" /> Admin view — read-only
        </div>
      )}

      {/* Transcript */}
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        data-swipe-zone
        className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain pb-3 pt-2"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 10%, rgba(59,123,248,0.08), transparent 40%), radial-gradient(circle at 85% 80%, rgba(168,85,247,0.06), transparent 45%)",
        }}
      >
        {loadingOlder && (
          <div className="flex justify-center py-2 text-white/40">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        )}
        {loadingHistory && (
          <div className="flex justify-center py-10 text-white/40">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}

        {!loadingHistory && !nextCursor && (
          <div className="mx-auto mb-3 mt-1 flex w-fit max-w-[85%] items-center gap-1.5 rounded-xl bg-[#1c1c1e]/80 px-3 py-1.5 text-center text-[11.5px] leading-4 text-white/55">
            <Lock className="h-3 w-3 shrink-0 text-amber-300/80" />
            Messages here are private between you and {peerName || "this person"}.
          </div>
        )}

        {!loadingHistory && messages.length === 0 && header && (
          <motion.div
            className="mx-auto mt-10 flex max-w-[260px] flex-col items-center text-center"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <PresenceAvatar id={header.otherParty.id} name={peerName} src={header.otherParty.avatarUrl} size={72} />
            <p className="mt-3 text-[16px] font-semibold">{peerName}</p>
            <p className="mt-1 text-[13px] text-white/50">Say hello 👋 — this is the start of your conversation.</p>
          </motion.div>
        )}

        {messages.map((m, idx) => {
          const prev = messages[idx - 1];
          const next = messages[idx + 1];
          const t = new Date(m.createdAt).getTime();
          const newDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
          const groupStart = newDay || !prev || prev.senderId !== m.senderId || t - new Date(prev.createdAt).getTime() > GROUP_GAP_MS;
          const groupEnd =
            !next ||
            next.senderId !== m.senderId ||
            new Date(next.createdAt).getTime() - t > GROUP_GAP_MS ||
            new Date(next.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
          return (
            <div key={m.id}>
              {newDay && (
                <div className="sticky top-1.5 z-[5] my-2.5 flex justify-center">
                  <span className="rounded-full bg-[#1c1c1e]/90 px-3 py-1 text-[12px] font-medium text-white/70 shadow-sm backdrop-blur-md">
                    {formatDayLabel(m.createdAt)}
                  </span>
                </div>
              )}
              <motion.div
                initial={m.pending || idx >= messages.length - 1 ? { opacity: 0, y: 14, scale: 0.97 } : false}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 520, damping: 34 }}
                style={{ transformOrigin: m.senderId === myId ? "bottom right" : "bottom left" }}
              >
                <MessageRow
                  m={m}
                  isMine={m.senderId === myId}
                  myId={myId}
                  peerName={peerName}
                  groupStart={groupStart}
                  groupEnd={groupEnd}
                  highlighted={highlightId === m.id}
                  uploadProgress={uploads[m.id]}
                  onReply={startReply}
                  onLongPress={openMenu}
                  onOpenMedia={openMedia}
                  onJumpTo={jumpTo}
                  onReactionsTap={onReactionsTap}
                  registerRef={registerRef}
                />
              </motion.div>
            </div>
          );
        })}

        <AnimatePresence>
          {peerTyping && (
            <motion.div
              className="mt-2 flex px-2.5"
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              style={{ transformOrigin: "bottom left" }}
            >
              <span className="flex items-center gap-[5px] rounded-[20px] rounded-bl-[6px] bg-[#232326] px-4 py-3.5">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="h-2 w-2 rounded-full bg-white/50"
                    animate={{ y: [0, -4, 0], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
                  />
                ))}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Jump to latest */}
      <AnimatePresence>
        {!atBottom && (
          <motion.button
            type="button"
            onClick={scrollToBottom}
            aria-label="Scroll to latest"
            initial={{ opacity: 0, scale: 0.6, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.6, y: 10 }}
            className="absolute right-3 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-[#2a2a2e] text-white shadow-lg ring-1 ring-white/10"
            style={{ bottom: composerHidden ? 96 : 84 }}
          >
            <ArrowDown className="h-5 w-5" />
            {unseen > 0 && (
              <span className="absolute -top-1.5 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#0A84FF] px-1 text-[11px] font-bold">
                {unseen}
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {incomingRequest && header && (
        <div className="shrink-0 border-t border-white/[0.06] bg-black px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
          <p className="text-center text-sm font-semibold text-neutral-100">{peerName} wants to message you</p>
          <p className="mt-1 text-center text-xs text-[#8e8e8e]">
            Accept to reply and move this into your chats. They won&apos;t know you&apos;ve seen it until you do.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => void answerRequest("decline")}
              disabled={answeringRequest}
              className="h-11 flex-1 rounded-full border border-[#2e2e2e] text-sm font-semibold text-red-400 hover:bg-[#1c1c1e] disabled:opacity-50"
            >
              Decline
            </button>
            <button
              type="button"
              onClick={() => void answerRequest("accept")}
              disabled={answeringRequest}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-white text-sm font-semibold text-black hover:bg-neutral-200 disabled:opacity-50"
            >
              {answeringRequest && <Loader2 className="h-4 w-4 animate-spin" />}
              Accept
            </button>
          </div>
        </div>
      )}

      {requestDeclined && (
        <div className="shrink-0 border-t border-white/[0.06] bg-black px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] text-center text-xs text-[#8e8e8e]">
          This message request was declined. You can&apos;t send more messages here.
        </div>
      )}

      {/* Composer */}
      {!composerHidden && (
        <div className="relative z-20 shrink-0 bg-black/90 px-2 pt-1.5 backdrop-blur-xl pb-[max(env(safe-area-inset-bottom),0.5rem)]">
          {outgoingRequest && (
            <p className="mb-1.5 px-1 text-center text-[11px] text-[#8e8e8e]">Message request sent. They can reply once they accept.</p>
          )}

          <AnimatePresence initial={false}>
            {replyTo && (
              <motion.div
                key="reply"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
                className="overflow-hidden"
              >
                <div className="mx-1 mb-1.5 flex items-center gap-2.5 rounded-2xl bg-[#1c1c1e] py-2 pl-3 pr-2">
                  <ReplyIcon className="h-4 w-4 shrink-0 text-[#64A8FF]" />
                  <div className="min-w-0 flex-1 border-l-2 border-[#64A8FF] pl-2.5">
                    <p className="text-[12.5px] font-semibold text-[#64A8FF]">
                      Replying to {replyTo.senderId === myId ? "yourself" : peerName}
                    </p>
                    <p className="truncate text-[13px] text-white/65">{replyTo.text || "📷 Media"}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReplyTo(null)}
                    aria-label="Cancel reply"
                    className="flex h-8 w-8 items-center justify-center rounded-full text-white/60 active:bg-white/10"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            )}
            {attachFile && (
              <motion.div
                key="attach"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="relative mx-1 mb-1.5 inline-block">
                  {attachPreview ? (
                    attachFile.type.startsWith("video/") ? (
                      <video src={attachPreview} className="h-24 rounded-2xl object-cover" muted />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={attachPreview} alt="Attachment preview" className="h-24 rounded-2xl object-cover" />
                    )
                  ) : (
                    <div className="flex h-14 items-center gap-2 rounded-2xl bg-[#1c1c1e] px-3 text-[13px] text-white">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FF453A] text-[9px] font-bold">PDF</span>
                      <span className="max-w-[200px] truncate">{attachFile.name}</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={clearAttachment}
                    className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#3a3a3c] text-white ring-2 ring-black"
                    aria-label="Remove attachment"
                  >
                    <X className="h-3 w-3" strokeWidth={3} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Attach menu */}
          <AnimatePresence>
            {attachMenuOpen && (
              <>
                <motion.div className="fixed inset-0 z-10" onClick={() => setAttachMenuOpen(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
                <motion.div
                  className="absolute bottom-full right-3 z-20 mb-2 grid grid-cols-3 gap-3 rounded-3xl bg-[#1f1f22]/95 p-4 shadow-2xl ring-1 ring-white/10 backdrop-blur-xl"
                  initial={{ opacity: 0, scale: 0.8, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.85, y: 8 }}
                  transition={{ type: "spring", stiffness: 520, damping: 32 }}
                  style={{ transformOrigin: "bottom right" }}
                >
                  {[
                    { label: "Gallery", icon: ImageIcon, tint: "from-[#A855F7] to-[#7C3AED]", ref: mediaInputRef },
                    { label: "Camera", icon: Camera, tint: "from-[#F43F5E] to-[#E11D48]", ref: cameraInputRef },
                    { label: "Document", icon: FileText, tint: "from-[#3B82F6] to-[#2563EB]", ref: docInputRef },
                  ].map((o, i) => (
                    <motion.button
                      key={o.label}
                      type="button"
                      onClick={() => o.ref.current?.click()}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.04 * i }}
                      className="flex w-[68px] flex-col items-center gap-1.5 text-[12px] text-white/80"
                    >
                      <span className={cn("flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br shadow-lg", o.tint)}>
                        <o.icon className="h-6 w-6 text-white" />
                      </span>
                      {o.label}
                    </motion.button>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>

          <div className="flex items-end gap-1.5">
            <div className="flex min-h-[46px] min-w-0 flex-1 items-end rounded-[23px] bg-[#1c1c1e] ring-1 ring-white/[0.06]">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setComposerEmojiOpen((o) => !o)}
                  aria-label="Emoji"
                  className="flex h-[46px] w-11 shrink-0 items-center justify-center text-white/55 active:text-white"
                >
                  <Smile className="h-[22px] w-[22px]" />
                </button>
                <EmojiPopover
                  open={composerEmojiOpen}
                  onClose={() => setComposerEmojiOpen(false)}
                  onSelect={(emoji) => setDraft((prev) => prev + emoji)}
                />
              </div>
              <ComposerTextarea
                ref={textareaRef}
                value={draft}
                onValueChange={handleDraftChange}
                onSubmit={() => void handleSend()}
                placeholder="Message"
                aria-label="Message"
                maxRows={6}
                // 16px stops iOS zooming into the field (which also left the page shifted after the keyboard closed).
                className="min-h-[46px] min-w-0 flex-1 resize-none bg-transparent py-[12px] text-[16px] leading-[22px] text-white placeholder:text-white/40 focus-visible:outline-none"
              />
              <button
                type="button"
                onClick={() => setAttachMenuOpen((o) => !o)}
                aria-label="Attach"
                className="flex h-[46px] w-10 shrink-0 items-center justify-center text-white/55 active:text-white"
              >
                <motion.span animate={{ rotate: attachMenuOpen ? 45 : 0 }}>
                  <Paperclip className="h-[21px] w-[21px] -rotate-45" />
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {!draft && !attachFile && (
                  <motion.button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    aria-label="Camera"
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 40, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    className="flex h-[46px] shrink-0 items-center justify-center overflow-hidden pr-1 text-white/55 active:text-white"
                  >
                    <Camera className="h-[21px] w-[21px]" />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
            <motion.button
              type="button"
              // Keep the keyboard up when sending (like WhatsApp): don't let the tap steal focus.
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => void handleSend()}
              disabled={!canSend}
              aria-label="Send"
              animate={{ scale: canSend ? 1 : 0.88, opacity: canSend ? 1 : 0.45 }}
              whileTap={{ scale: 0.85 }}
              transition={{ type: "spring", stiffness: 600, damping: 26 }}
              className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#3B7BF8] to-[#2456E0] text-white shadow-[0_6px_18px_rgba(37,86,224,0.45)]"
            >
              <Send className="-ml-0.5 h-5 w-5" />
            </motion.button>
          </div>

          <input
            ref={mediaInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileSelected(f);
              e.target.value = "";
            }}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileSelected(f);
              e.target.value = "";
            }}
          />
          <input
            ref={docInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileSelected(f);
              e.target.value = "";
            }}
          />
        </div>
      )}

      <MessageActions
        open={menu !== null}
        rect={menu?.rect ?? null}
        isMine={menu?.m.senderId === myId}
        myReaction={menu?.m.reactions.find((r) => r.userId === myId)?.emoji ?? null}
        actions={menuActions}
        preview={menu?.preview}
        onReact={handleReact}
        onAction={(a) => void handleAction(a)}
        onClose={() => setMenu(null)}
      />

      <MediaViewer items={mediaItems} index={viewerIndex} onIndexChange={setViewerIndex} onClose={() => setViewerIndex(null)} />

      <ChatProfilePanel
        open={profileOpen}
        conversationId={conversationId}
        presence={presence}
        onClose={() => setProfileOpen(false)}
        onJumpToMessage={jumpTo}
      />

      <ForwardSheet open={forwarding !== null} excludeId={conversationId} onClose={() => setForwarding(null)} onSend={forwardTo} />

      {header?.bidId && (
        <RateUserModal
          open={rateOpen}
          onClose={() => setRateOpen(false)}
          bidId={header.bidId}
          ratedUserName={peerName}
          onSubmitted={() => setCheckIn((c) => (c ? { ...c, rated: true } : c))}
        />
      )}

      {checkIn && (
        <DealCheckInDrawer
          open={checkInOpen && !rateOpen}
          onClose={() => setCheckInOpen(false)}
          data={checkIn}
          onAnswered={(status, wantsRating) => {
            setCheckIn((c) => (c ? { ...c, due: false, latestStatus: status } : c));
            if (wantsRating) setTimeout(() => setRateOpen(true), 350);
          }}
        />
      )}
    </main>
  );
}
