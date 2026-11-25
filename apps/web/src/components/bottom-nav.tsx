// "use client";

// import Link from "next/link";
// import { usePathname } from "next/navigation";
// import { motion } from "framer-motion";
// import {
//   Home,
//   MessageCircle,
//   PlusCircle,
//   Users,
//   UserCircle,
// } from "lucide-react";
// import { clsx, type ClassValue } from "clsx";
// import { twMerge } from "tailwind-merge";
// import { useCallback, useLayoutEffect, useRef, useState } from "react";

// function cn(...inputs: ClassValue[]) {
//   return twMerge(clsx(inputs));
// }

// interface NavItem {
//   href: string;
//   label: string;
//   icon: React.ElementType;
// }

// const NAV_ITEMS: NavItem[] = [
//   { href: "/", label: "Feed", icon: Home },
//   { href: "/chats", label: "Chats", icon: MessageCircle },
//   { href: "/post", label: "Post", icon: PlusCircle },
//   { href: "/forum", label: "Feed", icon: Users },
//   { href: "/profile", label: "Profile", icon: UserCircle },
// ];

// const ITEM_WIDTH = 64; // each slot is fixed at w-16

// function isActive(pathname: string, href: string): boolean {
//   if (href === "/") return pathname === "/";
//   return pathname === href || pathname.startsWith(`${href}/`);
// }

// export function BottomNav() {
//   const pathname = usePathname() || "/";
//   const containerRef = useRef<HTMLDivElement>(null);
//   const [containerWidth, setContainerWidth] = useState(448); // max-w-md fallback

//   const triggerHaptic = useCallback(async () => {
//     try {
//       const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
//       await Haptics.impact({ style: ImpactStyle.Light });
//     } catch (error) {
//       // Silently fail in standard browser
//     }
//   }, []);

//   // Measure the real container width so centering is exact on any screen
//   useLayoutEffect(() => {
//     const el = containerRef.current;
//     if (!el) return;
//     const update = () => setContainerWidth(el.offsetWidth);
//     update();
//     const ro = new ResizeObserver(update);
//     ro.observe(el);
//     return () => ro.disconnect();
//   }, []);

//   if (
//     pathname.startsWith("/admin") ||
//     pathname.startsWith("/login") ||
//     pathname.startsWith("/signup") ||
//     pathname.startsWith("/onboarding") ||
//     (pathname.startsWith("/chats/") && pathname !== "/chats")
//   ) {
//     return null;
//   }

//   const activeIndex = Math.max(
//     0,
//     NAV_ITEMS.findIndex((item) => isActive(pathname, item.href))
//   );

//   // THE TRACK MATH:
//   // Shift the whole row so the active item's center aligns with container center.
//   // Edge icons simply slide off-screen — overflow-hidden clips them.
//   const trackX = containerWidth / 2 - (activeIndex * ITEM_WIDTH + ITEM_WIDTH / 2);

//   return (
//     <nav
//       aria-label="Primary"
//       className="fixed inset-x-0 bottom-0 z-50 bg-white/95 backdrop-blur-xl border-t border-neutral-200 dark:bg-neutral-950/95 dark:border-neutral-800"
//       style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
//     >
//       <div
//         ref={containerRef}
//         className="relative mx-auto h-[76px] max-w-md overflow-hidden"
//       >
//         <motion.div
//           className="flex h-full"
//           animate={{ x: trackX }}
//           transition={{ type: "spring", stiffness: 320, damping: 30 }}
//         >
//           {NAV_ITEMS.map((item) => {
//             const active = item.href === NAV_ITEMS[activeIndex].href;
//             return (
//               <div
//                 key={item.href}
//                 className="flex h-full w-16 shrink-0 items-center justify-center"
//               >
//                 <Link
//                   href={item.href}
//                   onClick={triggerHaptic}
//                   className="group relative flex h-full w-full flex-col items-center justify-center outline-none"
//                   aria-current={active ? "page" : undefined}
//                   aria-label={item.label}
//                 >
//                   {/* Pill — lives INSIDE the item, so it rides the track too */}
//                   {active && (
//                     <motion.div
//                       layoutId="nav-pill"
//                       transition={{ type: "spring", stiffness: 320, damping: 28 }}
//                       className="absolute h-[52px] w-[52px] rounded-full bg-purple-100 shadow-[0_4px_16px_rgba(147,51,234,0.25)] dark:bg-purple-900/40 dark:shadow-[0_4px_16px_rgba(168,85,247,0.3)]"
//                     />
//                   )}

//                   <motion.div
//                     animate={{ y: active ? -3 : 0, scale: active ? 1.2 : 1 }}
//                     transition={{ type: "spring", stiffness: 320, damping: 22 }}
//                     className="relative z-10"
//                   >
//                     <item.icon
//                       size={24}
//                       className={cn(
//                         "transition-colors duration-300",
//                         active
//                           ? "text-purple-600 dark:text-purple-400 drop-shadow-sm"
//                           : "text-neutral-400 group-hover:text-neutral-600 dark:text-neutral-500"
//                       )}
//                       strokeWidth={active ? 2.5 : 2}
//                     />
//                   </motion.div>

