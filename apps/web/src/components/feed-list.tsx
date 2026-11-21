"use client";

import { useEffect, useRef } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Loader2, SearchX } from "lucide-react";
import { DemandCard, type DemandCardData } from "@/components/demand-card";
import { demandsFeedQueryOptions, type FeedFilters } from "@/lib/demands-feed";
import { useCardLayout } from "@/lib/card-layout";

export function FeedList({ filters = {} }: { filters?: FeedFilters }) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const layout = useCardLayout();

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useInfiniteQuery(demandsFeedQueryOptions(filters));

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const demands = data?.pages.flatMap((p) => p.demands) ?? [];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-[20px] bg-[#1C1C1E]">
            <div className="h-28 animate-pulse bg-[#2C2C2E]" />
            <div className="space-y-2 p-3">
              <div className="h-2.5 w-2/3 animate-pulse rounded-full bg-[#2C2C2E]" />
              <div className="h-2.5 w-full animate-pulse rounded-full bg-[#2C2C2E]" />
              <div className="h-2.5 w-1/2 animate-pulse rounded-full bg-[#2C2C2E]" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const isFiltered = Boolean(filters.category || filters.lat != null);

  if (demands.length === 0) {
    return (
      <div className="rounded-[20px] bg-[#1C1C1E] px-8 py-10 text-center">
        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#2C2C2E]">
          <SearchX className="h-6 w-6 text-[#EBEBF5]/60" />
        </span>
        <p className="text-[17px] font-semibold tracking-[-0.01em] text-white">No requests found</p>
        <p className="mx-auto mt-1.5 max-w-[260px] text-[13px] leading-snug text-[#EBEBF5]/60">
          {isFiltered
            ? "No requests match your selected category or 25 km radius. Try clearing filters, or post one in your area."
            : "No open requests right now. Check back soon, or be the first to post one."}
        </p>
      </div>
    );
  }

  return (
    <div className="relative grid grid-cols-2 gap-2 pb-1.5 sm:grid-cols-2 lg:grid-cols-2">
      {demands.map((demand) => (
        <DemandCard key={demand.id} demand={demand} layout={layout} />
      ))}
      <div ref={sentinelRef} className="col-span-2 flex justify-center py-4">
        {isFetchingNextPage && (
          <Loader2 className="h-5 w-5 animate-spin text-[#EBEBF5]/60" />
        )}
      </div>
    </div>
  );
}


// "use client";

// import { useEffect, useRef } from "react";
// import { useInfiniteQuery } from "@tanstack/react-query";
// import { Loader2 } from "lucide-react";
// import { DemandCard, type DemandCardData } from "@/components/demand-card";
// import { PullToRefresh } from "@/components/pull-to-refresh";

// interface FeedPage {
//   demands: DemandCardData[];
//   nextCursor: string | null;
// }

// async function fetchFeedPage(cursor: string | null): Promise<FeedPage> {
//   const url = new URL("/api/demands", window.location.origin);
//   if (cursor) url.searchParams.set("cursor", cursor);
//   const res = await fetch(url.toString());
//   if (!res.ok) throw new Error("Failed to load feed");
//   return res.json();
// }

// export function FeedList() {
//   const sentinelRef = useRef<HTMLDivElement>(null);

//   const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, refetch } = useInfiniteQuery({
//     queryKey: ["demands-feed"],
//     queryFn: ({ pageParam }) => fetchFeedPage(pageParam),
//     initialPageParam: null as string | null,
//     getNextPageParam: (lastPage) => lastPage.nextCursor,
//   });

//   useEffect(() => {
//     const el = sentinelRef.current;
//     if (!el) return;
//     const observer = new IntersectionObserver(
//       (entries) => {
//         if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
//           void fetchNextPage();
//         }
//       },
//       { rootMargin: "200px" },
//     );
//     observer.observe(el);
//     return () => observer.disconnect();
//   }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

//   const demands = data?.pages.flatMap((p) => p.demands) ?? [];

//   if (isLoading) {
//     return (
//       <div className="flex justify-center py-12 text-neutral-400">
//         <Loader2 className="h-6 w-6 animate-spin" />
//       </div>
//     );
//   }

//   if (demands.length === 0) {
//     return (
//       <div className="card-shell p-8 text-center text-sm text-neutral-500">
//         No open requests right now. Check back soon, or be the first to post one.
//       </div>
//     );
//   }  

//   return (
//   //  <PullToRefresh onRefresh={async () => refetch()}>
//   <div className="relative grid grid-cols-2 gap-2.5 px-1 pb-2 sm:grid-cols-2 lg:grid-cols-2">
//     {demands.map((demand) => (
//       <DemandCard key={demand.id} demand={demand} />
//     ))}
//     <div ref={sentinelRef} className="col-span-2 flex justify-center py-4">
//       {isFetchingNextPage && <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />}
//     </div>
//   </div>
// // </PullToRefresh>
//   );
// }


//  old code 



// "use client";

// import { motion, PanInfo, useMotionValue, useTransform } from "framer-motion";
// import Image from "next/image";
// import React, { useState } from "react";

