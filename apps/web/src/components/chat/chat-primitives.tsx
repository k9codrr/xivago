"use client";

import { Fragment } from "react";
import { Check, CheckCheck, Clock3 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * WhatsApp-style delivery state for my own messages:
 *   clock        → still sending
 *   ✓ grey       → sent (on the server)
 *   ✓✓ grey      → delivered (on their device)
 *   ✓✓ blue      → seen
 */
export function MessageTicks({
  pending,
  deliveredAt,
  readAt,
  className,
  onMedia = false,
}: {
  pending?: boolean;
  deliveredAt?: string | null;
  readAt?: string | null;
  className?: string;
  /** Sits on top of a photo: use white for the unread states so it stays visible. */
  onMedia?: boolean;
}) {
  const grey = onMedia ? "text-white/90" : "text-white/55";
  if (pending) return <Clock3 aria-label="Sending" className={cn("h-3 w-3", grey, className)} strokeWidth={2.4} />;
  if (readAt) return <CheckCheck aria-label="Seen" className={cn("h-[15px] w-[15px] text-[#53BDEB]", className)} strokeWidth={2.4} />;
  if (deliveredAt) return <CheckCheck aria-label="Delivered" className={cn("h-[15px] w-[15px]", grey, className)} strokeWidth={2.4} />;
  return <Check aria-label="Sent" className={cn("h-[15px] w-[15px]", grey, className)} strokeWidth={2.4} />;
}

const HUES = [
  "linear-gradient(135deg,#7c3aed,#db2777)",
  "linear-gradient(135deg,#0ea5e9,#14b8a6)",
  "linear-gradient(135deg,#f97316,#eab308)",
  "linear-gradient(135deg,#6366f1,#22d3ee)",
  "linear-gradient(135deg,#e11d48,#f97316)",
  "linear-gradient(135deg,#16a34a,#84cc16)",
];
export const hueFor = (id: string) => HUES[[...id].reduce((n, c) => n + c.charCodeAt(0), 0) % HUES.length]!;

export function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

/** Round avatar with a WhatsApp-style green "online" dot. */
export function PresenceAvatar({
  id,
  name,
  src,
  size = 40,
  online = false,
  ringClassName = "ring-black",
  className,
}: {
  id: string;
  name: string;
  src: string | null;
  size?: number;
  online?: boolean;
  ringClassName?: string;
  className?: string;
}) {
  const dot = Math.max(10, Math.round(size * 0.27));
  return (
    <span className={cn("relative inline-flex shrink-0", className)} style={{ width: size, height: size }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="h-full w-full rounded-full bg-neutral-800 object-cover" draggable={false} />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center rounded-full font-semibold text-white"
          style={{ background: hueFor(id), fontSize: size * 0.38 }}
        >
          {initials(name)}
        </span>
      )}
      {online && (
        <span
          aria-label="Online"
          className={cn("absolute bottom-0 right-0 rounded-full bg-[#22C55E] ring-2", ringClassName)}
          style={{ width: dot, height: dot }}
        />
      )}
    </span>
  );
}

const URL_SPLIT = /(\bhttps?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]|\bwww\.[^\s<>"']+[^\s<>"'.,;:!?)\]])/gi;

/** Message text with tappable links; long words / URLs wrap instead of overflowing. */
export function LinkifiedText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(URL_SPLIT);
  return (
    <span className={cn("whitespace-pre-wrap [overflow-wrap:anywhere] [word-break:break-word]", className)}>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <a
            key={i}
            href={part.startsWith("http") ? part : `https://${part}`}
            target="_blank"
            rel="noreferrer noopener"
            onClick={(e) => e.stopPropagation()}
            className="underline decoration-white/40 underline-offset-2"
          >
            {part}
          </a>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </span>
  );
}

export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

export function formatDayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Today";
  const y = new Date(today.getTime() - 86_400_000);
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  const sameYear = d.getFullYear() === today.getFullYear();
  if (today.getTime() - d.getTime() < 6 * 86_400_000) return d.toLocaleDateString("en-IN", { weekday: "long" });
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", ...(sameYear ? {} : { year: "numeric" }) });
}