//                   <span
//                     className={cn(
//                       "relative z-10 mt-1 text-[10px] font-semibold tracking-wide transition-colors duration-300",
//                       active
//                         ? "text-purple-700 dark:text-purple-300"
//                         : "text-neutral-500 dark:text-neutral-400"
//                     )}
//                   >
//                     {item.label}
//                   </span>
//                 </Link>
//               </div>
//             );
//           })}
//         </motion.div>
//       </div>
//     </nav>
//   );
// }

// "use client";

// import Link from "next/link";
// import { usePathname, useRouter } from "next/navigation";
// import { motion, type PanInfo } from "framer-motion";
// import { clsx, type ClassValue } from "clsx";
// import { twMerge } from "tailwind-merge";
// import {
//   useCallback,
//   useEffect,
//   useLayoutEffect,
//   useRef,
//   useState,
// } from "react";
// import { SendHorizontal } from "./animate-ui/icons/send-horizontal";
// import { AnimateIcon } from "./animate-ui/icons/icon";
// import { HouseWifiIcon } from "./animate-ui/icons/house-wifi";
// import { GalleryVerticalEnd } from "./animate-ui/icons/gallery-horizontal-end";
// import { ScanLineIcon, HouseIcon, CompassIcon, GalleryHorizontalIcon } from "@animateicons/react/lucide";
// import { AddSquareIcon, SendIcon, Layers01Icon } from "@animateicons/react/huge";

// function cn(...inputs: ClassValue[]) {
//   return twMerge(clsx(inputs));
// }

// interface NavItem {
//   href: string;
//   label: string;
//   icon: React.ElementType;
// }

// const NAV_ITEMS: NavItem[] = [
//   { href: "/chats", label: "Chats", icon: SendIcon },
//   { href: "/forum", label: "Feed", icon: GalleryHorizontalIcon },
//   { href: "/", label: "Home", icon: HouseIcon },
//   { href: "/post", label: "Post", icon: AddSquareIcon },
//   { href: "/explore", label: "Explore", icon: CompassIcon },

// ];

// const ITEM_WIDTH = 64;
// const CENTER_ITEM = NAV_ITEMS[Math.floor(NAV_ITEMS.length / 2)]; // Post
// const SWIPE_THRESHOLD = 40; // px of horizontal drag to trigger tab change

// function isActive(pathname: string, href: string): boolean {
//   if (href === "/") return pathname === "/";
//   return pathname === href || pathname.startsWith(`${href}/`);
// }

// export function BottomNav() {
//   const pathname = usePathname() || "/";
//   const router = useRouter();
//   const containerRef = useRef<HTMLDivElement>(null);
//   const [containerWidth, setContainerWidth] = useState(448);
//   const didInit = useRef(false);

//   const triggerHaptic = useCallback(async (style: "heavy" | "heavy" = "heavy") => {
//     try {
//       const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
//       await Haptics.impact({
//         style: style === "heavy" ? ImpactStyle.Heavy : ImpactStyle.Heavy,
//       });
//     } catch (error) {
//       // Silently fail in standard browser
//     }
//   }, []);

//   // ---------------------------------------------------------
//   // 1. On app open → land on the center tab (once per app load)
//   // ---------------------------------------------------------
//   useEffect(() => {
//     if (didInit.current) return;
//     didInit.current = true;
//     if (pathname === "/") {
//       router.replace(CENTER_ITEM!.href); // opens on /post
//     }
//   }, [pathname, router]);

//   // Measure container width for exact centering
//   useLayoutEffect(() => {
//     const el = containerRef.current;
//     if (!el) return;
//     const update = () => setContainerWidth(el.offsetWidth);
//     update();
//     const ro = new ResizeObserver(update);
//     ro.observe(el);
//     return () => ro.disconnect();
//   }, []);

//   if (
//     pathname.startsWith("/admin") ||
//     pathname.startsWith("/login") ||
//     pathname.startsWith("/signup") ||
//     pathname.startsWith("/onboarding") ||
//     (pathname.startsWith("/chats/") && pathname !== "/chats") ||
//     pathname.startsWith("/profile")

//   ) {
//     return null;
//   }

//   const activeIndex = Math.max(
//     0,
//     NAV_ITEMS.findIndex((item) => isActive(pathname, item.href))
//   );

//   const trackX = containerWidth / 2 - (activeIndex * ITEM_WIDTH + ITEM_WIDTH / 2);

//   // ---------------------------------------------------------
//   // 4. Swipe / slide to change tabs
//   // ---------------------------------------------------------
//   const handleDragEnd = (_: unknown, info: PanInfo) => {
//     if (info.offset.x <= -SWIPE_THRESHOLD && activeIndex < NAV_ITEMS.length - 1) {
//       // Swiped left → next tab
//       router.push(NAV_ITEMS[activeIndex + 1]!.href);
//       triggerHaptic("heavy");
//     } else if (info.offset.x >= SWIPE_THRESHOLD && activeIndex > 0) {
//       // Swiped right → previous tab
//       router.push(NAV_ITEMS[activeIndex - 1]!.href);
//       triggerHaptic("heavy");
//     }
//     // Otherwise the track springs back to the current tab
//   };

