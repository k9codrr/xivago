"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUnreadNotifications } from "@/lib/use-unread-notifications";

/** Bell link with a live unread-count badge. */
export function NotificationBell({ className }: { className?: string }) {
  const unreadCount = useUnreadNotifications();

  return (
    <Link
      href="/activity"
      aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"}
      className={cn(
        "relative flex h-11 w-11 items-center justify-center rounded-full transition-transform duration-200 active:scale-90",
        className,
      )}
    >
      <Bell className="h-[20px] w-[20px] text-white" strokeWidth={2} />
      {unreadCount > 0 && (
        <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full border-2 border-black bg-[#FF3B30] px-[4px] text-center text-[10px] font-bold leading-[14px] text-white">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </Link>
  );
}
