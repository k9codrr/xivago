// "use client";

// import { usePathname, useRouter } from "next/navigation";
// import { useRef, type ReactNode, type TouchEvent } from "react";
// import { usePostModal } from "@/components/post-modal-provider";

// // Must match the order in bottom-nav.tsx
// const NAV_ORDER = ["/chats", "/forum", "/", "/post", "/explore"];

// const SWIPE_THRESHOLD = 60;        // min horizontal distance (px)
// const SWIPE_RATIO = 2;             // horizontal must dominate vertical by this much

// const HIDDEN_ROUTES = [
//   "/admin",
//   "/login",
//   "/signup",
//   "/onboarding",
//   "/profile",
// ];

// function isHidden(pathname: string) {
//   return (
//     HIDDEN_ROUTES.some((r) => pathname.startsWith(r)) ||
//     (pathname.startsWith("/chats/") && pathname !== "/chats")
//   );
// }

// export function SwipeNavigator({ children }: { children: ReactNode }) {
//   const pathname = usePathname() || "/";
//   const router = useRouter();
//   const { openPostModal } = usePostModal();

//   // Touch tracking
//   const startX = useRef(0);
//   const startY = useRef(0);
//   const tracking = useRef(false);

//   const handleTouchStart = (e: TouchEvent) => {
//     // Don't hijack touches that begin on interactive elements
//     const target = e.target as HTMLElement;
//     if (
//       target.closest("input, textarea, select, [contenteditable], [data-vaul-no-drag], a, button") &&
//       !target.closest("[data-swipe-zone]") // optional: wrap carousels in data-swipe-zone to opt OUT
//     ) {
//       tracking.current = false;
//       return;
//     }
//     const t = e.touches[0]!;
//     startX.current = t.clientX;
//     startY.current = t.clientY;
//     tracking.current = true;
//   };

//   const handleTouchEnd = (e: TouchEvent) => {
//     if (!tracking.current) return;
//     tracking.current = false;

//     const t = e.changedTouches[0]!;
//     const dx = t.clientX - startX.current;
//     const dy = t.clientY - startY.current;

//     // Must be a clear horizontal swipe, not a scroll or tap
//     if (Math.abs(dx) < SWIPE_THRESHOLD) return;
//     if (Math.abs(dx) < Math.abs(dy) * SWIPE_RATIO) return;

//     const index = NAV_ORDER.indexOf(pathname);
//     if (index === -1) return; // not a tab page — ignore

//     if (dx < 0 && index < NAV_ORDER.length - 1) {
//       // Swiped left → next tab
//       goTo(NAV_ORDER[index + 1]!);
//     } else if (dx > 0 && index > 0) {
//       // Swiped right → previous tab
//       goTo(NAV_ORDER[index - 1]!);
//     }
//   };

//   const goTo = (href: string) => {
//     if (href === "/post") {
//       openPostModal(); // Post opens the modal, same as the nav
//       return;
//     }
//     router.push(href);
//   };

//   if (isHidden(pathname)) return <>{children}</>;

//   return (
//     <div
//       onTouchStart={handleTouchStart}
//       onTouchEnd={handleTouchEnd}
//       className="min-h-dvh"
//     >
//       {children}
//     </div>
//   );
// }

"use client";

import { usePathname } from "next/navigation";
import { useRef, type ReactNode, type TouchEvent } from "react";
import { useHaptic } from "@/components/ui/haptic";
import { isTabRoute, useSwitchTab } from "@/components/tab-navigation";
import { usePostModal } from "@/components/post-modal-provider";
import { useNavStyle } from "@/lib/nav-style";

// Must match the order in bottom-nav.tsx (NAV_ITEMS / GLASS_NAV_ITEMS)
const MODERN_NAV_ORDER = ["/chats", "/forum", "/", "/explore", "/post"];
const GLASS_NAV_ORDER = ["/", "/forum", "/post", "/explore", "/chats"];

const SWIPE_THRESHOLD = 60;  // min horizontal px to count as a tab swipe
const SWIPE_RATIO = 2;       // horizontal must dominate vertical 2:1

const HIDDEN_ROUTES = ["/admin", "/login", "/signup", "/onboarding", "/profile"];

function isHidden(pathname: string) {
  return (
    HIDDEN_ROUTES.some((r) => pathname.startsWith(r)) ||
    (pathname.startsWith("/chats/") && pathname !== "/chats")
  );
}

export function SwipeNavigator({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  const switchTab = useSwitchTab();
  const { openPostModal } = usePostModal();
  const NAV_ORDER = useNavStyle() === "modern" ? MODERN_NAV_ORDER : GLASS_NAV_ORDER;

  const start = useRef({ x: 0, y: 0, tracking: false });

  const triggerHaptic = useHaptic("heavy");

  const handleTouchStart = (e: TouchEvent) => {
    const target = e.target as HTMLElement;

    const inSwipeZone = target.closest("[data-swipe-zone]");
    const onInteractive = target.closest(
      "input, textarea, select, [contenteditable], [data-vaul-no-drag], a, button"
    );
    // Drawers are portaled, but React still bubbles their touches up to here.
    // Without this, a sideways swipe inside a drawer changes tab and closes it.
    const inDrawer = target.closest("[data-vaul-drawer], [data-vaul-overlay], [data-app-sheet]");

    // Ignore gestures that start on a carousel OR on any interactive
    // element (unless that element is itself inside a swipe zone — e.g.
    // arrow buttons inside a carousel, which should still work).
    if (inSwipeZone || onInteractive || inDrawer) {
      start.current.tracking = false;
      return;
    }

    const t = e.touches[0]!;
    start.current = { x: t.clientX, y: t.clientY, tracking: true };
  };

  const handleTouchEnd = (e: TouchEvent) => {
    if (!start.current.tracking) return;
    start.current.tracking = false;

    const t = e.changedTouches[0]!;
    const dx = t.clientX - start.current.x;
    const dy = t.clientY - start.current.y;

    // Clear horizontal swipe, not a scroll/tap
    if (Math.abs(dx) < SWIPE_THRESHOLD) return;
    if (Math.abs(dx) < Math.abs(dy) * SWIPE_RATIO) return;

    const index = NAV_ORDER.indexOf(pathname);
    if (index === -1) return; // not a tab page

    if (dx < 0 && index < NAV_ORDER.length - 1) {
      goTo(NAV_ORDER[index + 1]!); // swiped left → next tab
    } else if (dx > 0 && index > 0) {
      goTo(NAV_ORDER[index - 1]!); // swiped right → previous tab
    }
  };

  const goTo = (href: string) => {
    triggerHaptic(); // heavy haptic, same as the bottom nav
    if (href === "/post") {
      openPostModal();
      return;
    }
    // router.push(href); // old: full route navigation on every swipe
    if (isTabRoute(href)) switchTab(href); // instant keep-alive tab switch
  };

  if (isHidden(pathname)) return <>{children}</>;

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="min-h-dvh"
    >
      {children}
    </div>
  );
}