//   return (
//     <nav
//       aria-label="Primary"
//       className="fixed !pb-2 inset-x-0 bottom-0 z-50 bg-white/95 backdrop-blur-xl  dark:bg-neutral-950/95 "
//       style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
//     >
//       <div
//         ref={containerRef}
//         className="relative mx-auto h-[76px] max-w-md overflow-hidden"
//       >
//         <motion.div
//           className="flex h-full cursor-grab active:cursor-grabbing"
//           animate={{ x: trackX }}
//           transition={{ type: "spring", stiffness: 320, damping: 30 }}
//           drag="x"
//           dragMomentum={false}
//           dragElastic={0.15}
//           onDragEnd={handleDragEnd}
//         >
//           {NAV_ITEMS.map((item) => {
//             const active = item.href === NAV_ITEMS[activeIndex]!.href;
//             return (
//               <div
//                 key={item.href}
//                 className="flex h-full w-16 shrink-0 gap-1.5 items-center justify-center"
//               >
//                 <Link
//                   href={item.href}
//                   onClick={() => triggerHaptic("heavy")}
//                   className="group relative flex h-full w-full flex-col items-center justify-center outline-none"
//                   aria-current={active ? "page" : undefined}
//                   aria-label={item.label}
//                   draggable={false}
//                 >
//                   {active && (
//                     <motion.div
//                       layoutId="nav-pill"
//                       transition={{ type: "spring", stiffness: 320, damping: 28 }}
//                       className="absolute h-[56px] w-[56px] -mt-2.5 rounded-full bg-white shadow-md dark:bg-white"
//                     />
//                   )}

//                   {/* 3. Active tab scaled to 0.98 */}
//                   <motion.div
//                     animate={{ scale: active ? 1.2 : 1 }}
//                     transition={{ type: "spring", stiffness: 320, damping: 22 }}
//                     className={cn(
//                       "relative z-10 rounded-full",
//                       active ? "-mt-0.5" : "dark:bg-[#404040] bg-[#EEE]"
//                     )}
//                   >
//                     <AnimateIcon animateOnHover>
//                       <item.icon
//                         size={22}
//                         className={cn(
//                           "transition-colors duration-300",
//                           active
//                             ? "text-black dark:text-black"
//                             : "text-neutral-400 group-hover:text-neutral-600 dark:text-[#939393] font-bold p-2"
//                         )}
//                         strokeWidth={active ? 2.2 : 2}
//                         fill={active ? "currentColor" : undefined}
//                       />
//                     </AnimateIcon>
//                   </motion.div>

//                   {/* 2. Label hidden on the active tab */}
//                   {!active && (
//                     <span className="relative z-10 mt-0.5 text-[10px] font-semibold tracking-wide text-neutral-500 transition-colors duration-300 dark:text-neutral-100">
//                       {item.label}
//                     </span>
//                   )}
//                 </Link>
//               </div>
//             );
//           })}
//         </motion.div>
//       </div>
//     </nav>
//   );
// }

// ══════════════════════ CURRENT CODE (before tabs system — used <Link> + router.push, every tab switch re-rendered the page) ══════════════════════

// "use client";

// import Link from "next/link";
// import { usePathname, useRouter } from "next/navigation";
// import { motion, type PanInfo } from "framer-motion";
// import { clsx, type ClassValue } from "clsx";
// import { twMerge } from "tailwind-merge";
// import { useLayoutEffect, useRef, useState } from "react";
// import { useHaptic } from "@/components/ui/haptic";
// import { AnimateIcon } from "./animate-ui/icons/icon";
// import { HouseIcon, CompassIcon, GalleryHorizontalIcon } from "@animateicons/react/lucide";
// import { AddSquareIcon, SendIcon } from "@animateicons/react/huge";
// import { usePostModal } from "@/components/post-modal-provider";

// function cn(...inputs: ClassValue[]) {
//   return twMerge(clsx(inputs));
// }

// interface NavItem {
//   href: string;
//   label: string;
//   icon: React.ElementType;
// }

// const NAV_ITEMS: NavItem[] = [
//   { href: "/chats", label: "Chats", icon: SendIcon },
//   { href: "/forum", label: "Feed", icon: GalleryHorizontalIcon },
//   { href: "/", label: "Home", icon: HouseIcon },
//   { href: "/explore", label: "Explore", icon: CompassIcon },
//   { href: "/post", label: "Post", icon: AddSquareIcon },
// ];

// const ITEM_WIDTH = 64;
// const POST_HREF = "/post";
// const SWIPE_THRESHOLD = 40; // px of horizontal drag to trigger tab change

// function isActive(pathname: string, href: string): boolean {
//   if (href === "/") return pathname === "/";
//   return pathname === href || pathname.startsWith(`${href}/`);
// }

// export function BottomNav() {
//   const pathname = usePathname() || "/";
//   const router = useRouter();
//   const { openPostModal } = usePostModal();
//   const containerRef = useRef<HTMLDivElement>(null);
//   const [containerWidth, setContainerWidth] = useState(448);
//   const didInit = useRef(false);

//   const triggerHaptic = useHaptic("heavy");

//   // ---------------------------------------------------------
//   // Measure container width for exact centering
//   // ---------------------------------------------------------
//   useLayoutEffect(() => {
//     const el = containerRef.current;
//     if (!el) return;
//     const update = () => setContainerWidth(el.offsetWidth);
//     update();
//     const ro = new ResizeObserver(update);
//     ro.observe(el);
//     return () => ro.disconnect();
//   }, []);

