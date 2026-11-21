"use client";

import { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * The bottom-nav tabs that stay mounted in <TabShell> (keep-alive).
 * Switching between them changes the URL with history.pushState, so there is
 * no server round-trip and no remount: the page keeps its state and scroll,
 * the way native app tabs do (Instagram, WhatsApp, Paytm).
 *
 * Order matches the bottom nav (minus Post, which opens a modal).
 */
export const TAB_ROUTES = ["/chats", "/forum", "/", "/explore"] as const;
export type TabRoute = (typeof TAB_ROUTES)[number];

export function isTabRoute(pathname: string): pathname is TabRoute {
  return (TAB_ROUTES as readonly string[]).includes(pathname);
}

/**
 * Returns a function that switches to a tab.
 * - From a tab page → instant: history.pushState (Next syncs usePathname).
 * - From any other page (e.g. /forum/123) → normal router.push. The tabs
 *   are still kept alive by <TabShell>, so they don't remount either way.
 */
export function useSwitchTab() {
  const pathname = usePathname() || "/";
  const router = useRouter();

  return useCallback(
    (href: TabRoute) => {
      if (href === pathname) return;
      if (isTabRoute(pathname)) {
        window.history.pushState(null, "", href);
      } else {
        router.push(href);
      }
    },
    [pathname, router]
  );
}
