"use client";

import { memo, useRef, type ReactNode } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from "motion/react";
import { Ban, FileText, Forward, Play, Reply } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import type { ChatMessage } from "@/lib/use-conversation-socket";
import { LinkifiedText, MessageTicks, formatClock } from "./chat-primitives";

/** Distance (px) a bubble has to be pulled right to count as "reply". */
const REPLY_AT = 64;
const LONG_PRESS_MS = 380;
const SLOP = 9;

export interface MessageRowProps {
  m: ChatMessage;
  isMine: boolean;
  myId: string | undefined;
  peerName: string;
  groupStart: boolean;
  groupEnd: boolean;
  highlighted: boolean;
  /** 0..1 upload progress while an attachment of a pending message is uploading. */
  uploadProgress?: number;
  onReply: (m: ChatMessage) => void;
  onLongPress: (m: ChatMessage, rect: DOMRect, preview: ReactNode) => void;
  onOpenMedia: (attachmentId: string) => void;
  onJumpTo: (messageId: string) => void;
  onReactionsTap: (m: ChatMessage) => void;
  registerRef: (id: string, el: HTMLDivElement | null) => void;
}

function groupReactions(reactions: ChatMessage["reactions"]) {
  const counts = new Map<string, number>();
  for (const r of reactions) counts.set(r.emoji, (counts.get(r.emoji) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

const isVisual = (ct: string) => ct.startsWith("image/") || ct.startsWith("video/");

/** The bubble itself (also used, without gestures, as the lifted preview in the hold menu). */
export function Bubble({
  m,
  isMine,
  myId,
  peerName,
  groupStart,
  uploadProgress,
  onOpenMedia,
  onJumpTo,
}: Pick<MessageRowProps, "m" | "isMine" | "myId" | "peerName" | "groupStart" | "uploadProgress"> & {
  onOpenMedia?: (id: string) => void;
  onJumpTo?: (id: string) => void;
}) {
  const deleted = Boolean(m.deletedAt);
  const visuals = deleted ? [] : m.attachments.filter((a) => isVisual(a.contentType));
  const docs = deleted ? [] : m.attachments.filter((a) => !isVisual(a.contentType));
  const hasText = !deleted && m.text.trim().length > 0;
  const mediaOnly = visuals.length > 0 && !hasText && !m.replyTo && docs.length === 0 && !m.forwarded;

  const radius = isMine
    ? cn("rounded-[20px] rounded-br-[6px]", !groupStart && "rounded-tr-[6px]")
    : cn("rounded-[20px] rounded-bl-[6px]", !groupStart && "rounded-tl-[6px]");

  const time = (
    <span className="flex items-center gap-[3px] whitespace-nowrap">
      {formatClock(m.createdAt)}
      {isMine && !deleted && <MessageTicks pending={m.pending} deliveredAt={m.deliveredAt} readAt={m.readAt} onMedia={mediaOnly} />}
    </span>
  );

  const media = visuals.length > 0 && (
    <div className={cn("grid gap-[2px]", visuals.length > 1 && "grid-cols-2")}>
      {visuals.map((a, i) => {
        const video = a.contentType.startsWith("video/");
        const tall = visuals.length === 1;
        return (
          <button
            key={a.id}
            type="button"
            data-media
            onClick={(e) => {
              e.stopPropagation();
              onOpenMedia?.(a.id);
            }}
            className={cn(
              "relative block overflow-hidden bg-[#111]",
              tall ? "w-full" : "aspect-square",
              visuals.length === 3 && i === 0 && "col-span-2 aspect-[2/1]",
            )}
            aria-label={video ? "Play video" : "Open photo"}
          >
            {video ? (
              <>
                <video
                  src={`${a.url}#t=0.1`}
                  muted
                  playsInline
                  preload="metadata"
                  className={cn("pointer-events-none block w-full object-cover", tall ? "max-h-[360px] min-h-[160px]" : "h-full")}
                />
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md ring-1 ring-white/20">
                    <Play className="ml-1 h-6 w-6 fill-current" />
                  </span>
                </span>
              </>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={a.url}
                alt=""
                draggable={false}
                loading="lazy"
                className={cn("block w-full select-none object-cover", tall ? "max-h-[380px] min-h-[120px]" : "h-full")}
              />
            )}
            {m.pending && uploadProgress !== undefined && <UploadRing progress={uploadProgress} />}
          </button>
        );
      })}
    </div>
  );

  if (mediaOnly) {
    return (
      <div className={cn("relative w-[min(72vw,300px)] overflow-hidden", radius)}>
        {media}
        <span className="pointer-events-none absolute bottom-1.5 right-1.5 rounded-full bg-black/45 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-md">
          {time}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden text-[15.5px] leading-[21px] text-white",
        radius,
        isMine ? "bg-gradient-to-br from-[#3B7BF8] to-[#2456E0]" : "bg-[#232326]",
        visuals.length > 0 && "w-[min(72vw,300px)]",
      )}
    >
      {m.forwarded && !deleted && (
        <p className={cn("flex items-center gap-1 px-3 pt-2 text-[12.5px] italic", isMine ? "text-white/75" : "text-white/55")}>
          <Forward className="h-3.5 w-3.5" /> Forwarded
        </p>
      )}

      {m.replyTo && !deleted && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onJumpTo?.(m.replyTo!.id);
          }}
          className={cn(
            "mx-1.5 mt-1.5 flex w-[calc(100%-12px)] min-w-[140px] flex-col rounded-[12px] border-l-[3px] px-2.5 py-1.5 text-left",
            isMine ? "border-white/80 bg-black/15" : "border-[#64A8FF] bg-white/[0.06]",
          )}
        >
          <span className={cn("text-[12.5px] font-semibold", isMine ? "text-white" : "text-[#64A8FF]")}>
            {m.replyTo.senderId === myId ? "You" : peerName}
          </span>
          <span className="line-clamp-2 text-[13px] leading-[17px] text-white/75 [overflow-wrap:anywhere]">
            {m.replyTo.deletedAt ? "Deleted message" : m.replyTo.text || "📷 Media"}
          </span>
        </button>
      )}

      {media && <div className={cn((m.replyTo || m.forwarded) && "mt-1.5")}>{media}</div>}

      {docs.map((a) => (
        <a
          key={a.id}
          href={a.url}
          target="_blank"
          rel="noreferrer noopener"
          onClick={(e) => e.stopPropagation()}
          className={cn("mx-1.5 mt-1.5 flex items-center gap-2.5 rounded-[12px] px-2.5 py-2", isMine ? "bg-black/15" : "bg-white/[0.06]")}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#FF453A] text-[10px] font-bold">
            {a.contentType === "application/pdf" ? "PDF" : <FileText className="h-5 w-5" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-medium">{decodeURIComponent(a.url.split("/").pop()?.split("?")[0] ?? "Document")}</span>
            <span className="block text-[12px] text-white/60">Tap to open</span>
          </span>
        </a>
      ))}

      <div className={cn("relative px-3 pb-[7px]", m.replyTo || m.forwarded || visuals.length || docs.length ? "pt-1" : "pt-[7px]")}>
        {deleted ? (
          <p className="flex items-center gap-1.5 italic text-white/60">
            <Ban className="h-4 w-4" /> {isMine ? "You deleted this message" : "This message was deleted"}
            <span aria-hidden className={cn("inline-block", isMine ? "w-[48px]" : "w-[44px]")} />
          </p>
        ) : (
          <p>
            {hasText && <LinkifiedText text={m.text} />}
            {/* Room for the time so it sits on the last line when it fits (WhatsApp layout). */}
            <span aria-hidden className={cn("inline-block h-3", isMine ? "w-[66px]" : "w-[46px]")} />
          </p>
        )}
        <span className={cn("absolute bottom-[5px] right-2.5 text-[11px]", isMine ? "text-white/70" : "text-white/45")}>{time}</span>
      </div>
    </div>
  );
}