//   if (
//     pathname.startsWith("/admin") ||
//     pathname.startsWith("/login") ||
//     pathname.startsWith("/signup") ||
//     pathname.startsWith("/onboarding") ||
//     (pathname.startsWith("/chats/") && pathname !== "/chats") ||
//     pathname.startsWith("/profile") ||
//     pathname.startsWith("/explore/sell") ||
//     pathname.startsWith("/explore/buy")


//   ) {
//     return null;
//   }

//   // Post only counts as "active" if user deep-linked to /post directly.
//   // Since taps/swipes open the modal instead of navigating, the pill
//   // normally won't rest on Post.
//   const activeIndex = Math.max(
//     0,
//     NAV_ITEMS.findIndex((item) => isActive(pathname, item.href))
//   );

//   // THE TRACK MATH:
//   // Shift the whole row so the active item's center aligns with container center.
//   // Edge icons simply slide off-screen — overflow-hidden clips them.
//   const trackX = containerWidth / 2 - (activeIndex * ITEM_WIDTH + ITEM_WIDTH / 2);

//   // ---------------------------------------------------------
//   // Navigate or open the Post modal (tap on Post item)
//   // ---------------------------------------------------------
//   const handlePostClick = () => {
//     triggerHaptic();
//     openPostModal();
//   };

//   // ---------------------------------------------------------
//   // Swipe / slide to change tabs
//   // ---------------------------------------------------------
//   const handleDragEnd = (_: unknown, info: PanInfo) => {
//     const go = (index: number) => {
//       const target = NAV_ITEMS[index];
//       if (!target) return;

//       if (target.href === POST_HREF) {
//         // Swiping onto Post opens the modal; the track springs
//         // back to the current tab since no navigation happened.
//         triggerHaptic();
//         openPostModal();
//         return;
//       }

//       router.push(target.href);
//       triggerHaptic();
//     };

//     if (info.offset.x <= -SWIPE_THRESHOLD && activeIndex < NAV_ITEMS.length - 1) {
//       // Swiped left → next tab
//       go(activeIndex + 1);
//     } else if (info.offset.x >= SWIPE_THRESHOLD && activeIndex > 0) {
//       // Swiped right → previous tab
//       go(activeIndex - 1);
//     }
//     // Otherwise the track springs back to the current tab
//   };

//   return (
//     <nav
//       aria-label="Primary"
//       className="fixed inset-x-0 bottom-0 z-50 bg-white/95 backdrop-blur-xl dark:bg-neutral-950/95"
//       style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.25rem)" }}
//     >
//       <div
//         ref={containerRef}
//         className="relative mx-auto h-[76px] max-w-md overflow-hidden"
//       >
//         <motion.div
//           className="flex h-full cursor-grab active:cursor-grabbing"
//           animate={{ x: trackX }}
//           transition={{ type: "spring", stiffness: 320, damping: 30 }}
//           drag="x"
//           dragMomentum={false}
//           dragElastic={0.15}
//           onDragEnd={handleDragEnd}
//         >
//           {NAV_ITEMS.map((item) => {
//             const active = item.href === NAV_ITEMS[activeIndex]!.href;
//             const isPost = item.href === POST_HREF;

//             const inner = (
//               <>
//                 {/* Pill — lives INSIDE the item, so it rides the track too */}
//                 {active && (
//                   <motion.div
//                     layoutId="nav-pill"
//                     transition={{ type: "spring", stiffness: 320, damping: 28 }}
//                     className="absolute h-[56px] w-[56px] -mt-2.5 rounded-full bg-white shadow-md dark:bg-white"
//                   />
//                 )}

//                 {/* Icon */}
//                 <motion.div
//                   animate={{ scale: active ? 1.2 : 1 }}
//                   transition={{ type: "spring", stiffness: 320, damping: 22 }}
//                   className={cn(
//                     "relative z-10 rounded-full",
//                     active ? "-mt-0.5" : "dark:bg-[#404040] bg-[#EEE]"
//                   )}
//                 >
//                   <AnimateIcon animateOnHover>
//                     <item.icon
//                       size={22}
//                       className={cn(
//                         "transition-colors duration-300",
//                         active
//                           ? "text-black dark:text-black"
//                           : "text-neutral-400 group-hover:text-neutral-600 dark:text-[#939393] font-bold p-2"
//                       )}
//                       strokeWidth={active ? 2.2 : 2}
//                       fill={active ? "currentColor" : undefined}
//                     />
//                   </AnimateIcon>
//                 </motion.div>

//                 {/* Label hidden on the active tab */}
//                 {!active && (
//                   <span className="relative z-10 mt-0.5 text-[10px] font-semibold tracking-wide text-neutral-500 transition-colors duration-300 dark:text-neutral-100">
//                     {item.label}
//                   </span>
//                 )}
//               </>
//             );

