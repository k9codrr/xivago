"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

function formatRemaining(ms: number): string {
  if (ms <= 0) return "Closed";
  const totalMinutes = Math.floor(ms / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

export function CountdownBadge({ timelineEnd }: { timelineEnd: string | Date }) {
  const target = new Date(timelineEnd).getTime();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const remainingMs = target - now;
  const isUrgent = remainingMs > 0 && remainingMs < 6 * 60 * 60 * 1000;
  const isExpired = remainingMs <= 0;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
        isExpired
          ? "bg-neutral-100 text-neutral-400"
          : isUrgent
            ? "bg-red-100 text-red-600"
            : "bg-neutral-100 text-neutral-600",
      )}
    >
      <Clock className="h-3 w-3" />
      {formatRemaining(remainingMs)}
    </span>
  );
}
