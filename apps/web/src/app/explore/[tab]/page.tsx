// "use client";

// import { useEffect, useState } from "react";
// import Link from "next/link";
// import { useParams, useRouter } from "next/navigation";
// import { ArrowLeft, Loader2, Receipt } from "lucide-react";
// import { formatPaise, formatBudgetRange } from "@/lib/money";
// import { CountdownBadge } from "@/components/countdown-badge";
// import { PriorityBadge } from "@/components/priority-badge";
// import { cn } from "@/lib/utils";

// /* ───────── Types ───────── */

// interface MySlot {
//   id: string;
//   slot: number;
//   createdAt: string;
//   demand: {
//     id: string;
//     summary: string;
//     status: string;
//     timelineEnd: string;
//     author: {
//       id: string;
//       name: string;
//       companyName: string | null;
//       avatarUrl: string | null;
//     };
//   };
//   payment: {
//     id: string;
//     amountPaise: number;
//     currency: string;
//     razorpayPaymentId: string | null;
//     createdAt: string;
//   } | null;
// }

// interface MyDemand {
//   id: string;
//   summary: string;
//   budgetMin: number | null;
//   budgetMax: number | null;
//   timelineEnd: string;
//   status: "OPEN" | "FILLED" | "EXPIRED" | "CANCELLED";
//   isPriority: boolean;
//   createdAt: string;
//   _count: { bids: number };
// }

// type Tab = "sell" | "buy";
// type SubTab = "active" | "expired";

// /* ───────── Page ───────── */

// export default function MarketplacePage() {
//   const params = useParams();
//   const router = useRouter();

//   /* Derive tab from URL — anything that isn't "buy" falls back to "sell" */
//   const tab: Tab = params.tab === "buy" ? "buy" : "sell";
//   const [subTab, setSubTab] = useState<SubTab>("active");

//   /* ── Data ── */
//   const [demands, setDemands] = useState<MyDemand[] | null>(null);
//   const [slots, setSlots] = useState<MySlot[] | null>(null);

//   useEffect(() => {
//     fetch("/api/my/demands")
//       .then((r) => (r.ok ? r.json() : { demands: [] }))
//       .then((j) => setDemands(j.demands))
//       .catch(() => setDemands([]));
//   }, []);

//   useEffect(() => {
//     fetch("/api/my/slots")
//       .then((r) => (r.ok ? r.json() : { slots: [] }))
//       .then((j) => setSlots(j.slots))
//       .catch(() => setSlots([]));
//   }, []);

//   /* Reset sub-tab when switching main tab */
//   useEffect(() => {
//     setSubTab("active");
//   }, [tab]);

//   /* ── Derived lists ── */
//   const activeDemands = demands?.filter((d) => d.status === "OPEN") ?? [];
//   const expiredDemands = demands?.filter((d) => d.status !== "OPEN") ?? [];
//   const visibleDemands = subTab === "active" ? activeDemands : expiredDemands;

//   const loading = tab === "sell" ? demands === null : slots === null;

//   /* ───────── Render ───────── */

//   return (
//     <main className="min-h-dvh bg-[#f6f6f8] px-4 pt-6 dark:bg-black">
//       {/* Header */}
//       <header className="mb-4 flex items-center gap-3">
//         <button
//           onClick={() => router.back()}
//           className="flex h-9 w-9 items-center px-1 justify-center rounded-xl bg-neutral-100 active:scale-95 dark:bg-neutral-900"
//         >
//           <ArrowLeft className="h-4 w-4 text-neutral-700 dark:text-neutral-300" />
//         </button>
//         <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
//           Marketplace
//         </h1>
//       </header>

//       {/* ── Main tabs: Sell / Buy ── */}
//       <div className="mb-4 flex gap-2">
//         <button
//           onClick={() => router.push("/explore/sell")}
//           className={cn(
//             "flex-1 rounded-xl py-1 px-2 text-sm font-semibold transition-colors",
//             tab === "sell"
//               ? "bg-neutral-900 text-white dark:bg-neutral-50 dark:text-black"
//               : "bg-neutral-100 text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400",
//           )}
//         >
//           Sell
//         </button>
//         <button
//           onClick={() => router.push("/explore/buy")}
//           className={cn(
//             "flex-1 rounded-xl py-1 px-2 text-sm font-semibold transition-colors",
//             tab === "buy"
//               ? "bg-neutral-900 text-white dark:bg-neutral-50 dark:text-black"
//               : "bg-neutral-100 text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400",
//           )}
//         >
//           Buy
//         </button>
//         <button
//           onClick={() => router.push("/explore/sell")}
//           className={cn(
//             "flex-1 rounded-xl py-1 px-2 text-sm font-semibold transition-colors",
//             tab === "sell"
//               ? "bg-neutral-900 text-white dark:bg-neutral-50 dark:text-black"
//               : "bg-neutral-100 text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400",
//           )}
//         >
//         Local       
//          </button>
//         <button
//           onClick={() => router.push("/explore/sell")}
//           className={cn(
//             "flex-1 rounded-xl py-1 px-2 text-sm font-semibold transition-colors",
//             tab === "sell"
//               ? "bg-neutral-900 text-white dark:bg-neutral-50 dark:text-black"
//               : "bg-neutral-100 text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400",
//           )}
//         >
//           Global
//         </button>
//         <button
//           onClick={() => router.push("/explore/sell")}
//           className={cn(
//             "flex-1 rounded-xl py-1 px-2 text-sm font-semibold transition-colors",
//             tab === "sell"
//               ? "bg-neutral-900 text-white dark:bg-neutral-50 dark:text-black"
//               : "bg-neutral-100 text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400",
//           )}
//         >
//           Categories
//         </button>
//       </div>