//             return (
//               <div
//                 key={item.href}
//                 className="flex h-full w-16 shrink-0 gap-1.5 items-center justify-center"
//               >
//                 {isPost ? (
//                   <button
//                     type="button"
//                     onClick={handlePostClick}
//                     aria-label={item.label}
//                     className="group relative flex h-full w-full flex-col items-center justify-center outline-none"
//                   >
//                     {inner}
//                   </button>
//                 ) : (
//                   <Link
//                     href={item.href}
//                     onClick={() => triggerHaptic()}
//                     aria-current={active ? "page" : undefined}
//                     aria-label={item.label}
//                     draggable={false}
//                     className="group relative flex h-full w-full flex-col items-center justify-center outline-none"
//                   >
//                     {inner}
//                   </Link>
//                 )}
//               </div>
//             );
//           })}
//         </motion.div>
//       </div>
//     </nav>
//   );
// }
// ══════════════════════ NEW CODE — tabs system (keep-alive, no reload on switch) ══════════════════════

"use client";

import { usePathname } from "next/navigation";
import { motion, type PanInfo } from "framer-motion";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { HouseIcon, CompassIcon, GalleryHorizontalIcon } from "@animateicons/react/lucide";
import { AddSquareIcon, SendIcon } from "@animateicons/react/huge";
import { usePostModal } from "@/components/post-modal-provider";
import { useSwitchTab, type TabRoute } from "@/components/tab-navigation";
import { LiquidGlass } from "@/components/ui/liquid-glass";
import { useNavStyle } from "@/lib/nav-style";
import { Glass, type GlassOptics } from "@samasante/liquid-glass";

const IOS26_NAV_OPTICS: Partial<GlassOptics> = {
  strength: 0.08,
  depth: 0.35,
  curvature: 0.45,
  bend: 0.25,
  bendWidth: 0.08,
  dispersion: 0.25,
  specular: 1,
  sheenAngle: 50,
  sheen: 0.95,
  sheenWidth: 2,
  sheenFalloff: 1.5,
  glow: 0.15,
  glowSpread: 1,
  glowFalloff: 1.5,
  frost: 3,
  saturate: 1.85,
  brightness: 0.04,
};

const IOS26_LENS_OPTICS: Partial<GlassOptics> = {
  strength: 0.14,
  depth: 0.45,
  curvature: 0.55,
  bend: 0.3,
  bendWidth: 0.1,
  dispersion: 0.3,
  specular: 1,
  sheenAngle: 50,
  sheen: 0.95,
  sheenWidth: 2,
  glow: 0.18,
  frost: 1,
  saturate: 1.9,
  brightness: 0.06,
};

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface NavItem {
  href: TabRoute | typeof POST_HREF;
  label: string;
  icon: React.ElementType;
}

const POST_HREF = "/post";

const NAV_ITEMS: NavItem[] = [
  { href: "/chats", label: "Chats", icon: SendIcon },
  { href: "/forum", label: "Feed", icon: GalleryHorizontalIcon },
  { href: "/", label: "Home", icon: HouseIcon },
  { href: "/explore", label: "Explore", icon: CompassIcon },
  { href: POST_HREF, label: "Post", icon: AddSquareIcon },
];

// Glass bar order: Home · Feed · Post · Explore · Chat
const GLASS_NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home", icon: HouseIcon },
  { href: "/forum", label: "Feed", icon: GalleryHorizontalIcon },
  { href: POST_HREF, label: "Post", icon: AddSquareIcon },
  { href: "/explore", label: "Explore", icon: CompassIcon },
  { href: "/chats", label: "Chat", icon: SendIcon },
];

const ITEM_WIDTH = 64;
const SWIPE_THRESHOLD = 30; // px of horizontal drag to trigger tab change
const DRAG_LIMIT = 20; // max px the track follows the finger — keeps the swipe stiff
const DOUBLE_SWIPE_DISTANCE = 180; // swipe intensity (px) that jumps 2 tabs instead of 1
const FLICK_PROJECTION = 0.12; // seconds of release velocity added to the drag distance
const PASS_STEP_MS = 90; // time the track lingers on each tab it glides over in a multi-tab swipe

// Stiff, no-overshoot spring for the track: short travel, settles fast.
const TRACK_SPRING = { type: "spring", stiffness: 520, damping: 44, mass: 0.8 } as const;

interface IconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isNavHidden(pathname: string): boolean {
  return (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/onboarding") ||
    (pathname.startsWith("/chats/") && pathname !== "/chats") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/explore/") || // My posts / My responses (orders) and other explore sub-pages
    pathname.startsWith("/demands") ||
    pathname.startsWith("/credits") ||
    // Secondary pages: they have their own back button instead of the tab bar.
    SECONDARY_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  );
}

const SECONDARY_PAGES = [
  "/settings",
  "/notifications",
  "/activity",
  "/bookmarks",
  "/communities",
  "/invoices",
  "/featured",
  "/my-slots",
  "/my-demands",
];

// Direct heavy impact — not routed through the shared haptic() dedupe, so
// every switch (tap or swipe) buzzes. Shared by both nav styles.
async function triggerHaptic() {
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    await Haptics.impact({ style: ImpactStyle.Heavy });
  } catch {
    // Silently fail in standard browser
  }
}