// // Your images live here. Swap these out or pass your own via the `cards` prop.
// const defaultCards = [
//   {
//     id: 1,
//     img: "https://cdn.21st.dev/assets/mirror/c4/c4897a1bec4558fde4b955e1c5502b8edbc6b7c16e95e9aa55088de17fa9a843.jpg",
//   },
//   {
//     id: 2,
//     img: "https://cdn.21st.dev/assets/mirror/c5/c59885ef893eb494af268a9817f69d74df81b808c32b42a95d409c0d9fc8fa5e.jpg",
//   },
//   {
//     id: 3,
//     img: "https://cdn.21st.dev/assets/mirror/d0/d0d42b2410bfa5189ed7477a10651e1131e236c064cf7d0401858a6f32686d55.jpg",
//   },
//   {
//     id: 4,
//     img: "https://cdn.21st.dev/assets/mirror/c7/c74a36fb6d8aa8555994f7864cef5cafd63dacaf51f0c7b56cb92c4a7a6841eb.jpg",
//   },
//   {
//     id: 5,
//     img: "https://cdn.21st.dev/assets/mirror/65/65886795affef649de28e939dc146c40c4eae14c9d08b069fa203188278a8f44.jpg",
//   },
// ];

// // Change how the stack looks and feels here — no need to touch the logic below.
// const defaultSettings = {
//   width: 320, // card width in px (this is the desktop/base size)
//   height: 320, // card height in px (this is the desktop/base size)
//   radius: 16, // corner roundness in px
//   swipeThreshold: 120, // how far someone has to drag before the card flies off
//   stackRotation: 5, // degrees each card behind the front one tilts
//   stackScale: 0.035, // how much smaller each card behind the front one gets
//   tiltStrength: 25, // how far the card tilts while dragging (3D effect)
//   springStiffness: 300, // how snappy the drag/return animation feels
//   springDamping: 30, // how quickly the bounce settles
//   // Below this viewport width, cards shrink by mobileScale. Tweak either value
//   // to control how small (or whether) the stack shrinks on phones.
//   mobileBreakpoint: 480,
//   mobileScale: 0.8,
// };

// export type SwipeCardsSettings = typeof defaultSettings;

// export interface SwipeCardItem {
//   id: number | string;
//   img: string;
// }

// interface SwipeCardProps {
//   children: React.ReactNode;
//   isFront: boolean;
//   zIndex: number;
//   onSendToBack: () => void;
//   settings: SwipeCardsSettings;
// }

// function SwipeCard({
//   children,
//   isFront,
//   zIndex,
//   onSendToBack,
//   settings,
// }: SwipeCardProps) {
//   const x = useMotionValue(0);
//   const y = useMotionValue(0);

//   // These turn your drag distance into a 3D tilt. Bigger tiltStrength = more dramatic tilt.
//   const rotateX = useTransform(
//     y,
//     [-200, 200],
//     [settings.tiltStrength, -settings.tiltStrength],
//   );
//   const rotateY = useTransform(
//     x,
//     [-200, 200],
//     [-settings.tiltStrength, settings.tiltStrength],
//   );

//   function handleDragEnd(
//     _: MouseEvent | TouchEvent | PointerEvent,
//     info: PanInfo,
//   ) {
//     const draggedFarEnough =
//       Math.abs(info.offset.x) > settings.swipeThreshold ||
//       Math.abs(info.offset.y) > settings.swipeThreshold;

//     if (draggedFarEnough) {
//       onSendToBack();
//     } else {
//       // Didn't drag far enough — snap back to center.
//       x.set(0);
//       y.set(0);
//     }
//   }

//   return (
//     <motion.div
//       className="absolute cursor-grab select-none active:cursor-grabbing"
//       style={{
//         width: settings.width,
//         height: settings.height,
//         x: isFront ? x : 0,
//         y: isFront ? y : 0,
//         rotateX: isFront ? rotateX : 0,
//         rotateY: isFront ? rotateY : 0,
//         zIndex,
//       }}
//       drag={isFront}
//       dragConstraints={{ top: 0, right: 0, bottom: 0, left: 0 }}
//       dragElastic={0.5}
//       onDragEnd={handleDragEnd}
//       whileHover={isFront ? { scale: 1.03 } : {}}
//       transition={{
//         type: "spring",
//         stiffness: settings.springStiffness,
//         damping: settings.springDamping,
//       }}
//     >
//       {children}
//     </motion.div>
//   );
// }

// interface SwipeCardsProps {
//   cards?: SwipeCardItem[];
//   // Override any of the defaults above without touching this file again.
//   settings?: Partial<SwipeCardsSettings>;
//   className?: string;
// }

// // Shrinks the stack a bit on small screens so it doesn't feel oversized on mobile.
// // Returns 1 on the server / before mount to avoid a layout jump on first paint.
// function useResponsiveScale(breakpoint: number, mobileScale: number) {
//   const [scale, setScale] = useState(1);