//       {/* ── SELL TAB ── */}
//       {tab === "sell" && (
//         <>
//           {/* Sub-tabs: Active / Expired */}
//           <div className="mb-4 flex gap-2">
//             <button
//               onClick={() => setSubTab("active")}
//               className={cn(
//                 "flex-1 rounded-xl py-2 text-xs font-semibold",
//                 subTab === "active"
//                   ? "bg-neutral-200 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
//                   : "text-neutral-400",
//               )}
//             >
//               Active ({activeDemands.length})
//             </button>
//             <button
//               onClick={() => setSubTab("expired")}
//               className={cn(
//                 "flex-1 rounded-xl py-2 text-xs font-semibold",
//                 subTab === "expired"
//                   ? "bg-neutral-200 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
//                   : "text-neutral-400",
//               )}
//             >
//               Expired ({expiredDemands.length})
//             </button>
//           </div>

//           {loading && (
//             <div className="flex justify-center py-10 text-neutral-400">
//               <Loader2 className="h-6 w-6 animate-spin" />
//             </div>
//           )}

//           {!loading && visibleDemands.length === 0 && (
//             <p className="card-shell p-6 text-center text-sm text-neutral-500">
//               {subTab === "active"
//                 ? "No active demands. Post one from the + tab."
//                 : "Nothing here yet."}
//             </p>
//           )}

//           <div className="space-y-3">
//             {visibleDemands.map((d) => {
//               const budgetLabel = formatBudgetRange(d.budgetMin, d.budgetMax);
//               const card = (
//                 <div
//                   className={cn(
//                     "card-shell p-4",
//                     d.status !== "OPEN" && "card-expired",
//                   )}
//                 >
//                   <div className="mb-2 flex items-center justify-between gap-2">
//                     {d.isPriority ? <PriorityBadge /> : <span />}
//                     {d.status === "OPEN" ? (
//                       <CountdownBadge timelineEnd={d.timelineEnd} />
//                     ) : (
//                       <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-400">
//                         {d.status === "EXPIRED"
//                           ? "Expired"
//                           : d.status === "FILLED"
//                             ? "Filled"
//                             : "Cancelled"}
//                       </span>
//                     )}
//                   </div>
//                   <p className="mb-2 line-clamp-2 text-sm font-medium text-neutral-900">
//                     {d.summary}
//                   </p>
//                   <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
//                     {budgetLabel && (
//                       <span className="font-semibold text-neutral-700">
//                         {budgetLabel}
//                       </span>
//                     )}
//                     <span>{d._count.bids}/3 slots filled</span>
//                   </div>
//                 </div>
//               );

//               return d.status === "OPEN" ? (
//                 <Link key={d.id} href={`/demands/${d.id}`}>
//                   {card}
//                 </Link>
//               ) : (
//                 <div key={d.id}>{card}</div>
//               );
//             })}
//           </div>
//         </>
//       )}

//       {/* ── BUY TAB ── */}
//       {tab === "buy" && (
//         <>
//           {loading && (
//             <div className="flex justify-center py-10 text-neutral-400">
//               <Loader2 className="h-6 w-6 animate-spin" />
//             </div>
//           )}

//           {!loading && slots!.length === 0 && (
//             <p className="card-shell p-6 text-center text-sm text-neutral-500">
//               You haven&apos;t grabbed any slots yet. Browse the feed to find
//               demands to bid on.
//             </p>
//           )}

//           <div className="space-y-3">
//             {slots?.map((s) => (
//               <Link
//                 key={s.id}
//                 href={`/demands/${s.demand.id}`}
//                 className="card-shell block p-4"
//               >
//                 <div className="mb-1.5 flex items-center justify-between">
//                   <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
//                     Slot {s.slot}
//                   </span>
//                   <span className="text-xs text-neutral-400">
//                     {new Date(s.createdAt).toLocaleDateString("en-IN", {
//                       day: "numeric",
//                       month: "short",
//                     })}
//                   </span>
//                 </div>
//                 <p className="mb-2 line-clamp-2 text-sm font-medium text-neutral-900">
//                   {s.demand.summary}
//                 </p>
//                 <div className="flex items-center justify-between text-xs text-neutral-500">
//                   <span>
//                     by {s.demand.author.companyName ?? s.demand.author.name}
//                   </span>
//                   {s.payment && (
//                     <span className="flex items-center gap-1 font-semibold text-neutral-700">
//                       <Receipt className="h-3.5 w-3.5" />{" "}
//                       {formatPaise(s.payment.amountPaise)}
//                     </span>
//                   )}
//                 </div>
//               </Link>
//             ))}
//           </div>
//         </>
//       )}
//     </main>
//   );
// }

// "use client";

// import { useEffect, useState } from "react";
// import Link from "next/link";
// import { useParams, useRouter } from "next/navigation";
// import {
//   ArrowLeft,
//   Loader2,
//   Receipt,
//   Clock,
//   Flame,
//   CheckCircle2,
//   XCircle,
//   AlertCircle,
//   Tag,
//   User,
//   Globe,
//   MapPin,
//   LayoutGrid,
//   Package,
//   ShoppingBag,
//   Sparkles,
// } from "lucide-react";
// import { formatPaise, formatBudgetRange } from "@/lib/money";
// import { CountdownBadge } from "@/components/countdown-badge";
// import { PriorityBadge } from "@/components/priority-badge";
// import { cn } from "@/lib/utils";