/** Tab switching + Post modal, shared by both nav styles. */
function useNavActions() {
  const switchTab = useSwitchTab();
  const { openPostModal } = usePostModal();

  const go = (href: NavItem["href"]) => {
    triggerHaptic();
    if (href === POST_HREF) {
      openPostModal();
      return;
    }
    switchTab(href);
  };

  const handleTabClick = (e: MouseEvent<HTMLAnchorElement>, href: NavItem["href"]) => {
    // Let ctrl/cmd/middle-click open a real new browser tab
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    go(href);
  };

  return { go, handleTabClick };
}

export function BottomNav() {
  const pathname = usePathname() || "/";
  const navStyle = useNavStyle();

  if (isNavHidden(pathname)) return null;

  const items = navStyle === "modern" ? NAV_ITEMS : GLASS_NAV_ITEMS;
  const activeIndex = Math.max(
    0,
    items.findIndex((item) => isActive(pathname, item.href))
  );

  return navStyle === "modern" ? (
    <ModernBottomNav activeIndex={activeIndex} />
  ) : (
    <GlassBottomNav activeIndex={activeIndex} />
  );
}

/* ══════════════════════ MODERN — sliding centered track ══════════════════════ */

function ModernBottomNav({ activeIndex: routeIndex }: { activeIndex: number }) {
  const { go, handleTabClick } = useNavActions();
  const [containerWidth, setContainerWidth] = useState(448);
  // Tab the track is visually passing over during a multi-tab swipe. It only
  // moves the highlight — the tab itself isn't opened/loaded. null = follow the route.
  const [passIndex, setPassIndex] = useState<number | null>(null);
  const passTimers = useRef<number[]>([]);
  const activeIndex = passIndex ?? routeIndex;

  // Route caught up with the swipe target → hand control back to the route.
  useEffect(() => setPassIndex(null), [routeIndex]);
  useEffect(() => () => passTimers.current.forEach(window.clearTimeout), []);
  const iconRefs = useRef<(IconHandle | null)[]>([]);
  // Index whose icon last played its animation — null until first settle,
  // so the icon doesn't animate on app load.
  const animatedIndex = useRef<number | null>(null);
  const resizeObserver = useRef<ResizeObserver | null>(null);

  // ---------------------------------------------------------
  // Measure container width for exact centering.
  // Callback ref: re-attaches every time the element mounts (e.g. coming
  // back from a page where the nav is hidden). A detached element reports
  // width 0, which would push the whole track off-screen — ignore it.
  // ---------------------------------------------------------
  const containerRef = useCallback((el: HTMLDivElement | null) => {
    resizeObserver.current?.disconnect();
    resizeObserver.current = null;
    if (!el) return;
    const update = () => {
      const width = el.offsetWidth;
      if (width > 0) setContainerWidth(width);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    resizeObserver.current = ro;
  }, []);

  useEffect(() => () => resizeObserver.current?.disconnect(), []);

  // THE TRACK MATH:
  // Shift the whole row so the active item's center aligns with container center.
  // Edge icons simply slide off-screen — overflow-hidden clips them.
  const trackX = containerWidth / 2 - (activeIndex * ITEM_WIDTH + ITEM_WIDTH / 2);
  const isFeed = NAV_ITEMS[activeIndex]!.href === "/";

  // ---------------------------------------------------------
  // Play the icon animation only once the selected tab has
  // finished sliding into the center (not on hover, not mid-slide,
  // not when a failed swipe springs back to the same tab).
  // ---------------------------------------------------------
  const handleTrackSettled = () => {
    if (animatedIndex.current === null) {
      animatedIndex.current = activeIndex;
      return;
    }
    if (animatedIndex.current === activeIndex) return;
    animatedIndex.current = activeIndex;
    iconRefs.current[activeIndex]?.startAnimation();
  };

  // ---------------------------------------------------------
  // Swipe / slide the track to change tabs
  // ---------------------------------------------------------
  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (Math.abs(info.offset.x) < SWIPE_THRESHOLD) return; // springs back to the current tab

    // Intensity = how far the finger went + a flick bonus from release speed.
    // A long drag or a fast flick jumps 2 tabs; a normal swipe moves 1.
    const intensity = Math.abs(info.offset.x + info.velocity.x * FLICK_PROJECTION);
    const steps = intensity >= DOUBLE_SWIPE_DISTANCE ? 2 : 1;
    const direction = info.offset.x < 0 ? 1 : -1; // swiped left → next tab
    const from = routeIndex;
    const target = Math.min(NAV_ITEMS.length - 1, Math.max(0, from + direction * steps));
    if (target === from) return;

    passTimers.current.forEach(window.clearTimeout);
    passTimers.current = [];

    // Glide over every tab in between (highlight + haptic tick only, nothing
    // loads), then open just the final tab.
    for (let i = from + direction, step = 0; i !== target; i += direction, step++) {
      const index = i;
      passTimers.current.push(
        window.setTimeout(() => {
          setPassIndex(index);
          triggerHaptic();
        }, step * PASS_STEP_MS)
      );
    }

    const intermediate = Math.abs(target - from) - 1;
    passTimers.current.push(
      window.setTimeout(() => {
        setPassIndex(target); // hold the highlight on target until the route updates
        go(NAV_ITEMS[target]!.href);
        // Post opens a modal (no route change) → spring back to the current tab.
        if (NAV_ITEMS[target]!.href === POST_HREF) setPassIndex(null);
      }, intermediate * PASS_STEP_MS)
    );
  };

  return (
    <nav
      aria-label="Primary"
      data-no-haptic // nav fires its own haptic; skip the global tap handler (no double buzz)
      className="fixed inset-x-0 bottom-0 z-50 bg-white/95 backdrop-blur-xl dark:bg-neutral-950/95"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.25rem)" }}
    >
      {/* Soft fade above the bar's top edge so content melts into the nav
          instead of being cut off by a hard line. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-full h-14">
        {/* Blur layer, faded out upward by its mask */}
        <div
          className="absolute inset-0 backdrop-blur-md"
          style={{
            maskImage: "linear-gradient(to top, #000 0%, #000 25%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(to top, #000 0%, #000 25%, transparent 100%)",
          }}
        />
        {/* Tint layer: eased stops (no mask), so the upper half still covers */}
        <div className="absolute inset-0 bg-[linear-gradient(to_top,rgb(255_255_255/0.95)_0%,rgb(255_255_255/0.85)_25%,rgb(255_255_255/0.6)_50%,rgb(255_255_255/0.3)_75%,rgb(255_255_255/0)_100%)] dark:bg-[linear-gradient(to_top,rgb(10_10_10/0.95)_0%,rgb(10_10_10/0.85)_25%,rgb(10_10_10/0.6)_50%,rgb(10_10_10/0.3)_75%,rgb(10_10_10/0)_100%)]" />
      </div>
      <div
        ref={containerRef}
        className="relative mx-auto h-[76px] max-w-md overflow-hidden"
      >
        <motion.div
          role="tablist"
          className="flex h-full cursor-grab active:cursor-grabbing"
          animate={{ x: trackX }}
          transition={TRACK_SPRING}
          onAnimationComplete={handleTrackSettled}
          drag="x"
          dragMomentum={false}
          dragConstraints={{ left: trackX - DRAG_LIMIT, right: trackX + DRAG_LIMIT }}
          dragElastic={0.04}
          dragTransition={{ bounceStiffness: 600, bounceDamping: 40 }}
          onDragEnd={handleDragEnd}
        >
          {NAV_ITEMS.map((item, index) => {
            const active = index === activeIndex;
            const isPost = item.href === POST_HREF;

            const inner = (
              <>
                {/* Each tab owns its background — nothing slides between tabs.
                    Only the centered tab scales up. */}
                <motion.div
                  initial={false}
                  animate={{ scale: active ? 1.15 : 1 }}
                  transition={{ type: "spring", stiffness: 520, damping: 34 }}
                  className={cn(
                    "relative z-10 flex items-center justify-center rounded-full transition-colors duration-200",
                    active
                      ? "h-[52px] w-[52px] bg-white text-[#111] shadow-md"
                      : "h-[38px] w-[38px] bg-[#222] text-neutral-300",
                    // Feed only: thick ring with a gap around the white circle
                    active &&
                      isFeed &&
                      "outline outline-[3px] outline-offset-[3px] outline-[#111] dark:outline-white"
                  )}
                >
                  <item.icon
                    ref={(handle: IconHandle | null) => {
                      iconRefs.current[index] = handle;
                    }}
                    size={22}
                  />
                </motion.div>

                {/* Label hidden on the active tab */}
                {!active && (
                  <span className="relative z-10 mt-0.5 text-[10px] font-semibold tracking-wide text-neutral-500 transition-colors duration-300 dark:text-neutral-100">
                    {item.label}
                  </span>
                )}
              </>
            );

            return (
              <div
                key={item.href}
                className="flex h-full w-16 shrink-0 gap-1.5 items-center justify-center"
              >
                {isPost ? (
                  <button
                    type="button"
                    onClick={() => go(POST_HREF)}
                    aria-label={item.label}
                    className="group relative flex h-full w-full flex-col items-center justify-center outline-none"
                  >
                    {inner}
                  </button>
                ) : (
                  // Plain <a> instead of <Link>: the click is intercepted and the
                  // tab is switched in place (no route load); href keeps long-press /
                  // open-in-new-tab working.
                  <a
                    href={item.href}
                    role="tab"
                    onClick={(e) => handleTabClick(e, item.href)}
                    aria-selected={active}
                    aria-current={active ? "page" : undefined}
                    aria-label={item.label}
                    draggable={false}
                    className="group relative flex h-full w-full flex-col items-center justify-center outline-none"
                  >
                    {inner}
                  </a>
                )}
              </div>
            );
          })}
        </motion.div>
      </div>
    </nav>
  );
}

