"use client";

import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { isTabRoute, TAB_ROUTES, type TabRoute } from "@/components/tab-navigation";

/**
 * Keep-alive tab container.
 *
 * Each bottom-nav tab is mounted the first time it's visited and then stays
 * mounted — inactive tabs are only hidden. Switching tabs therefore never
 * refetches or resets state, and each tab remembers its own scroll position.
 *
 * On a non-tab route (e.g. /demands/123) the normal route `children` render
 * and all tabs stay alive (hidden) in the background, so coming back is instant.
 */
export function TabShell({
  tabs,
  children,
}: {
  tabs: Record<TabRoute, ReactNode>;
  children: ReactNode;
}) {
  const pathname = usePathname() || "/";
  const activeTab = isTabRoute(pathname) ? pathname : null;

  // Tabs visited so far — mounted lazily, then never unmounted.
  const [visited, setVisited] = useState<Set<TabRoute>>(
    () => new Set(activeTab ? [activeTab] : [])
  );
  if (activeTab && !visited.has(activeTab)) {
    setVisited(new Set(visited).add(activeTab));
  }

  // Per-tab scroll memory (window is the scroller for every page).
  const scrollByTab = useRef<Partial<Record<TabRoute, number>>>({});
  const activeRef = useRef(activeTab);
  activeRef.current = activeTab;

  useEffect(() => {
    const onScroll = () => {
      const tab = activeRef.current;
      if (tab) scrollByTab.current[tab] = window.scrollY;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Restore the tab's own scroll position when it becomes visible.
  useLayoutEffect(() => {
    if (activeTab) window.scrollTo(0, scrollByTab.current[activeTab] ?? 0);
  }, [activeTab]);

  return (
    <>
      {TAB_ROUTES.map((tab) =>
        visited.has(tab) ? (
          <div key={tab} hidden={tab !== activeTab} data-tab-pane={tab}>
            {tabs[tab]}
          </div>
        ) : null
      )}
      {/* Route page only for non-tab URLs; tab URLs are served by the panes above. */}
      {activeTab ? null : children}
    </>
  );
}