// /* ───────── Types ───────── */

// interface MySlot {
//   id: string;
//   slot: number;
//   createdAt: string;
//   demand: {
//     id: string;
//     summary: string;
//     status: string;
//     timelineEnd: string;
//     author: {
//       id: string;
//       name: string;
//       companyName: string | null;
//       avatarUrl: string | null;
//     };
//   };
//   payment: {
//     id: string;
//     amountPaise: number;
//     currency: string;
//     razorpayPaymentId: string | null;
//     createdAt: string;
//   } | null;
// }

// interface MyDemand {
//   id: string;
//   summary: string;
//   budgetMin: number | null;
//   budgetMax: number | null;
//   timelineEnd: string;
//   status: "OPEN" | "FILLED" | "EXPIRED" | "CANCELLED";
//   isPriority: boolean;
//   createdAt: string;
//   _count: { bids: number };
// }

// type Tab = "sell" | "buy" | "local" | "global" | "categories";
// type SubTab = "active" | "expired";

// /* ───────── Helpers ───────── */

// function timeAgo(dateStr: string): string {
//   const diff = Date.now() - new Date(dateStr).getTime();
//   const mins = Math.floor(diff / 60000);
//   if (mins < 1) return "Just now";
//   if (mins < 60) return `${mins}m ago`;
//   const hrs = Math.floor(mins / 60);
//   if (hrs < 24) return `${hrs}h ago`;
//   const days = Math.floor(hrs / 24);
//   if (days < 7) return `${days}d ago`;
//   return new Date(dateStr).toLocaleDateString("en-IN", {
//     day: "numeric",
//     month: "short",
//   });
// }

// function slotProgress(filled: number, total: number = 3) {
//   const pct = Math.round((filled / total) * 100);
//   return { pct, filled, total };
// }

// const STATUS_CONFIG: Record<
//   string,
//   { label: string; color: string; bg: string; icon: React.ReactNode }
// > = {
//   OPEN: {
//     label: "Open",
//     color: "text-emerald-600 dark:text-emerald-400",
//     bg: "bg-emerald-50 dark:bg-emerald-950/60",
//     icon: <Sparkles className="h-3 w-3" />,
//   },
//   FILLED: {
//     label: "Filled",
//     color: "text-blue-600 dark:text-blue-400",
//     bg: "bg-blue-50 dark:bg-blue-950/60",
//     icon: <CheckCircle2 className="h-3 w-3" />,
//   },
//   EXPIRED: {
//     label: "Closed",
//     color: "text-neutral-500 dark:text-neutral-400",
//     bg: "bg-neutral-100 dark:bg-neutral-800",
//     icon: <Clock className="h-3 w-3" />,
//   },
//   CANCELLED: {
//     label: "Cancelled",
//     color: "text-red-500 dark:text-red-400",
//     bg: "bg-red-50 dark:bg-red-950/60",
//     icon: <XCircle className="h-3 w-3" />,
//   },
// };

// /* ───────── Page ───────── */

// export default function MarketplacePage() {
//   const params = useParams();
//   const router = useRouter();

//   const tab: Tab =
//     ["sell", "buy", "local", "global", "categories"].includes(
//       params.tab as string,
//     )
//       ? (params.tab as Tab)
//       : "sell";
//   const [subTab, setSubTab] = useState<SubTab>("active");

//   const [demands, setDemands] = useState<MyDemand[] | null>(null);
//   const [slots, setSlots] = useState<MySlot[] | null>(null);

//   useEffect(() => {
//     fetch("/api/my/demands")
//       .then((r) => (r.ok ? r.json() : { demands: [] }))
//       .then((j) => setDemands(j.demands))
//       .catch(() => setDemands([]));
//   }, []);

//   useEffect(() => {
//     fetch("/api/my/slots")
//       .then((r) => (r.ok ? r.json() : { slots: [] }))
//       .then((j) => setSlots(j.slots))
//       .catch(() => setSlots([]));
//   }, []);

//   useEffect(() => {
//     setSubTab("active");
//   }, [tab]);

//   const activeDemands = demands?.filter((d) => d.status === "OPEN") ?? [];
//   const expiredDemands = demands?.filter((d) => d.status !== "OPEN") ?? [];
//   const visibleDemands = subTab === "active" ? activeDemands : expiredDemands;

//   const loading = tab === "sell" ? demands === null : slots === null;

//   const TAB_CONFIG = [
//     { key: "sell" as Tab, label: "Offers", icon: Package },
//     { key: "buy" as Tab, label: "Requests", icon: ShoppingBag },
//     { key: "local" as Tab, label: "Near me", icon: MapPin },
//     { key: "global" as Tab, label: "Anywhere", icon: Globe },
//     { key: "categories" as Tab, label: "All", icon: LayoutGrid },
//   ];

//   return (
//     <main className="min-h-dvh bg-[#f6f6f8] px-4 pt-6 pb-8 dark:bg-black">
//       {/* ── Header ── */}
//       <header className="mb-5 flex items-center gap-3">
//         <button
//           onClick={() => router.back()}
//           className="flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-sm active:scale-95 dark:bg-neutral-900 dark:shadow-none"
//         >
//           <ArrowLeft className="h-4 w-4 text-neutral-700 dark:text-neutral-300" />
//         </button>
//         <div className="flex-1">
//           <h1 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
//             Marketplace
//           </h1>
//           <p className="text-[11px] text-neutral-400">
//             {tab === "sell"
//               ? "Requests and offers you’ve posted"
//               : tab === "buy"
//                 ? "Requests you’ve responded to"
//                 : tab === "local"
//                   ? "Requests near you"
//                   : tab === "global"
//                     ? "Requests anywhere"
//                     : "Browse all categories"}
//           </p>
//         </div>
//       </header>