/* ══════════════════════ GLASS — floating liquid-glass bar, icons stay put ══════════════════════ */

const BAR_PADDING = 5; // px between the bar edge and the selection pill
const SELECT_SPRING = { type: "spring", stiffness: 420, damping: 34, mass: 0.9 } as const;
const MORPH_SPRING = { type: "spring", stiffness: 600, damping: 30 } as const;
const MORPH_MS = 340; // how long the selection stays a magnifying lens while it travels

function GlassBottomNav({ activeIndex }: { activeIndex: number }) {
  const { go, handleTabClick } = useNavActions();
  const iconRefs = useRef<(IconHandle | null)[]>([]);
  const previousIndex = useRef(activeIndex);
  // true while the selection travels: it swells into a clear refracting
  // lens (the way iOS does it), then settles back into the frosted pill.
  const [morphing, setMorphing] = useState(false);
  // Shrink state: when the user scrolls down, the navbar shrinks
  const [shrunk, setShrunk] = useState(false);

  useEffect(() => {
    if (previousIndex.current === activeIndex) return;
    previousIndex.current = activeIndex;
    iconRefs.current[activeIndex]?.startAnimation();
    setMorphing(true);
    const t = window.setTimeout(() => setMorphing(false), MORPH_MS);
    return () => window.clearTimeout(t);
  }, [activeIndex]);

  // Scroll-based shrink: shrink smoothly when scrolling down, restore when scrolling up
  useEffect(() => {
    let lastScrollY = window.scrollY;
    let ticking = false;

    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const currentY = window.scrollY;
        const delta = currentY - lastScrollY;
        if (currentY > 60 && delta > 10) {
          setShrunk(true);
          lastScrollY = currentY;
        } else if (currentY <= 20 || delta < -10) {
          setShrunk(false);
          lastScrollY = currentY;
        }
        ticking = false;
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Both selection layers ride the same x: one slot = 100% of their own width.
  const slotStyle = {
    top: BAR_PADDING,
    bottom: BAR_PADDING,
    left: BAR_PADDING,
    width: `calc((100% - ${BAR_PADDING * 2}px) / ${GLASS_NAV_ITEMS.length})`,
  };
  const slotX = `${activeIndex * 100}%`;
  const morphScale = morphing ? { scaleX: 1.32, scaleY: 1.2 } : { scaleX: 1, scaleY: 1 };

  return (
    <nav
      aria-label="Primary"
      data-no-haptic // nav fires its own haptic; skip the global tap handler (no double buzz)
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50"
      style={{
        paddingBottom: "max(env(safe-area-inset-bottom), 0.75rem)",
        transition: "transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)",
      }}
    >
      <motion.div
        className="pointer-events-auto mx-auto max-w-md px-4"
        style={{ transformOrigin: "bottom center" }}
        animate={{ scale: shrunk ? 0.9 : 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 28, mass: 0.9 }}
      >
        <Glass
          radius={29}
          optics={IOS26_NAV_OPTICS}
          className="h-[58px] w-full rounded-full shadow-[0_10px_36px_rgba(0,0,0,0.45)]"
          style={{ background: "rgba(255, 255, 255, 0.10)" }}
        >
          <div role="tablist" className="relative grid h-full grid-cols-5" style={{ padding: BAR_PADDING }}>
            {/* Resting selection: soft frosted pill under the icon */}
            <motion.div
              aria-hidden
              className="pointer-events-none absolute"
              style={slotStyle}
              initial={false}
              animate={{ x: slotX }}
              transition={SELECT_SPRING}
            >
              <motion.div
                className="h-full w-full rounded-full bg-white/[0.16]"
                initial={false}
                animate={{ ...morphScale, opacity: morphing ? 0 : 1 }}
                transition={MORPH_SPRING}
              />
            </motion.div>

            {GLASS_NAV_ITEMS.map((item, index) => {
              const active = index === activeIndex;
              const isPost = item.href === POST_HREF;
              const icon = (
                <motion.span
                  className={cn(
                    "relative flex items-center justify-center transition-colors duration-200",
                    active ? "text-white" : "text-white/75",
                  )}
                  whileTap={{ scale: 0.86 }}
                  transition={{ type: "spring", stiffness: 600, damping: 30 }}
                >
                  <item.icon
                    ref={(handle: IconHandle | null) => {
                      iconRefs.current[index] = handle;
                    }}
                    size={24}
                  />
                </motion.span>
              );
              const cls =
                "relative z-10 flex h-full w-full items-center justify-center rounded-full outline-none";

              return isPost ? (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => go(POST_HREF)}
                  aria-label={item.label}
                  className={cls}
                >
                  {icon}
                </button>
              ) : (
                <a
                  key={item.href}
                  href={item.href}
                  role="tab"
                  onClick={(e) => handleTabClick(e, item.href)}
                  aria-selected={active}
                  aria-current={active ? "page" : undefined}
                  aria-label={item.label}
                  draggable={false}
                  className={cls}
                >
                  {icon}
                </a>
              );
            })}

            {/* Travelling lens: sits ABOVE the icons so it magnifies/refracts
                them while it moves, then fades back into the resting pill. */}
            <motion.div
              aria-hidden
              className="pointer-events-none absolute z-20"
              style={slotStyle}
              initial={false}
              animate={{ x: slotX }}
              transition={SELECT_SPRING}
            >
              <motion.div
                className="h-full w-full"
                initial={false}
                animate={{ ...morphScale, opacity: morphing ? 1 : 0 }}
                transition={MORPH_SPRING}
              >
                <Glass
                  radius={24}
                  optics={IOS26_LENS_OPTICS}
                  className="h-full w-full rounded-full shadow-[0_4px_18px_rgba(0,0,0,0.35)]"
                  style={{ background: "rgba(255, 255, 255, 0.14)" }}
                />
              </motion.div>
            </motion.div>
          </div>
        </Glass>
      </motion.div>
    </nav>
  );
}