//   React.useEffect(() => {
//     const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
//     const update = () => setScale(mq.matches ? mobileScale : 1);
//     update();
//     mq.addEventListener("change", update);
//     return () => mq.removeEventListener("change", update);
//   }, [breakpoint, mobileScale]);

//   return scale;
// }

// function SwipeCards({
//   cards = defaultCards,
//   settings,
//   className = "",
// }: SwipeCardsProps) {
//   const baseConfig = { ...defaultSettings, ...settings };
//   const scale = useResponsiveScale(
//     baseConfig.mobileBreakpoint,
//     baseConfig.mobileScale,
//   );
//   const config = {
//     ...baseConfig,
//     width: Math.round(baseConfig.width * scale),
//     height: Math.round(baseConfig.height * scale),
//   };
//   const [cardList, setCardList] = useState(cards);

//   // Sends the front card to the back of the pile after a swipe.
//   const moveToBack = (id: number | string) => {
//     setCardList((prev) => {
//       const updated = [...prev];
//       const cardIndex = updated.findIndex((card) => card.id === id);
//       if (cardIndex !== -1) {
//         const [movedCard] = updated.splice(cardIndex, 1);
//         updated.push(movedCard);
//       }
//       return updated;
//     });
//   };

//   return (
//     <div
//       className={`flex items-center justify-center p-6 select-none ${className}`}
//     >
//       <div
//         className="relative mx-auto"
//         style={{
//           width: config.width,
//           height: config.height,
//           perspective: 1200,
//         }}
//       >
//         {cardList.map((card, index) => {
//           const isFront = index === 0;
//           const zIndex = cardList.length - index;

//           return (
//             <SwipeCard
//               key={card.id}
//               isFront={isFront}
//               zIndex={zIndex}
//               settings={config}
//               onSendToBack={() => moveToBack(card.id)}
//             >
//               <motion.div
//                 className="relative h-full w-full overflow-hidden bg-neutral-900 shadow-xl"
//                 style={{ borderRadius: config.radius }}
//                 animate={{
//                   rotateZ: index * config.stackRotation,
//                   scale: 1 - index * config.stackScale,
//                   transformOrigin: "85% 85%",
//                 }}
//                 initial={false}
//                 transition={{ type: "spring", stiffness: 260, damping: 24 }}
//               >
//                 <Image
//                   src={card.img}
//                   alt={`card-${card.id}`}
//                   fill
//                   className="pointer-events-none object-cover"
//                   sizes={`${config.width}px`}
//                   priority={isFront}
//                 />
//               </motion.div>
//             </SwipeCard>
//           );
//         })}
//       </div>
//     </div>
//   );
// }

// // This is a file with a demo for your component
// // That's what users will see in the preview
// // Create new files in this directory to add more demos

// // import { SwipeCards } from "@/components/ui/image-stack-carousel";

// // ONLY DEFAULT EXPORT WILL BE TREATED AS A DEMO
// // export default function FeedList() {
// //   return <SwipeCards />;
// // }


// // File: App.jsx (или ваш главный файл для предпросмотра)

// // import * as React from "react";
// // Мы импортируем ТОЛЬКО чистый компонент. Никаких зависимостей от Framer.
// import { SwipeableCardStack } from "@/components/SwipeableCardStack";

// // Это наш Демо-Контейнер. Его единственная задача - показать компонент в действии.
// export default function FeedList() {
//     // Данные для демонстрации, которые в Framer приходят из property controls
//     const demoProps = {
//         images: [
//             "https://cdn.21st.dev/assets/mirror/ba/baf7e1328606b1be8b7468aa5df391c9b06817f54e2e7ef00ddb1ef3c8096f20.jpg",
//             "https://cdn.21st.dev/assets/mirror/8c/8c6e5dbb7f78c8188e967bd5556b7e2c4bdf5867caa9f9d7e26756041b93467a.jpg",
//             "https://cdn.21st.dev/assets/mirror/0a/0aaa68a0b278e07af2b80b77c12c49c0e880a2ca2eb327dec3447c650e7a0fe9.jpg",
//         ],
//         rightIcon: "https://uploads-ssl.webflow.com/6226162356726c4835057a73/6232367c3761286ddff6004c_icon-like.svg",
//         leftIcon: "https://uploads-ssl.webflow.com/6226162356726c4835057a73/6232367c825de783a6697a3c_icon-dislike.svg",
//         borderRadius: 20,
//     };

//     return (
//         // 1. Контейнер для центрирования и красивого фона
//         <div style={{
//             display: "grid",
//             placeItems: "center",
//             width: "100vw",
//             height: "140vh",
//             background: "#e0e0e0",
//         }}>
//             {/* 2. Обертка, задающая размер карточке */}
//             <div style={{ width: "300px", height: "400px" }}>
//                 {/* 3. Вызываем чистый компонент с нашими демо-пропсами */}
//                 <SwipeableCardStack {...demoProps} />
//             </div>
//             <div className="mt-10">
//             <SwipeCards />
//             </div>
//         </div>
//     );
// }