//       {/* ── Tab bar ── */}
//       <div className="mb-5 flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
//         {TAB_CONFIG.map(({ key, label, icon: Icon }) => (
//           <button
//             key={key}
//             onClick={() => router.push(`/explore/${key}`)}
//             className={cn(
//               "flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-[13px] font-semibold transition-all active:scale-95",
//               tab === key
//                 ? "bg-neutral-900 text-white shadow-sm dark:bg-neutral-50 dark:text-black"
//                 : "bg-white text-neutral-500 shadow-sm dark:bg-neutral-900 dark:text-neutral-400",
//             )}
//           >
//             <Icon className="h-3.5 w-3.5" />
//             {label}
//           </button>
//         ))}
//       </div>

//       {/* ── SELL TAB ── */}
//       {tab === "sell" && (
//         <>
//           {/* Sub-tabs */}
//           <div className="mb-4 flex gap-2">
//             <button
//               onClick={() => setSubTab("active")}
//               className={cn(
//                 "flex-1 rounded-xl py-2 text-xs font-semibold transition-colors",
//                 subTab === "active"
//                   ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
//                   : "bg-white text-neutral-400 dark:bg-neutral-900",
//               )}
//             >
//               Active · {activeDemands.length}
//             </button>
//             <button
//               onClick={() => setSubTab("expired")}
//               className={cn(
//                 "flex-1 rounded-xl py-2 text-xs font-semibold transition-colors",
//                 subTab === "expired"
//                   ? "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
//                   : "bg-white text-neutral-400 dark:bg-neutral-900",
//               )}
//             >
//               Expired · {expiredDemands.length}
//             </button>
//           </div>

//           {loading && (
//             <div className="flex flex-col items-center gap-2 py-16 text-neutral-400">
//               <Loader2 className="h-6 w-6 animate-spin" />
//               <span className="text-xs">Loading requests…</span>
//             </div>
//           )}

//           {!loading && visibleDemands.length === 0 && (
//             <EmptyState
//               icon={Package}
//               title={
//                 subTab === "active"
//                   ? "No open posts"
//                   : "No closed posts"
//               }
//               subtitle={
//                 subTab === "active"
//                   ? "Post a demand from the + tab to start selling."
//                   : "Your expired demands will show up here."
//               }
//             />
//           )}

//           <div className="!space-y-3 !mt-5">
//             {visibleDemands.map((d) => {
//               const budgetLabel = formatBudgetRange(d.budgetMin, d.budgetMax);
//               const { pct: slotPct } = slotProgress(d._count.bids);
//               const statusCfg = STATUS_CONFIG[d.status] ?? STATUS_CONFIG.OPEN;
//               const isExpired = d.status !== "OPEN";

//               const card = (
//                 <div
//                   className={cn(
//                     "group relative overflow-hidden rounded-2xl bg-white p-0 mb-2 shadow-sm transition-all dark:bg-neutral-900 dark:shadow-none",
//                     !isExpired && "active:scale-[0.98]",
//                     isExpired && "opacity-70",
//                   )}
//                 >
//                   {/* Top accent bar */}
//                   <div
//                     className={cn(
//                       "h-1 w-full",
//                       d.isPriority
//                         ? "bg-gradient-to-r from-amber-400 via-orange-500 to-red-500"
//                         : d.status === "OPEN"
//                           ? "bg-gradient-to-r from-emerald-400 to-teal-500"
//                           : "bg-neutral-200 dark:bg-neutral-800",
//                     )}
//                   />

//                   <div className="p-4">
//                     {/* Row 1: Status + Priority + Time */}
//                     <div className="mb-3 flex items-center justify-between">
//                       <div className="flex items-center gap-2">
//                         {/* Status pill */}
//                         <span
//                           className={cn(
//                             "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold",
//                             statusCfg.bg,
//                             statusCfg.color,
//                           )}
//                         >
//                           {statusCfg.icon}
//                           {statusCfg.label}
//                         </span>
//                         {d.isPriority && (
//                           <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
//                             <Flame className="h-3 w-3" />
//                             Priority
//                           </span>
//                         )}
//                       </div>
//                       <span className="text-[11px] text-neutral-400">
//                         {timeAgo(d.createdAt)}
//                       </span>
//                     </div>

//                     {/* Row 2: Summary */}
//                     <p className="mb-3 line-clamp-2 text-sm font-semibold leading-snug text-neutral-900 dark:text-neutral-100">
//                       {d.summary}
//                     </p>

//                     {/* Row 3: Budget */}
//                     {budgetLabel && (
//                       <div className="mb-3 flex items-center gap-1.5">
//                         <Tag className="h-3.5 w-3.5 text-neutral-400" />
//                         <span className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
//                           {budgetLabel}
//                         </span>
//                       </div>
//                     )}