function UploadRing({ progress }: { progress: number }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  return (
    <span className="absolute inset-0 flex items-center justify-center bg-black/35">
      <svg viewBox="0 0 48 48" className="h-14 w-14 -rotate-90">
        <circle cx="24" cy="24" r={r} stroke="rgba(255,255,255,0.25)" strokeWidth="4" fill="rgba(0,0,0,0.35)" />
        <motion.circle
          cx="24"
          cy="24"
          r={r}
          stroke="white"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          animate={{ strokeDashoffset: c * (1 - Math.max(0.04, progress)) }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />
      </svg>
    </span>
  );
}

/**
 * One message: swipe right to reply (WhatsApp / Telegram), press and hold for
 * reactions + actions, tap a photo / video to open it full screen.
 */
export const MessageRow = memo(function MessageRow(props: MessageRowProps) {
  const { m, isMine, groupStart, groupEnd, highlighted, onReply, onLongPress, onReactionsTap, registerRef, myId } = props;
  const x = useMotionValue(0);
  const iconOpacity = useTransform(x, [0, 24, REPLY_AT], [0, 0.35, 1]);
  const iconScale = useTransform(x, [0, REPLY_AT], [0.4, 1]);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const g = useRef<{ x: number; y: number; mode: "pending" | "swipe" | "scroll"; armed: boolean; timer: number | null; fired: boolean } | null>(null);
  const suppressClick = useRef(false);
  const deleted = Boolean(m.deletedAt);

  const reactions = groupReactions(m.reactions);
  const mine = m.reactions.some((r) => r.userId === myId);

  function fireLongPress() {
    const el = bubbleRef.current;
    if (!el || m.pending) return;
    if (g.current) g.current.fired = true;
    suppressClick.current = true;
    void haptic("medium");
    onLongPress(m, el.getBoundingClientRect(), <Bubble {...props} />);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    suppressClick.current = false;
    const timer = window.setTimeout(fireLongPress, LONG_PRESS_MS);
    g.current = { x: e.clientX, y: e.clientY, mode: "pending", armed: false, timer, fired: false };
  }

  function onPointerMove(e: React.PointerEvent) {
    const s = g.current;
    if (!s || s.fired) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (s.mode === "pending") {
      if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
      if (s.timer) window.clearTimeout(s.timer);
      s.timer = null;
      s.mode = dx > 0 && Math.abs(dx) > Math.abs(dy) * 1.3 && !deleted && !m.pending ? "swipe" : "scroll";
    }
    if (s.mode !== "swipe") return;
    const pull = Math.max(0, dx);
    // Resistance past the threshold, like the native apps.
    x.set(pull < REPLY_AT ? pull : REPLY_AT + (pull - REPLY_AT) * 0.25);
    const armed = pull >= REPLY_AT;
    if (armed !== s.armed) {
      s.armed = armed;
      if (armed) void haptic("light");
    }
  }

  function end() {
    const s = g.current;
    g.current = null;
    if (!s) return;
    if (s.timer) window.clearTimeout(s.timer);
    if (s.mode === "swipe") {
      suppressClick.current = true;
      if (s.armed) onReply(m);
      animate(x, 0, { type: "spring", stiffness: 520, damping: 34 });
    }
  }

  return (
    <div
      ref={(el) => registerRef(m.id, el)}
      className={cn(
        "relative flex px-2.5 transition-colors duration-700",
        isMine ? "justify-end" : "justify-start",
        groupStart ? "mt-2" : "mt-[3px]",
        reactions.length > 0 && "mb-3.5",
        highlighted && "bg-[#0A84FF]/15",
      )}
    >
      {/* Reply arrow revealed by the swipe */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 -mt-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white"
        style={{ opacity: iconOpacity, scale: iconScale }}
      >
        <Reply className="h-4 w-4" />
      </motion.span>

      <motion.div
        style={{ x }}
        className={cn(
          "relative flex min-w-0 max-w-[82%] flex-col sm:max-w-[68%]",
          isMine ? "items-end" : "items-start",
          "touch-pan-y select-none [-webkit-touch-callout:none]",
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={end}
        onPointerCancel={end}
        onPointerLeave={(e) => e.pointerType === "mouse" && end()}
        onContextMenu={(e) => {
          e.preventDefault();
          fireLongPress();
        }}
        onClickCapture={(e) => {
          if (suppressClick.current) {
            e.preventDefault();
            e.stopPropagation();
            suppressClick.current = false;
          }
        }}
      >
        <motion.div
          ref={bubbleRef}
          className="min-w-0 max-w-full"
          whileTap={m.pending ? undefined : { scale: 0.985 }}
          transition={{ type: "spring", stiffness: 600, damping: 30 }}
        >
          <Bubble {...props} onOpenMedia={props.onOpenMedia} onJumpTo={props.onJumpTo} />
        </motion.div>

        <AnimatePresence>
          {reactions.length > 0 && (
            <motion.button
              type="button"
              onClick={() => onReactionsTap(m)}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 600, damping: 22 }}
              className={cn(
                "absolute -bottom-3.5 z-[2] flex items-center gap-0.5 rounded-full px-1.5 py-[2px] text-[14px] leading-5 ring-2 ring-black",
                isMine ? "right-3" : "left-3",
                mine ? "bg-[#1d3557]" : "bg-[#2a2a2e]",
              )}
            >
              {reactions.slice(0, 3).map(([emoji]) => (
                <motion.span key={emoji} initial={{ scale: 0.3 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 700, damping: 15 }}>
                  {emoji}
                </motion.span>
              ))}
              {m.reactions.length > 1 && <span className="pl-0.5 text-[11px] font-semibold text-white/70">{m.reactions.length}</span>}
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>
      {/* groupEnd is used for spacing between runs */}
      {groupEnd && <span aria-hidden className="sr-only" />}
    </div>
  );
});