//                     {/* Row 4: Slot progress bar */}
//                     <div className="space-y-1.5">
//                       <div className="flex items-center justify-between text-[11px]">
//                         <span className="font-medium text-neutral-500">
//                           Slots filled
//                         </span>
//                         <span className="font-semibold text-neutral-700 dark:text-neutral-300">
//                           {d._count.bids}/3
//                         </span>
//                       </div>
//                       <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
//                         <div
//                           className={cn(
//                             "h-full rounded-full transition-all",
//                             slotPct >= 100
//                               ? "bg-blue-500"
//                               : slotPct >= 66
//                                 ? "bg-emerald-500"
//                                 : slotPct >= 33
//                                   ? "bg-amber-500"
//                                   : "bg-neutral-300 dark:bg-neutral-600",
//                           )}
//                           style={{ width: `${slotPct}%` }}
//                         />
//                       </div>
//                     </div>

//                     {/* Row 5: Countdown — only for open demands */}
//                     {d.status === "OPEN" && (
//                       <div className="mt-3 flex items-center justify-end">
//                         <CountdownBadge timelineEnd={d.timelineEnd} />
//                       </div>
//                     )}
//                   </div>
//                 </div>
//               );

//               return isExpired ? (
//                 <div key={d.id}>{card}</div>
//               ) : (
//                 <Link key={d.id} href={`/demands/${d.id}`}>
//                   {card}
//                 </Link>
//               );
//             })}
//           </div>
//         </>
//       )}

//       {/* ── BUY TAB ── */}
//       {tab === "buy" && (
//         <>
//           {loading && (
//             <div className="flex flex-col items-center gap-2 py-16 text-neutral-400">
//               <Loader2 className="h-6 w-6 animate-spin" />
//               <span className="text-xs">Loading responses…</span>
//             </div>
//           )}

//           {!loading && slots!.length === 0 && (
//             <EmptyState
//               icon={ShoppingBag}
//               title="No responses yet"
//               subtitle="Browse the feed to find demands and grab a slot."
//             />
//           )}

//           <div className="space-y-3">
//             {slots?.map((s, idx) => (
//               <Link
//                 key={s.id}
//                 href={`/demands/${s.demand.id}`}
//                 className="group block active:scale-[0.98]"
//               >
//                 <div className="relative overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-neutral-900 dark:shadow-none">
//                   {/* Slot number accent */}
//                   <div className="flex">
//                     {/* Left rail — slot number */}
//                     <div className="flex w-14 shrink-0 flex-col items-center justify-center bg-gradient-to-b from-neutral-50 to-neutral-100 py-4 dark:from-neutral-800 dark:to-neutral-850">
//                       <span className="text-lg font-bold text-neutral-400 dark:text-neutral-500">
//                         {s.slot}
//                       </span>
//                       <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-600">
//                         Slot
//                       </span>
//                     </div>

//                     {/* Main content */}
//                     <div className="flex-1 p-4">
//                       {/* Row 1: Author + Time */}
//                       <div className="mb-2.5 flex items-center justify-between">
//                         <div className="flex items-center gap-2">
//                           {s.demand.author.avatarUrl ? (
//                             <img
//                               src={s.demand.author.avatarUrl}
//                               alt=""
//                               className="h-5 w-5 rounded-full object-cover"
//                             />
//                           ) : (
//                             <span className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-200 dark:bg-neutral-700">
//                               <User className="h-3 w-3 text-neutral-500" />
//                             </span>
//                           )}
//                           <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
//                             {s.demand.author.companyName ??
//                               s.demand.author.name}
//                           </span>
//                         </div>
//                         <span className="text-[11px] text-neutral-400">
//                           {timeAgo(s.createdAt)}
//                         </span>
//                       </div>

//                       {/* Row 2: Summary */}
//                       <p className="mb-3 line-clamp-2 text-sm font-semibold leading-snug text-neutral-900 dark:text-neutral-100">
//                         {s.demand.summary}
//                       </p>

//                       {/* Row 3: Payment badge */}
//                       {s.payment ? (
//                         <div className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 dark:bg-emerald-950/40">
//                           <Receipt className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
//                           <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
//                             {formatPaise(s.payment.amountPaise)}
//                           </span>
//                           <span className="text-[10px] text-emerald-500 dark:text-emerald-500">
//                             paid
//                           </span>
//                         </div>
//                       ) : (
//                         <div className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 dark:bg-amber-950/40">
//                           <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
//                           <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
//                             Payment pending
//                           </span>
//                         </div>
//                       )}
//                     </div>
//                   </div>
//                 </div>
//               </Link>
//             ))}
//           </div>
//         </>
//       )}

//       {/* ── LOCAL / GLOBAL / CATEGORIES — placeholder ── */}
//       {["local", "global", "categories"].includes(tab) && (
//         <EmptyState
//           icon={tab === "local" ? MapPin : tab === "global" ? Globe : LayoutGrid}
//           title={
//             tab === "local"
//               ? "Local demands"
//               : tab === "global"
//                 ? "Global demands"
//                 : "All categories"
//           }
//           subtitle="Coming soon — this section is under development."
//         />
//       )}
//     </main>
//   );
// }

// /* ───────── Empty State ───────── */

// function EmptyState({
//   icon: Icon,
//   title,
//   subtitle,
// }: {
//   icon: React.ComponentType<{ className?: string }>;
//   title: string;
//   subtitle: string;
// }) {
//   return (
//     <div className="flex flex-col items-center py-16 text-center">
//       <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-800">
//         <Icon className="h-7 w-7 text-neutral-400" />
//       </div>
//       <p className="mb-1 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
//         {title}
//       </p>
//       <p className="max-w-[240px] text-xs leading-relaxed text-neutral-400">
//         {subtitle}
//       </p>
//     </div>
//   );
// }

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Flame,
  Globe,
  LayoutGrid,
  List,
  Loader2,
  MapPin,
  Package,
  Search,
  ShoppingBag,
  User,
} from "lucide-react";
import { formatPaise, formatBudgetRange } from "@/lib/money";
import { cn } from "@/lib/utils";
import { CATEGORIES_DATA } from "@/lib/categories";

/* ───────── Types ───────── */

interface MySlot {
  id: string;
  slot: number;
  createdAt: string;
  demand: {
    id: string;
    summary: string;
    status: string;
    timelineEnd: string;
    author: {
      id: string;
      name: string;
      companyName: string | null;
      avatarUrl: string | null;
    };
  };
  payment: {
    id: string;
    amountPaise: number;
    currency: string;
    razorpayPaymentId: string | null;
    createdAt: string;
  } | null;
}

interface MyDemand {
  id: string;
  summary: string;
  budgetMin: number | null;
  budgetMax: number | null;
  timelineEnd: string;
  status: "OPEN" | "FILLED" | "EXPIRED" | "CANCELLED";
  isPriority: boolean;
  maxSlots?: number;
  createdAt: string;
  _count: { bids: number };
}

type Tab = "sell" | "buy" | "local" | "global" | "categories";
type SubTab = "active" | "expired";
type ViewMode = "list" | "cards";

const VIEW_KEY = "explore-view-mode";

/* ───────── Helpers ───────── */

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function timeLeft(dateStr: string): string {
  const ms = new Date(dateStr).getTime() - Date.now();
  if (ms <= 0) return "Ended";
  const mins = Math.floor(ms / 60000);
  const days = Math.floor(mins / 1440);
  const hrs = Math.floor((mins % 1440) / 60);
  if (days > 0) return `${days}d ${hrs}h left`;
  if (hrs > 0) return `${hrs}h ${mins % 60}m left`;
  return `${mins}m left`;
}

const STATUS_LABEL: Record<MyDemand["status"], string> = {
  OPEN: "Open",
  FILLED: "Filled",
  EXPIRED: "Closed",
  CANCELLED: "Cancelled",
};

/** The one colour on the page: a green dot for live posts, grey otherwise. */
function StatusDot({ status }: { status: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-neutral-600 dark:text-neutral-300">
      <span className={cn("h-1.5 w-1.5 rounded-full", status === "OPEN" ? "bg-emerald-500" : "bg-neutral-400")} />
      {STATUS_LABEL[status as MyDemand["status"]] ?? status}
    </span>
  );
}

function SlotMeter({ filled, total }: { filled: number; total: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-neutral-500">
      <span className="flex gap-0.5" aria-hidden>
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 w-3 rounded-full",
              i < filled ? "bg-neutral-800 dark:bg-neutral-200" : "bg-neutral-200 dark:bg-neutral-700",
            )}
          />
        ))}
      </span>
      {filled}/{total} spots
    </span>
  );
}

function useViewMode(): [ViewMode, (m: ViewMode) => void] {
  const [mode, setMode] = useState<ViewMode>("list");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_KEY);
      if (saved === "list" || saved === "cards") setMode(saved);
    } catch {
      /* storage unavailable */
    }
  }, []);
  const update = (m: ViewMode) => {
    setMode(m);
    try {
      localStorage.setItem(VIEW_KEY, m);
    } catch {
      /* storage unavailable */
    }
  };
  return [mode, update];
}

function ViewToggle({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  return (
    <div
      role="radiogroup"
      aria-label="View"
      className="flex shrink-0 rounded-lg border border-neutral-200 bg-white p-0.5 dark:border-neutral-800 dark:bg-neutral-900"
    >
      {(
        [
          ["list", List, "List view"],
          ["cards", LayoutGrid, "Card view"],
        ] as const
      ).map(([key, Icon, label]) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={mode === key}
          aria-label={label}
          onClick={() => onChange(key)}
          className={cn(
            "grid h-8 w-8 place-items-center rounded-md transition-colors",
            mode === key
              ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
              : "text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200",
          )}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}

const SURFACE = "rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900";
const LIST = cn(SURFACE, "divide-y divide-neutral-100 overflow-hidden dark:divide-neutral-800");
const ROW_LINK = "block transition-colors active:bg-neutral-50 dark:active:bg-neutral-800/60";

/* ───────── Page ───────── */

export default function MarketplacePage() {
  const params = useParams();
  const router = useRouter();

  const tab: Tab = ["sell", "buy", "local", "global", "categories"].includes(params.tab as string)
    ? (params.tab as Tab)
    : "sell";
  const [subTab, setSubTab] = useState<SubTab>("active");
  const [view, setView] = useViewMode();

  const [demands, setDemands] = useState<MyDemand[] | null>(null);
  const [slots, setSlots] = useState<MySlot[] | null>(null);

  useEffect(() => {
    fetch("/api/my/demands")
      .then((r) => (r.ok ? r.json() : { demands: [] }))
      .then((j) => setDemands(j.demands))
      .catch(() => setDemands([]));
  }, []);

  useEffect(() => {
    fetch("/api/my/slots")
      .then((r) => (r.ok ? r.json() : { slots: [] }))
      .then((j) => setSlots(j.slots))
      .catch(() => setSlots([]));
  }, []);

  useEffect(() => {
    setSubTab("active");
  }, [tab]);

  const activeDemands = demands?.filter((d) => d.status === "OPEN") ?? [];
  const expiredDemands = demands?.filter((d) => d.status !== "OPEN") ?? [];
  const visibleDemands = subTab === "active" ? activeDemands : expiredDemands;

  const loading = tab === "sell" ? demands === null : slots === null;

  const TAB_CONFIG = [
    { key: "sell" as Tab, label: "My posts", icon: Package },
    { key: "buy" as Tab, label: "My responses", icon: ShoppingBag },
    { key: "local" as Tab, label: "Near me", icon: MapPin },
    { key: "global" as Tab, label: "Anywhere", icon: Globe },
    { key: "categories" as Tab, label: "All", icon: LayoutGrid },
  ];

  const showViewToggle = tab === "sell" || tab === "buy";

  return (
    <main className="min-h-dvh bg-neutral-50 pb-8 dark:bg-black">
      {/* ── Header ── */}
      <div className="px-4 pt-[max(env(safe-area-inset-top),1.5rem)]">
        <header className="mb-5 flex items-center gap-3">
          <button
            onClick={() => (window.history.length > 1 ? router.back() : router.push("/explore"))}
            aria-label="Back"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-200 bg-white active:scale-95 dark:border-neutral-800 dark:bg-neutral-900"
          >
            <ArrowLeft className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
              {tab === "buy" ? "My responses" : tab === "sell" ? "My posts" : "Explore"}
            </h1>
            <p className="text-[12px] text-neutral-500">
              {tab === "sell"
                ? "Requests and offers you’ve posted"
                : tab === "buy"
                  ? "Requests you’ve responded to"
                  : tab === "local"
                    ? "Requests near you"
                    : tab === "global"
                      ? "Requests anywhere"
                      : "Browse all categories"}
            </p>
          </div>
          {showViewToggle && <ViewToggle mode={view} onChange={setView} />}
        </header>
      </div>

      {/* ── Tab bar ── */}
      <div className="mb-1 px-4">
        <div className="scrollbar-none flex gap-1.5 overflow-x-auto pb-3">
          {TAB_CONFIG.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => router.replace(`/explore/${key}`)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors",
                tab === key
                  ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                  : "border border-neutral-200 bg-white text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── SELL TAB ── */}
      {tab === "sell" && (
        <div className="px-4">
          {/* Sub-tabs: segmented control */}
          <div className="mb-4 flex rounded-xl bg-neutral-200/60 p-1 dark:bg-neutral-900">
            {(
              [
                ["active", `Active · ${activeDemands.length}`],
                ["expired", `Closed · ${expiredDemands.length}`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSubTab(key)}
                className={cn(
                  "flex-1 rounded-lg py-2 text-[13px] font-medium transition-colors",
                  subTab === key
                    ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-white"
                    : "text-neutral-500",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {loading && <Loading label="Loading your posts…" />}

          {!loading && visibleDemands.length === 0 && (
            <EmptyState
              icon={Package}
              title={subTab === "active" ? "No open posts" : "No closed posts"}
              subtitle={
                subTab === "active"
                  ? "Post a request or offer from the + tab to start getting responses."
                  : "Your closed posts will appear here."
              }
            />
          )}

          {!loading && visibleDemands.length > 0 && view === "list" && (
            <ul className={LIST}>
              {visibleDemands.map((d) => (
                <li key={d.id}>
                  <DemandLink demand={d}>
                    <DemandRow demand={d} />
                  </DemandLink>
                </li>
              ))}
            </ul>
          )}

          {!loading && visibleDemands.length > 0 && view === "cards" && (
            <div className="grid grid-cols-2 gap-3">
              {visibleDemands.map((d) => (
                <DemandLink key={d.id} demand={d} className="h-full rounded-2xl">
                  <DemandTile demand={d} />
                </DemandLink>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── BUY TAB ── */}
      {tab === "buy" && (
        <div className="px-4">
          {loading && <Loading label="Loading responses…" />}

          {!loading && slots!.length === 0 && (
            <EmptyState
              icon={ShoppingBag}
              title="No responses yet"
              subtitle="Browse the feed to find a request and respond to it."
            />
          )}

          {!loading && slots!.length > 0 && view === "list" && (
            <ul className={LIST}>
              {slots!.map((s) => (
                <li key={s.id}>
                  <Link href={`/demands/${s.demand.id}`} className={ROW_LINK}>
                    <SlotRow slot={s} />
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {!loading && slots!.length > 0 && view === "cards" && (
            <div className="grid grid-cols-2 gap-3">
              {slots!.map((s) => (
                <Link key={s.id} href={`/demands/${s.demand.id}`} className="block h-full active:scale-[0.98]">
                  <SlotTile slot={s} />
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── LOCAL / GLOBAL ── */}
      {["local", "global"].includes(tab) && (
        <div className="px-4">
          <EmptyState
            icon={tab === "local" ? MapPin : Globe}
            title={tab === "local" ? "Requests near me" : "Requests anywhere"}
            subtitle="Coming soon — this section is under development."
          />
        </div>
      )}

      {/* ── CATEGORIES: Main Category -> /niche/[id] (sub -> provider -> problem) ── */}
      {tab === "categories" && (
        <div className="space-y-3 px-4">
          <Link
            href="/categories"
            className={cn(SURFACE, "flex items-center gap-2 px-4 py-3 text-sm text-neutral-500 active:scale-[0.99]")}
          >
            <Search className="h-4 w-4" />
            Search services, tags or categories
          </Link>
          <div className="grid grid-cols-2 gap-2.5">
            {CATEGORIES_DATA.map((cat) => (
              <Link key={cat.id} href={`/niche/${cat.id}`} className={cn(SURFACE, "p-3.5 active:scale-[0.98]")}>
                <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">{cat.name}</p>
                <p className="mt-1 text-[12px] text-neutral-500">{cat.subCategories.length} sub categories</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

/* ───────── Offers / requests you posted ───────── */

/** Open posts link to their page; closed ones are shown but not tappable. */
function DemandLink({
  demand,
  className,
  children,
}: {
  demand: MyDemand;
  className?: string;
  children: React.ReactNode;
}) {
  if (demand.status !== "OPEN") return <div className={cn("opacity-60", className)}>{children}</div>;
  return (
    <Link href={`/demands/${demand.id}`} className={cn(ROW_LINK, className)}>
      {children}
    </Link>
  );
}

function DemandRow({ demand: d }: { demand: MyDemand }) {
  const budget = formatBudgetRange(d.budgetMin, d.budgetMax);
  return (
    <div className="px-4 py-3.5">
      <div className="flex items-start gap-3">
        <p className="line-clamp-2 min-w-0 flex-1 text-[14px] font-medium leading-snug text-neutral-900 dark:text-neutral-100">
          {d.isPriority && <Flame className="mr-1 inline h-3.5 w-3.5 -translate-y-px text-neutral-500" aria-label="Featured" />}
          {d.summary}
        </p>
        {budget && <span className="shrink-0 text-[14px] font-semibold text-neutral-900 dark:text-neutral-100">{budget}</span>}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <StatusDot status={d.status} />
        <SlotMeter filled={d._count.bids} total={d.maxSlots ?? 3} />
        <span className="ml-auto text-[12px] text-neutral-400">
          {d.status === "OPEN" ? timeLeft(d.timelineEnd) : timeAgo(d.createdAt)}
        </span>
      </div>
    </div>
  );
}

function DemandTile({ demand: d }: { demand: MyDemand }) {
  const budget = formatBudgetRange(d.budgetMin, d.budgetMax);
  return (
    <div className={cn(SURFACE, "flex h-full flex-col p-3.5")}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <StatusDot status={d.status} />
        {d.isPriority && <Flame className="h-3.5 w-3.5 text-neutral-500" aria-label="Featured" />}
      </div>
      <p className="line-clamp-3 text-[14px] font-medium leading-snug text-neutral-900 dark:text-neutral-100">{d.summary}</p>
      <div className="mt-auto space-y-2 pt-3">
        {budget && <p className="text-[15px] font-semibold text-neutral-900 dark:text-neutral-100">{budget}</p>}
        <SlotMeter filled={d._count.bids} total={d.maxSlots ?? 3} />
        <p className="text-[12px] text-neutral-400">
          {d.status === "OPEN" ? timeLeft(d.timelineEnd) : timeAgo(d.createdAt)}
        </p>
      </div>
    </div>
  );
}

/* ───────── Requests you responded to ───────── */

function AuthorChip({ author }: { author: MySlot["demand"]["author"] }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      {author.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={author.avatarUrl} alt="" className="h-5 w-5 shrink-0 rounded-full object-cover" />
      ) : (
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-neutral-100 dark:bg-neutral-800">
          <User className="h-3 w-3 text-neutral-400" />
        </span>
      )}
      <span className="truncate text-[12px] text-neutral-500">{author.companyName ?? author.name}</span>
    </span>
  );
}

function PaymentNote({ payment }: { payment: MySlot["payment"] }) {
  return payment ? (
    <span className="text-[12px] font-medium text-neutral-700 dark:text-neutral-300">
      {formatPaise(payment.amountPaise)} paid
    </span>
  ) : (
    <span className="text-[12px] font-medium text-neutral-500">Payment pending</span>
  );
}

function SlotRow({ slot: s }: { slot: MySlot }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-neutral-100 text-[13px] font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
        #{s.slot}
      </span>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[14px] font-medium leading-snug text-neutral-900 dark:text-neutral-100">
          {s.demand.summary}
        </p>
        <div className="mt-2 flex items-center gap-3">
          <AuthorChip author={s.demand.author} />
          <span className="ml-auto shrink-0">
            <PaymentNote payment={s.payment} />
          </span>
        </div>
      </div>
    </div>
  );
}

function SlotTile({ slot: s }: { slot: MySlot }) {
  return (
    <div className={cn(SURFACE, "flex h-full flex-col p-3.5")}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[12px] font-medium text-neutral-500">Spot #{s.slot}</span>
        <span className="text-[12px] text-neutral-400">{timeAgo(s.createdAt)}</span>
      </div>
      <p className="line-clamp-3 text-[14px] font-medium leading-snug text-neutral-900 dark:text-neutral-100">
        {s.demand.summary}
      </p>
      <div className="mt-auto space-y-2 pt-3">
        <AuthorChip author={s.demand.author} />
        <PaymentNote payment={s.payment} />
      </div>
    </div>
  );
}

/* ───────── Shared ───────── */

function Loading({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-2.5 py-20">
      <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
      <span className="text-xs text-neutral-400">{label}</span>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex flex-col items-center py-20 text-center">
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <Icon className="h-5 w-5 text-neutral-400" />
      </div>
      <p className="mb-1 text-sm font-semibold text-neutral-800 dark:text-neutral-200">{title}</p>
      <p className="max-w-[260px] text-xs leading-relaxed text-neutral-500">{subtitle}</p>
    </div>
  );
}
