// "use client";

// import Link from "next/link";
// import { useState } from "react";
// import { Smartphone, Lightbulb, CreditCard, LayoutGrid, MapPin, Globe, Search, QrCode } from "lucide-react";
// import { cn } from "@/lib/utils";
// import { AppHeader } from "@/components/app-header";
// import { QrScannerModal } from "@/components/qr-scanner-modal";


// export default function Explore() {

//   return (
//     <main className="flex !max-h-dvh flex-col px-4 pt-6 bg-black dark:bg-black">
//       <ExplorePage />
//     </main>
//   );
// }



// /* ---------- Mock data — swap with your APIs ---------- */

// const QUICK_ACTIONS = [
//   { icon: Smartphone, label: "Sell", href: "/explore/sell" },
//   // { icon: Lightbulb, label: "Buy", href: "/explore/buy" },
//   { icon: MapPin, label: "Local", href: "/?local=true" },
//   { icon: Globe, label: "Global", href: "/" },
//   { icon: LayoutGrid, label: "Categories", href: "/" },
// ];

// const STATS = {
//   rewards: { label: "Join Communities", title: "Groups" },
//   cibil: { label: "Buy Top Demands", score: 580, max: 900 },
//   autopay: { label: "Your Slots", value: "0 Active" },
//   spends: { label: "SEPTEMBER SPENDS", value: "₹0" },
//   invite: { label: "INVITE & EARN", value: "₹500" },
// };

// const NAV_ITEMS = [
//   { icon: "🏦", label: "Banking" },
//   { icon: null, label: "Pay" }, // center raised slot — your logo here
//   { icon: "💳", label: "Credit" },
// ];

// /* ---------- Card primitives ---------- */

// function BentoCard({
//   children,
//   className,
//   href,
// }: {
//   children: React.ReactNode;
//   className?: string;
//   href?: string;
// }) {
//   const cls = cn(
//     "rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-transform active:scale-[0.98] dark:bg-neutral-900 dark:shadow-none dark:ring-1 dark:ring-neutral-800",
//     className,
//   );
//   if (href) {
//     return (
//       <Link href={href} className={cn(cls, "block")}>
//         {children}
//       </Link>
//     );
//   }
//   return <div className={cls}>{children}</div>;
// }

// function CardLabel({ children }: { children: React.ReactNode }) {
//   return (
//     <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">{children}</p>
//   );
// }

// /* ---------- CIBIL-style gauge (SVG semicircle) ---------- */

// function ScoreGauge({ score, max }: { score: number; max: number }) {
//   const pct = Math.min(score / max, 1);
//   const R = 44;
//   const CIRC = Math.PI * R; // half circle

//   return (
//     <svg viewBox="0 0 120 70" className="mt-3 w-full">
//       <defs>
//         <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="0">
//           <stop offset="0%" stopColor="#22c55e" />
//           <stop offset="60%" stopColor="#84cc16" />
//           <stop offset="100%" stopColor="#f59e0b" />
//         </linearGradient>
//       </defs>
//       {/* track */}
//       <path
//         d="M 10 62 A 50 50 0 0 1 110 62"
//         fill="none"
//         stroke="#f0f0f0"
//         strokeWidth="10"
//         strokeLinecap="round"
//         className="dark:stroke-neutral-800"
//       />
//       {/* value */}
//       <path
//         d="M 10 62 A 50 50 0 0 1 110 62"
//         fill="none"
//         stroke="url(#gaugeGrad)"
//         strokeWidth="10"
//         strokeLinecap="round"
//         strokeDasharray={CIRC * 1.15}
//         strokeDashoffset={CIRC * 1.15 * (1 - pct)}
//       />
//     </svg>
//   );
// }

// /* ---------- Gradient sparkle (Rewards) ---------- */

// function Sparkle() {
//   return (
//     <svg viewBox="0 0 100 100" className="mt-6 h-16 w-16">
//       <defs>
//         <linearGradient id="sparkGrad" x1="0" y1="0" x2="1" y2="1">
//           <stop offset="0%" stopColor="#f472b6" />
//           <stop offset="100%" stopColor="#fb923c" />
//         </linearGradient>
//       </defs>
//       <path
//         d="M50 2 C54 34 66 46 98 50 C66 54 54 66 50 98 C46 66 34 54 2 50 C34 46 46 34 50 2 Z"
//         fill="url(#sparkGrad)"
//       />
//     </svg>
//   );
// }

// /* ---------- Gradient pie (Spends) ---------- */

// function SpendPie() {
//   return (
//     <svg viewBox="0 0 100 100" className="mt-6 h-16 w-16 -rotate-90">
//       <defs>
//         <linearGradient id="pieGrad" x1="0" y1="0" x2="1" y2="1">
//           <stop offset="0%" stopColor="#f472b6" />
//           <stop offset="100%" stopColor="#c084fc" />
//         </linearGradient>
//       </defs>
//       <circle cx="50" cy="50" r="38" fill="none" stroke="#f0f0f0" strokeWidth="20" className="dark:stroke-neutral-800" />
//       <circle
//         cx="50"
//         cy="50"
//         r="38"
//         fill="none"
//         stroke="url(#pieGrad)"
//         strokeWidth="20"
//         strokeDasharray={`${2.3 * Math.PI * 38} ${2 * Math.PI * 38}`}
//         strokeLinecap="round"
//       />
//     </svg>
//   );
// }

// /* ---------- Page ---------- */

// function ExplorePage() {
//   const [scannerOpen, setScannerOpen] = useState(false);
//   return (
//     <main className="h-dvh bg-[#f6f6f8] dark:bg-black">
//       <div className=" px-2.5">


//         {/* Header: title + avatar */}
//         <header className="mb-3 flex items-center justify-between">
//           <SideMenu
//             user={{
//               name: "Kanishk Khandelwal",
//               handle: "kanishkk.ai",
//               avatarUrl: "/icons/avatar-placeholder.svg",
//               followingCount: 0,
//               followerCount: 0,
//               isPro: true,
//             }}
//           />
//         <img src="https://res.cloudinary.com/kanishkkcloud18/image/upload/v1791471956/xivago_logo_2_bpvijy.png" alt="logo" className="h-6 w-auto bg-transparent" />
//           <Link href="/profile" className="relative">
//             {/* eslint-disable-next-line @next/next/no-img-element */}
//             <img
//               src="/icons/avatar-placeholder.svg"
//               alt="Profile"
//               className="h-10 w-10 rounded-full bg-neutral-200 object-cover"
//             />
//             <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#f6f6f8] bg-green-500" />
//           </Link>
//         </header>

//         <div className="mb-4 flex items-center gap-2">
//           <Link
//             href="/search"
//             className="flex flex-1 items-center gap-2 rounded-full bg-white px-4 py-3 text-sm text-neutral-400 shadow-[0_1px_3px_rgba(0,0,0,0.06)] dark:bg-neutral-900 dark:ring-1 dark:ring-neutral-800"
//           >
//             <Search className="h-4 w-4" /> Search people, demands, communities, posts…
//           </Link>
//           <button
//             type="button"
//             onClick={() => setScannerOpen(true)}
//             aria-label="Scan QR code"
//             className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-neutral-600 shadow-[0_1px_3px_rgba(0,0,0,0.06)] dark:bg-neutral-900 dark:text-neutral-300 dark:ring-1 dark:ring-neutral-800"
//           >
//             <QrCode className="h-5 w-5" />
//           </button>
//         </div>

//         <QrScannerModal open={scannerOpen} onClose={() => setScannerOpen(false)} />

//         {/* Recharge & bills — wide quick-actions card */}
//         <BentoCard className="mb-4 !px-4">
//           <div className="mb-5 flex items-center justify-between">
//             <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
//               Categories
//             </h2>
//           </div>
//           <div className="flex justify-between items-center w-full overflow-y-hidden overflow-x-auto !px-0">
//             {QUICK_ACTIONS.map(({ icon: Icon, label, href }) => (
//               <Link key={label} href={href} className="flex flex-col items-center gap-2">
//                 <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-600 transition-colors active:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300">
//                   <Icon className="h-5 w-5" />
//                 </span>
//                 <span className="text-center text-[11px] font-medium leading-tight text-neutral-500 dark:text-neutral-400">
//                   {label}
//                 </span>
//               </Link>
//             ))}
//           </div>
//         </BentoCard>

//         {/* Bento grid */}
//         <div className="grid grid-cols-2 gap-4">
//           {/* Rewards */} 
//           <BentoCard href="/communities" className="flex min-h-[150px] flex-col">
//             <CardLabel>{STATS.rewards.label}</CardLabel>
//             <p className="mt-0.5 text-xl font-bold text-neutral-900 dark:text-neutral-50">
//               {STATS.rewards.title}
//             </p>
//             <div className="flex flex-1 items-end justify-center">
//               <Sparkle />
//             </div>
//           </BentoCard>

//           {/* CIBIL score */}
//           <BentoCard href="/" className="flex min-h-[150px] flex-col">
//             <CardLabel>{STATS.cibil.label}</CardLabel>
//             <p className="mt-0.5 text-xl font-bold text-neutral-900 dark:text-neutral-50">
//               {STATS.cibil.score}
//             </p>
//             <div className="flex flex-1 items-end">
//               <ScoreGauge score={STATS.cibil.score} max={STATS.cibil.max} />
//             </div>
//           </BentoCard>

//           {/* Autopay */}
//           <BentoCard href="/explore/buy" className="min-h-[90px]">
//             <CardLabel>{STATS.autopay.label}</CardLabel>
//             <p className="mt-1 text-xl font-bold text-neutral-900 dark:text-neutral-50">
//               {STATS.autopay.value}
//             </p>
//           </BentoCard>

//           {/* September spends — tall right card, spans 2 rows */}
//           <BentoCard href="/spends" className="row-span-2 flex min-h-[190px] flex-col">
//             <CardLabel>{STATS.spends.label}</CardLabel>
//             <p className="mt-1 text-xl font-bold text-neutral-900 dark:text-neutral-50">
//               {STATS.spends.value}
//             </p>
//             <div className="flex flex-1 items-end justify-center">
//               <SpendPie />
//             </div>
//           </BentoCard>

//           {/* Invite & earn — sits under Autopay, left column */}
//           <BentoCard href="/invite" className="min-h-[90px]">
//             <CardLabel>{STATS.invite.label}</CardLabel>
//             <p className="mt-1 text-xl font-bold text-neutral-900 dark:text-neutral-50">
//               {STATS.invite.value}
//             </p>
//           </BentoCard>
//         </div>
//       </div>


//     </main>
//   );
// }

// "use client";

// import Link from "next/link";
// import { useState } from "react";
// import {
//   Search, Mail, ScanLine, Smartphone, MapPin, Globe, LayoutGrid,
//   Users, Flame, Wallet, Gift, Layers, Tag, Home, Trophy, ArrowUpRight, Plus, ChevronRight,
// } from "lucide-react";
// import { cn } from "@/lib/utils";
// import { AppHeader } from "@/components/app-header";
// import { QrScannerModal } from "@/components/qr-scanner-modal";

// /* ---------- Data — swap with your APIs ---------- */

// const USER = {
//   name: "Kanishk Khandelwal", handle: "kanishkk.ai", avatarUrl: "/icons/avatar-placeholder.svg",
//   followingCount: 0, followerCount: 0, isPro: true,
// };

// const CHIPS = [
//   [
//     { icon: Smartphone, label: "Sell", href: "/explore/sell" },
//     { icon: MapPin, label: "Local", href: "/?local=true" },
//     { icon: Globe, label: "Global", href: "/" },
//   ],
//   [
//     { icon: Flame, label: "Top Demands", href: "/", tag: "Hot" },
//     { icon: LayoutGrid, label: "Categories", href: "/" },
//     { icon: Users, label: "Communities", href: "/communities" },
//   ],
// ];

// const PEOPLE = [
//   { name: "Aarav Mehta", hue: "from-fuchsia-500 to-violet-600" },
//   { name: "Aryan Rohilla", hue: "from-cyan-400 to-teal-600" },
//   { name: "Disha Chawla", hue: "from-violet-400 to-indigo-600" },
//   { name: "Jitendra Arora", hue: "from-amber-400 to-orange-600" },
//   { name: "Syed Ali", hue: "from-rose-400 to-red-600" },
// ];

// const NAV = [
//   { icon: Wallet, label: "Spots", href: "/explore/buy" },
//   { icon: ArrowUpRight, label: "Spending", href: "/spends" },
//   { icon: Home, label: "Home", href: "/explore", active: true },
//   { icon: Trophy, label: "Rewards", href: "/invite" },
//   { icon: Users, label: "Groups", href: "/communities" },
// ];

// /* ---------- Page ---------- */

// export default function Explore() {
//   const [scannerOpen, setScannerOpen] = useState(false);

//   return (
//     <main className="relative min-h-dvh bg-[#09090b] pb-28 text-white antialiased">
//       {/* Hero */}
//       <section className="relative overflow-hidden rounded-b-[28px] px-4 pb-6 pt-4">
//         <div className="absolute inset-0 bg-[radial-gradient(120%_70%_at_50%_0%,#3b1d7a_0%,#1a0f3a_55%,#09090b_100%)]" />
//         <div className="absolute -left-16 top-24 h-48 w-48 rounded-full bg-violet-500/25 blur-3xl" />
//         <div className="absolute -right-16 top-64 h-48 w-48 rounded-full bg-teal-400/15 blur-3xl" />

//         <div className="relative">
//           <header className="flex items-center gap-2.5">
//             <SideMenu user={USER} />
//             <Link
//               href="/profile"
//               className="flex h-10 flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#5a1a10] to-[#3d130c] text-[13px] font-medium text-orange-100 ring-1 ring-inset ring-white/10"
//             >
//               <Mail className="h-3.5 w-3.5 text-orange-300" /> Verify email & start selling
//             </Link>
//             <Link href="/notifications" className="relative grid h-10 w-10 place-items-center rounded-full bg-white/10 ring-1 ring-inset ring-white/10 backdrop-blur">
//               <Bell className="h-4 w-4" />
//               <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-blue-500 px-1 text-[9px] font-semibold">22</span>
//             </Link>
//           </header>

//           <Link href="/search" className="mx-auto mt-4 flex w-fit items-center gap-2 rounded-full bg-white/[0.08] px-5 py-2 text-[13px] text-white/60 ring-1 ring-inset ring-white/10 backdrop-blur">
//             <Search className="h-3.5 w-3.5" /> Search
//           </Link>

//           {/* Scan & Sell */}
//           <button
//             onClick={() => setScannerOpen(true)}
//             className="relative mx-auto mt-5 block aspect-square w-[72%] max-w-[280px] overflow-hidden rounded-[22px] bg-gradient-to-br from-[#123c40] to-[#0a2326] text-left shadow-[0_24px_60px_-12px_rgba(0,0,0,0.7)] ring-1 ring-inset ring-white/15 transition active:scale-[0.98]"
//           >
//             <QrPattern />
//             <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/40" />
//             <p className="relative px-6 pt-6 text-[40px] font-extrabold leading-[0.95] tracking-tight">
//               Scan<br /><span className="text-white/70">&</span> Sell
//             </p>
//             <span className="absolute bottom-4 left-6 flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] text-white/80 backdrop-blur">
//               <ScanLine className="h-3 w-3" /> Tap to scan
//             </span>
//           </button>

//           {/* Spin & win */}
//           <Link href="/invite" className="relative mt-6 flex items-center justify-between overflow-hidden rounded-2xl bg-white/[0.04] p-4 ring-1 ring-inset ring-white/10">
//             <div>
//               <p className="bg-gradient-to-b from-white to-violet-300 bg-clip-text text-[22px] font-black italic tracking-tight text-transparent">
//                 SPIN & WIN
//               </p>
//               <p className="mt-1 text-[12px] text-white/60">Earn up to <span className="font-semibold text-white">₹500</span> rewards</p>
//             </div>
//             <Wheel />
//           </Link>
//         </div>
//       </section>

//       {/* Chips */}
//       <section className="mt-5 space-y-2.5">
//         {CHIPS.map((row, r) => (
//           <div key={r} className="no-scrollbar flex gap-2.5 overflow-x-auto px-4 pt-2">
//             {row.map(({ icon: Icon, label, href, tag }: any) => (
//               <Link key={label} href={href} className="relative flex h-11 shrink-0 items-center gap-2 rounded-full bg-white/[0.03] px-4 text-[13px] text-white/90 ring-1 ring-inset ring-white/[0.08] transition active:bg-white/[0.06]">
//                 {tag && <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-orange-500/90 px-1.5 text-[9px] font-semibold uppercase tracking-wide">{tag}</span>}
//                 <Icon className="h-4 w-4 text-white/60" strokeWidth={1.75} /> {label}
//               </Link>
//             ))}
//           </div>
//         ))}
//       </section>

//       {/* Recommended */}
//       <section className="mt-7">
//         <SectionTitle className="px-4 text-left">Recommended</SectionTitle>
//         <div className="no-scrollbar mt-3 flex gap-4 overflow-x-auto px-4">
//           {PEOPLE.map((p) => (
//             <Link key={p.name} href="/search" className="flex w-14 shrink-0 flex-col items-center">
//               <span className={cn("relative grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br p-[1.5px]", p.hue)}>
//                 <span className="grid h-full w-full place-items-center rounded-full bg-[#141417] text-[15px] font-semibold text-white/90">
//                   {p.name.split(" ").map((w) => w[0]).join("")}
//                 </span>
//               </span>
//               <span className="mt-1.5 w-full truncate text-center text-[11px] text-white/60">{p.name.split(" ")[0]}</span>
//             </Link>
//           ))}
//         </div>
//       </section>

//       {/* Sticky search */}
//       <div className="sticky top-3 z-30 mt-8 px-6">
//         <Link href="/search" className="mx-auto flex max-w-sm items-center gap-2.5 rounded-full bg-neutral-800/60 px-4 py-2.5 text-[13px] text-white/60 ring-1 ring-inset ring-white/10 backdrop-blur-xl">
//           <Search className="h-4 w-4" /> Search demands, people, posts…
//         </Link>
//       </div>

//       {/* Bento */}
//       <section className="mt-8 px-4">
//         <SectionTitle>Spend less, save more</SectionTitle>
//         <div className="mt-4 grid grid-cols-2 gap-2.5">
//           <Tile href="/" title="Top Demands" sub={<>Up to <b className="font-semibold text-white">580</b> buyers live</>} icon={Flame} glow="from-orange-500/30" className="col-span-2 h-28" />
//           <Tile href="/communities" title="Groups" sub="Join communities" icon={Users} glow="from-blue-500/30" className="h-40" />
//           <Tile href="/spends" title="Spends" sub="₹0 this month" icon={Tag} glow="from-rose-500/30" className="h-40" />
//           <Tile href="/invite" title="Invite" sub="Flat ₹500 / referral" icon={Gift} glow="from-amber-400/30" className="row-span-2" />
//           <Tile href="/explore/buy" title="My Slots" icon={Layers} glow="from-yellow-400/30" compact />
//           <Tile href="/explore/sell" title="Sell now" icon={Plus} glow="from-fuchsia-500/30" compact />
//         </div>
//       </section>

//       {/* Upgrades */}
//       <section className="mt-9">
//         <SectionTitle>Xivago upgrades</SectionTitle>
//         <div className="no-scrollbar mt-4 flex snap-x gap-2.5 overflow-x-auto px-4">
//           {[
//             { t: "Trade smarter with live demand", g: "from-[#3a1708] to-[#120a07]" },
//             { t: "See what you spent last month", g: "from-[#2e260c] to-[#100e07]" },
//           ].map((u) => (
//             <Link key={u.t} href="/" className={cn("flex h-28 w-[78%] shrink-0 snap-start flex-col justify-between rounded-2xl bg-gradient-to-br p-4 ring-1 ring-inset ring-white/[0.06]", u.g)}>
//               <ChevronRight className="ml-auto h-4 w-4 text-white/40" />
//               <p className="max-w-[80%] text-[16px] font-semibold leading-snug">{u.t}</p>
//             </Link>
//           ))}
//         </div>
//       </section>

//       {/* Bottom nav */}
//       <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.06] bg-[#0f0f12]/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
//         <div className="flex items-center px-2 pb-2.5 pt-2">
//           {NAV.map(({ icon: Icon, label, href, active }) => (
//             <Link key={label} href={href} className="flex flex-1 flex-col items-center gap-1">
//               <Icon className={cn("h-[20px] w-[20px]", active ? "text-orange-400" : "text-white/40")} strokeWidth={1.6} />
//               <span className={cn("text-[10px]", active ? "text-orange-400" : "text-white/40")}>{label}</span>
//             </Link>
//           ))}
//           <Link href="/explore/sell" className="ml-1 grid h-11 w-14 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-600 text-[15px] font-black italic shadow-[0_0_20px_rgba(168,85,247,0.45)]">
//             sell
//           </Link>
//         </div>
//       </nav>

//       <QrScannerModal open={scannerOpen} onClose={() => setScannerOpen(false)} />
//       <style jsx global>{`.no-scrollbar::-webkit-scrollbar{display:none}.no-scrollbar{scrollbar-width:none}`}</style>
//     </main>
//   );
// }

// /* ---------- Pieces ---------- */

// function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
//   return <h3 className={cn("text-center text-[13px] font-medium tracking-wide text-white/45", className)}>{children}</h3>;
// }

// function Tile({
//   href, title, sub, icon: Icon, glow, className, compact,
// }: {
//   href: string; title: string; sub?: React.ReactNode; icon: React.ElementType;
//   glow: string; className?: string; compact?: boolean;
// }) {
//   return (
//     <Link
//       href={href}
//       className={cn(
//         "group relative flex overflow-hidden rounded-2xl bg-[#111114] p-4 ring-1 ring-inset ring-white/[0.06] transition active:scale-[0.98]",
//         compact ? "h-[75px] items-center" : "flex-col justify-between",
//         className,
//       )}
//     >
//       <div className={cn("absolute -right-8 -top-8 h-28 w-28 rounded-full bg-gradient-to-br to-transparent blur-2xl", glow)} />
//       <p className="relative text-[15px] font-semibold tracking-tight">{title}</p>
//       <span className={cn("absolute grid place-items-center rounded-xl bg-white/[0.06] ring-1 ring-inset ring-white/10", compact ? "right-3 h-9 w-9" : "right-4 top-4 h-10 w-10")}>
//         <Icon className="h-[18px] w-[18px] text-white/80" strokeWidth={1.6} />
//       </span>
//       {sub && <p className="relative text-[12px] text-white/50">{sub}</p>}
//     </Link>
//   );
// }

// function QrPattern() {
//   const cells: [number, number][] = [];
//   for (let y = 0; y < 21; y++) for (let x = 0; x < 21; x++) if ((x * 7 + y * 13 + x * y) % 5 < 2) cells.push([x, y]);
//   return (
//     <svg viewBox="0 0 21 21" className="absolute inset-0 h-full w-full opacity-40" shapeRendering="crispEdges">
//       {cells.map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#2a6a70" />)}
//     </svg>
//   );
// }

// function Wheel() {
//   const fills = ["#5b21b6", "#0f766e", "#5b21b6", "#0f766e", "#5b21b6", "#0f766e"];
//   return (
//     <svg viewBox="0 0 100 100" className="-mr-2 h-16 w-16 rotate-12 drop-shadow-[0_6px_16px_rgba(91,33,182,0.5)]">
//       <circle cx="50" cy="50" r="49" fill="#cbd5e1" />
//       {fills.map((f, i) => {
//         const a = (d: number) => (d * Math.PI) / 180;
//         const [s, e] = [a(i * 60), a(i * 60 + 60)];
//         return <path key={i} d={`M50 50 L${50 + 45 * Math.cos(s)} ${50 + 45 * Math.sin(s)} A45 45 0 0 1 ${50 + 45 * Math.cos(e)} ${50 + 45 * Math.sin(e)}Z`} fill={f} />;
//       })}
//       <circle cx="50" cy="50" r="7" fill="#e2e8f0" />
//     </svg>
//   );
// }

// ===================================================================
// v2 (saved): Fluent 3D colour icons — kept for reference, commented out
// ===================================================================
// "use client";
// 
// import Link from "next/link";
// import { useEffect, useRef, useState } from "react";
// import { useSession } from "next-auth/react";
// import { QRCodeSVG } from "qrcode.react";
// import {
//   Search, Mail, Check, UserRoundCog, Users, MapPin, Globe, LayoutGrid,
//   Gift, Flame, ShoppingBag, Layers, Plus, Wallet, ArrowUpRight, Trophy, Archive, ChevronRight,
// } from "lucide-react";
// import { cn } from "@/lib/utils";
// import { AppHeader } from "@/components/app-header";
// import { InlineQrScanner } from "@/components/inline-qr-scanner";
// import { LiquidMetalButton } from "@/components/ui/shimmer-button";
// 
// /* ---------- Data — swap with your APIs / images ---------- */
// 
// const PEOPLE = ["Aarav Mehta", "Aryan Rohilla", "Disha Chawla", "Jitendra Arora", "Mr Syed Ali"];
// 
// const NAV = [
//   { icon: Wallet, label: "Spots", href: "/explore/buy" },
//   { icon: ArrowUpRight, label: "Spending", href: "/spends" },
//   { icon: null, label: "Home", href: "/explore", active: true },
//   { icon: Trophy, label: "Rewards", href: "/invite" },
//   { icon: Archive, label: "Groups", href: "/communities" },
// ];
// 
// /** 1x1 transparent GIF -- lets qrcode.react clear the centre modules for the avatar overlay. */
// const TRANSPARENT_PIXEL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
// 
// /* ---------- Page (mobile only: locked to phone width) ---------- */
// 
// export default function Explore() {
//   const [scannerOpen, setScannerOpen] = useState(false);
//   const qrTileRef = useRef<HTMLDivElement>(null);
//   const { data: session } = useSession();
//   const [me, setMe] = useState<{ id: string; name: string | null; avatarUrl: string | null } | null>(null);
//   const [isPro, setIsPro] = useState(false);
// 
//   useEffect(() => {
//     if (!session?.user) return;
//     (async () => {
//       const res = await fetch("/api/users/me");
//       if (res.ok) {
//         const { profile } = await res.json();
//         setMe(profile);
//         setIsPro(profile.subscription?.plan === "PRO" && profile.subscription.status === "ACTIVE");
//       }
//     })();
//   }, [session?.user]);
// 
//   // Scrolling the scanner (mostly) off-screen flips the tile back to the QR and stops the camera.
//   useEffect(() => {
//     const tile = qrTileRef.current;
//     if (!scannerOpen || !tile) return;
//     const observer = new IntersectionObserver(
//       ([entry]) => {
//         if (entry && entry.intersectionRatio < 0.25) setScannerOpen(false);
//       },
//       { threshold: [0, 0.25] },
//     );
//     observer.observe(tile);
//     return () => observer.disconnect();
//   }, [scannerOpen]);
// 
//   // The session already carries the user id, so the QR renders immediately instead of
//   // waiting on (or silently failing with) /api/users/me. Origin is read after mount to
//   // keep server and client markup identical.
//   const [origin, setOrigin] = useState("");
//   useEffect(() => setOrigin(window.location.origin), []);
//   const profileId = me?.id ?? session?.user?.id;
//   const profileUrl = origin && profileId ? `${origin}/u/${profileId}` : "";
// 
//   return (
//     <main className="min-h-dvh bg-black">
//       <div className="relative mx-auto min-h-dvh w-full max-w-[430px] overflow-x-hidden bg-[#0a0a0a] pb-[110px] text-white antialiased">
//         {/* ============ HERO ============ */}
//         <section className="relative overflow-hidden rounded-b-[24px] bg-[#1a0d33] pb-5 border-b border-[#F8FAFC]">
//           {/* <HeroBackground /> */}
//           <img className="top-0 absolute inset-0 h-full object-cover w-full" src="https://i.pinimg.com/736x/f2/3e/5a/f23e5a9b9d2b7375d0cc693f78aa0a89.jpg" alt="" />
// 
//           <div className="relative px-4 pt-[max(env(safe-area-inset-top),1rem)]">
//             {/* Shared top bar: avatar (side menu) · logo · search + notifications */}
//             <AppHeader
//               user={{
//                 name: me?.name ?? session?.user?.name ?? "",
//                 handle: (me?.name ?? session?.user?.name ?? "user").toLowerCase().replace(/\s+/g, ""),
//                 avatarUrl: me?.avatarUrl ?? session?.user?.image ?? null,
//                 followingCount: 0,
//                 followerCount: 0,
//                 isPro,
//               }}
//             />
// 
// 
// 
// 
//             {/* My profile QR: others scan it to open this profile; tap it to scan theirs in place */}
//             <div ref={qrTileRef} className="relative mx-auto mt-8 mb-6 h-[210px] w-[200px]">
//               {scannerOpen ? (
//                 <InlineQrScanner
//                   onClose={() => setScannerOpen(false)}
//                   className="h-full w-full rounded-[12px] shadow-[0_18px_40px_rgba(0,0,0,0.55)] ring-1 ring-white/25"
//                 />
//               ) : (
//                 <button
//                   type="button"
//                   onClick={() => setScannerOpen(true)}
//                   aria-label="Open QR scanner"
//                   className="relative block h-full w-full overflow-hidden rounded-[12px] bg-white p-3 shadow-[0_18px_40px_rgba(0,0,0,0.55)] ring-1 ring-white/25 active:scale-[0.98]"
//                 >
//                   {profileUrl ? (
//                     <>
//                       {/* Level M + a small centre hole keeps the code at 33x33 modules (~5.8px each);
//                       level H with a big hole made it 41x41 at ~4.4px, too fine for phone cameras to read. */}
//                       <QRCodeSVG
//                         value={profileUrl}
//                         size={192}
//                         level="M"
//                         className="h-full w-full"
//                         imageSettings={{ src: TRANSPARENT_PIXEL, height: 36, width: 36, excavate: true }}
//                       />
//                       <span className="absolute left-1/2 top-1/2 grid h-[30px] w-[30px] -translate-x-1/2 -translate-y-1/2 place-items-center overflow-hidden rounded-full bg-[#1a0d33] ring-2 ring-white">
//                         {me?.avatarUrl ?? session?.user?.image ? (
//                           // eslint-disable-next-line @next/next/no-img-element
//                           <img src={(me?.avatarUrl ?? session?.user?.image)!} alt="" className="h-full w-full object-cover" />
//                         ) : (
//                           <span className="text-[12px] font-bold text-white">{(me?.name ?? session?.user?.name ?? "?").charAt(0).toUpperCase()}</span>
//                         )}
//                       </span>
//                     </>
//                   ) : (
//                     <span className="absolute inset-0 bg-[#0e3236]">
//                       <QrPattern />
//                     </span>
//                   )}
//                 </button>
//               )}
//             </div>
// 
//             {/* Spin & Win */}
//             <Link href="/spin" className="relative mt-3 block h-[78px]">
//               <p
//                 className="text-[27px] font-black italic leading-none tracking-[-0.02em]"
//                 style={{
//                   background: "linear-gradient(180deg,#ffffff 0%,#c7d2fe 55%,#818cf8 100%)",
//                   WebkitBackgroundClip: "text",
//                   color: "transparent",
//                   WebkitTextStroke: "0.6px #1e1b4b",
//                   filter: "drop-shadow(0 2px 0 #1e1b4b)",
//                 }}
//               >
//                 SPIN&amp;WIN
//               </p>
//               <span className="mt-1.5 inline-block -rotate-[1.5deg] bg-white px-2 py-[3px] text-[11.5px] font-bold text-[#1e1b5e] shadow">
//                 win up to 500 credits
//               </span>
//             </Link>
//           </div>
//           <Wheel />
//         </section>
// 
//         {/* ============ CHIPS ============ */}
//         <section className="mt-5 space-y-[22px]">
//           <div className="no-scrollbar flex items-start gap-[18px] overflow-x-auto overflow-y-hidden pl-8 pr-5">
//             <TileChip icon={Plus} label="Offer" href="/explore/sell" cut />
//             <PillChip icon={UserRoundCog} label="My responses" href="/explore/buy" />
// 
//             {/* <PillChip icon={MapPin} label="Local" href="/?local=true" /> */}
//           </div>
//           <div className="no-scrollbar flex items-start gap-[20px] overflow-x-auto overflow-y-hidden pl-3 pr-5">
//             <TileChip icon={Globe} label="Anywhere" href="/" />
//             <PillChip icon={LayoutGrid} label="Categories" href="/" tab="Explore" iconClass="text-rose-400" />
//             {/* <PillChip icon={Users} label="Groups" href="/communities" iconClass="text-sky-400" /> */}
//           </div>
//         </section>
// 
//         {/* ============ RECOMMENDED ============ */}
// 
// 
//         {/* ============ STICKY SEARCH ============ */}
//         {/* Search drawer opens from the header search button (tap, or double fast pull-down) */}
//         <div className="sticky top-[max(env(safe-area-inset-top),0.5rem)] z-30 mt-10 flex justify-center">
//           <Link
//             href="/search"
//             data-search-origin="pill"
//             className="flex h-[50px] w-[220px] items-center gap-3.5 rounded-full border border-white/10 bg-[#1c1a2e]/75 px-5 text-white/80 shadow-[0_10px_30px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl active:scale-[0.98]"
//           >
//             <Search className="h-[16px] w-[16px] text-indigo-300" strokeWidth={2.2} />
//             <span className="text-[13px] font-medium tracking-[0.02em]">Search services, people or requests</span>
//           </Link>
//         </div>
// 
//         {/* ============ SPEND LESS, SAVE MORE (bento grid) ============ */}
//         <section className="mt-10 px-5">
//           <SectionHeader eyebrow="Discover" title="Find the right person" />
// 
//           <Card href="/" className="h-[117px] px-[18px] py-[18px]">
//             <CardTitle>Open requests</CardTitle>
//             <p className="mt-[16px] text-[13px] text-[#8f8f99]">
//               Up to <span className="font-semibold text-white tabular-nums">580</span> people looking
//             </p>
//             <p className="mt-1 flex items-center gap-1.5 text-[12.5px] font-medium text-emerald-400">
//               <span className="relative flex h-1.5 w-1.5">
//                 <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
//                 <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
//               </span>
//               Open right now
//             </p>
//             <Glow className="right-0 top-0 bg-orange-500/25" />
//             <Icon3D src="fire" className="right-3 top-3 h-[88px] w-[88px] rotate-[8deg]" />
//           </Card>
// 
//           <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-[16px]">
//             <Card href="/communities" className="h-[157px] p-[16px]">
//               <CardTitle>Groups</CardTitle>
//               <Glow className="-right-4 -top-4 bg-sky-500/20" />
//               <Icon3D src="groups" className="right-2.5 top-2.5 h-[68px] w-[68px]" />
//               <CardSub className="absolute bottom-[16px] left-[16px]">Join<br />Communities</CardSub>
//             </Card>
//             <Card href="/spends" className="h-[157px] p-[16px]">
//               <CardTitle>Spending</CardTitle>
//               <Glow className="-right-4 -top-4 bg-emerald-500/20" />
//               <Icon3D src="spends" className="right-2.5 top-2.5 h-[68px] w-[68px]" />
//               <CardSub className="absolute bottom-[16px] left-[16px]">
//                 <span className="text-[15px] font-semibold text-white tabular-nums">₹0</span> this<br />month
//               </CardSub>
//             </Card>
// 
//             <Card href="/invite" className="row-span-2 h-[127px] p-[16px]">
//               <CardTitle>Invite</CardTitle>
//               <Glow className="-right-4 -top-4 bg-amber-500/25" />
//               <Icon3D src="gift" className="right-2.5 top-2.5 h-[56px] w-[56px] rotate-[10deg]" />
//               <CardSub className="absolute bottom-[14px] left-[16px]">
//                 Get <span className="font-semibold text-amber-300">300</span><br />credits per friend
//               </CardSub>
//             </Card>
//             <Card href="/explore/buy" className="flex h-[55px] items-center px-[16px]">
//               <CardTitle>My responses</CardTitle>
//               <Icon3D src="slots" className="right-2 top-1/2 h-[38px] w-[38px] -translate-y-1/2 rotate-[10deg]" />
//             </Card>
//             <Card href="/explore/sell" className="-mt-[2px] flex h-[55px] items-center px-[16px]">
//               <CardTitle>Post an offer</CardTitle>
//               <Icon3D src="rocket" className="right-2 top-1/2 h-[38px] w-[38px] -translate-y-1/2" />
//             </Card>
//           </div>
//         </section>
// 
//         {/* ============ BUY & SELL ============ */}
//         <section className="mt-10 px-5">
//           <SectionHeader eyebrow="Requests & offers" title="Post, respond, find" href="/categories" />
//           <div className="grid grid-cols-3 gap-3">
//             <MiniTile href="/post" src="megaphone" title="Post" sub="New request" glow="bg-indigo-500/25" />
//             <MiniTile href="/explore/sell" src="package" title="My posts" sub="Requests & offers" glow="bg-orange-500/20" />
//             <MiniTile href="/featured" src="star" title="Featured" sub="Get seen" glow="bg-yellow-500/20" />
//             <MiniTile href="/?local=true" src="pin" title="Near me" sub="Close by" glow="bg-rose-500/20" />
//             <MiniTile href="/" src="globe" title="Anywhere" sub="Everywhere" glow="bg-sky-500/20" />
//             <MiniTile href="/categories" src="categories" title="Categories" sub="Browse all" glow="bg-violet-500/20" />
//           </div>
//         </section>
// 
//         {/* ============ COMMUNITY ============ */}
//         <section className="mt-10 px-5">
//           <SectionHeader eyebrow="Community" title="Talk, ask & share" href="/forum" />
//           <div className="grid grid-cols-2 gap-x-4 gap-y-[14px]">
//             <Card href="/forum" className="row-span-2 h-[150px] p-[16px]">
//               <CardTitle>Feed</CardTitle>
//               <Glow className="-right-4 -top-4 bg-yellow-400/20" />
//               <Icon3D src="bulb" className="right-2.5 top-2.5 h-[58px] w-[58px] rotate-[8deg]" />
//               <CardSub className="absolute bottom-[16px] left-[16px]">Ask, answer<br />&amp; discover</CardSub>
//             </Card>
//             <Card href="/chats" className="flex h-[68px] flex-col justify-center px-[16px]">
//               <CardTitle>Chats</CardTitle>
//               <CardSub>Deal directly</CardSub>
//               <Icon3D src="chat" className="right-2 top-1/2 h-[40px] w-[40px] -translate-y-1/2" />
//             </Card>
//             <Card href="/bookmarks" className="flex h-[68px] flex-col justify-center px-[16px]">
//               <CardTitle>Saved</CardTitle>
//               <CardSub>Your bookmarks</CardSub>
//               <Icon3D src="bookmark" className="right-2 top-1/2 h-[40px] w-[40px] -translate-y-1/2 rotate-[8deg]" />
//             </Card>
//           </div>
//         </section>
// 
//         {/* ============ WALLET ============ */}
//         <section className="mt-10 px-5">
//           <SectionHeader eyebrow="Wallet" title="Credits & payments" />
//           <Card href="/credits" className="flex h-[92px] flex-col justify-center bg-[linear-gradient(135deg,#1e1b4b_0%,#14122b_55%,#0b0b0b_100%)] px-[18px]">
//             <CardTitle>Credits wallet</CardTitle>
//             <CardSub className="mt-1">Transfer to anyone, instantly</CardSub>
//             <Glow className="right-0 top-0 bg-indigo-500/30" />
//             <Icon3D src="money" className="right-4 top-1/2 h-[64px] w-[64px] -translate-y-1/2 -rotate-[6deg]" />
//           </Card>
//           <div className="mt-3 grid grid-cols-2 gap-3">
//             <Card href="/credits/refunds" className="flex h-[68px] flex-col justify-center px-[16px]">
//               <CardTitle>Top-ups</CardTitle>
//               <CardSub>&amp; withdrawals</CardSub>
//               <Icon3D src="coin" className="right-2 top-1/2 h-[40px] w-[40px] -translate-y-1/2" />
//             </Card>
//             <Card href="/invoices" className="flex h-[68px] flex-col justify-center px-[16px]">
//               <CardTitle>Invoices</CardTitle>
//               <CardSub>All receipts</CardSub>
//               <Icon3D src="receipt" className="right-2 top-1/2 h-[40px] w-[40px] -translate-y-1/2 rotate-[8deg]" />
//             </Card>
//           </div>
//         </section>
// 
//         {/* ============ STAY UPDATED ============ */}
//         <section className="mt-10 px-5">
//           <SectionHeader eyebrow="You" title="Stay in the loop" />
//           <div className="overflow-hidden rounded-[18px] border border-white/[0.07] bg-[#0f0f12]">
//             <RowLink href="/activity" src="rocket" title="Activity" sub="Offers, responses & updates" />
//             <RowLink href="/notifications" src="bell" title="Notifications" sub="Never miss a request" />
//             <RowLink href="/spin" src="gift" title="Spin & Win" sub="Win up to 500 credits" badge="New" />
//           </div>
//         </section>
// 
//         {/* ============ UPGRADES ============ */}
//         <section className="mt-10">
//           <div className="px-5">
//             <SectionHeader eyebrow="What's new" title="xivago upgrades" />
//           </div>
//           <div className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-5 px-5">
//             <Link href="/" className="relative flex h-[118px] w-[255px] shrink-0 snap-start items-end overflow-hidden rounded-[18px] border border-white/[0.06] bg-gradient-to-br from-[#8a3410] via-[#4a1d0e] to-[#1d120e] p-5 active:scale-[0.985]">
//               <Icon3D src="coin" className="right-3 top-3 h-[52px] w-[52px] rotate-[12deg] opacity-90" />
//               <p className="relative text-[20px] font-bold leading-tight tracking-[-0.01em]">
//                 Money with <span className="inline-block -rotate-2 rounded-[4px] bg-[#fbbf24] px-1 text-[#2a1a05]">memes</span>
//               </p>
//             </Link>
//             <Link href="/spends" className="relative flex h-[118px] w-[255px] shrink-0 snap-start items-end overflow-hidden rounded-[18px] border border-white/[0.06] bg-gradient-to-br from-[#7a6216] via-[#3a2f10] to-[#17140c] p-5 active:scale-[0.985]">
//               <Icon3D src="spends" className="right-3 top-3 h-[52px] w-[52px] opacity-90" />
//               <p className="relative pr-10 text-[19px] font-bold leading-tight tracking-[-0.01em]">Find out what you spent last month</p>
//             </Link>
//             <Link href="/featured" className="relative flex h-[118px] w-[255px] shrink-0 snap-start items-end overflow-hidden rounded-[18px] border border-white/[0.06] bg-gradient-to-br from-[#3b2a8a] via-[#1f1752] to-[#0f0c22] p-5 active:scale-[0.985]">
//               <Icon3D src="star" className="right-3 top-3 h-[52px] w-[52px] rotate-[10deg] opacity-90" />
//               <p className="relative pr-10 text-[19px] font-bold leading-tight tracking-[-0.01em]">Feature your request at the top</p>
//             </Link>
//           </div>
//         </section>
// 
//         <p className="mt-10 text-center text-[11px] tracking-[0.12em] text-white/25 uppercase">xivago · Find the right person</p>
// 
//         {/* ============ BOTTOM NAV ============ */}
//         <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-[430px] -translate-x-1/2 bg-[#141414] pb-[max(env(safe-area-inset-bottom),10px)]">
//           <div className="flex items-center pt-[10px] pr-[60px]">
//             {NAV.map(({ icon: Icon, label, href, active }) => (
//               <Link key={label} href={href} className="flex flex-1 flex-col items-center gap-[5px]">
//                 {Icon ? (
//                   <Icon className="h-[20px] w-[20px] text-[#6b6b6b]" strokeWidth={1.4} />
//                 ) : (
//                   <HomeGlyph />
//                 )}
//                 <span className={cn("text-[10.5px]", active ? "text-[#fb923c]" : "text-[#6b6b6b]")}>{label}</span>
//               </Link>
//             ))}
//           </div>
//           <Link
//             href="/explore/sell"
//             className="absolute -top-[8px] right-0 grid h-[46px] w-[54px] place-items-center rounded-l-[14px] bg-gradient-to-br from-[#6d5cf6] to-[#7c3aed] shadow-[0_0_18px_rgba(124,58,237,0.55)] ring-1 ring-white/20"
//           >
//             <span className="-rotate-[10deg] text-[17px] font-black italic text-white [text-shadow:0_2px_0_#312e81]">sell</span>
//           </Link>
//         </nav>
// 
//         <style jsx global>{`.no-scrollbar::-webkit-scrollbar{display:none}.no-scrollbar{scrollbar-width:none}`}</style>
//       </div>
//     </main>
//   );
// }
// 
// /* ---------- Chips ---------- */
// 
// function PillChip({
//   icon: Icon, label, href, tab, iconClass,
// }: { icon: React.ElementType; label: string; href: string; tab?: string; iconClass?: string }) {
//   return (
//     <Link href={href} className="flex items-center justify-center gap-2">
// 
//       <div className="flex items-center gap-8 relative">
//         {tab && (
//           <span className="absolute -top-px left-1/2 -translate-x-1/2 rounded-b-[10px] bg-[#262626] px-4 py-[2px] text-[9px] text-[#bdbdbd]">
//             {tab}
//           </span>
//         )}
//         {/* <Icon className={cn("h-[20px] w-[20px] text-[#d4d4d4]", iconClass)} strokeWidth={1.5} /> */}
//         <LiquidMetalButton label={label} />
//         {/* <LiquidMetalButton viewMode="icon" /> */}
//       </div>
// 
//     </Link>
//   );
// }
// 
// function TileChip({ icon: Icon, label, href, cut }: { icon: React.ElementType; label: string; href: string; cut?: boolean }) {
//   return (
//     <Link href={href} className={cn("relative h-[67px] w-[62px] shrink-0", cut && "-ml-[30px]")}>
//       <span className="absolute inset-x-0 top-0 grid h-[61px] place-items-center rounded-[26px] border border-[#2a2a2a] bg-[#0d0d0d] pb-3">
//         <Icon className="h-[20px] w-[20px] text-amber-400" strokeWidth={1.6} />
//       </span>
//       <span className="absolute inset-x-0 bottom-0 bg-[#1f1f1f] py-[2px] text-center text-[9.5px] text-white">{label}</span>
//     </Link>
//   );
// }
// 
// /* ---------- Bento card + art slot ---------- */
// 
// function Card({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
//   return (
//     <Link
//       href={href}
//       className={cn(
//         "relative block overflow-hidden rounded-[18px] border border-white/[0.07] bg-[linear-gradient(160deg,#141418_0%,#0b0b0d_70%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-transform duration-150 active:scale-[0.985]",
//         className,
//       )}
//     >
//       {children}
//     </Link>
//   );
// }
// 
// function CardTitle({ children }: { children: React.ReactNode }) {
//   return <p className="relative z-10 text-[15px] font-semibold tracking-[-0.01em] text-[#f1f1f3]">{children}</p>;
// }
// 
// function CardSub({ children, className }: { children: React.ReactNode; className?: string }) {
//   return <p className={cn("relative z-10 text-[12.5px] leading-[1.45] text-[#8f8f99]", className)}>{children}</p>;
// }
// 
// function SectionHeader({ eyebrow, title, href }: { eyebrow: string; title: string; href?: string }) {
//   return (
//     <div className="mb-4 flex items-end justify-between px-0.5">
//       <div>
//         <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-indigo-300/70">{eyebrow}</p>
//         <h3 className="mt-1 text-[18px] font-bold tracking-[-0.02em] text-white">{title}</h3>
//       </div>
//       {href && (
//         <Link href={href} className="flex items-center gap-0.5 pb-0.5 text-[12px] font-medium text-[#fb923c]">
//           See all <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.2} />
//         </Link>
//       )}
//     </div>
//   );
// }
// 
// /** Transparent 3D icon (public/explore/*.png), pinned to a card's top-right corner. */
// function Icon3D({ src, className }: { src: string; className?: string }) {
//   return (
//     // eslint-disable-next-line @next/next/no-img-element
//     <img
//       src={`/explore/${src}.png`}
//       alt=""
//       aria-hidden
//       draggable={false}
//       loading="lazy"
//       className={cn("pointer-events-none absolute select-none object-contain drop-shadow-[0_8px_14px_rgba(0,0,0,0.55)]", className)}
//     />
//   );
// }
// 
// /** Soft coloured halo behind a corner icon. */
// function Glow({ className }: { className?: string }) {
//   return <span aria-hidden className={cn("pointer-events-none absolute h-24 w-24 rounded-full blur-2xl", className)} />;
// }
// 
// function MiniTile({ href, src, title, sub, glow }: { href: string; src: string; title: string; sub: string; glow: string }) {
//   return (
//     <Card href={href} className="h-[100px] p-3">
//       <Glow className={cn("-right-6 -top-6 h-16 w-16", glow)} />
//       <Icon3D src={src} className="right-2 top-2 h-[40px] w-[40px]" />
//       <div className="absolute bottom-3 left-3 right-2">
//         <p className="relative z-10 truncate text-[13px] font-semibold tracking-[-0.01em] text-[#f1f1f3]">{title}</p>
//         <p className="relative z-10 truncate text-[11px] text-[#8f8f99]">{sub}</p>
//       </div>
//     </Card>
//   );
// }
// 
// function RowLink({ href, src, title, sub, badge }: { href: string; src: string; title: string; sub: string; badge?: string }) {
//   return (
//     <Link href={href} className="flex items-center gap-3.5 border-b border-white/[0.06] px-4 py-3.5 last:border-b-0 active:bg-white/[0.03]">
//       {/* eslint-disable-next-line @next/next/no-img-element */}
//       <img src={`/explore/${src}.png`} alt="" aria-hidden loading="lazy" className="h-9 w-9 shrink-0 object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]" />
//       <div className="min-w-0 flex-1">
//         <p className="flex items-center gap-2 text-[14px] font-semibold text-[#f1f1f3]">
//           {title}
//           {badge && <span className="rounded-full bg-[#fb923c]/15 px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wider text-[#fb923c]">{badge}</span>}
//         </p>
//         <p className="truncate text-[12px] text-[#8f8f99]">{sub}</p>
//       </div>
//       <ChevronRight className="h-4 w-4 shrink-0 text-white/30" strokeWidth={2} />
//     </Link>
//   );
// }
// 
// /** Placeholder art — replace with an <img> of your own product render to match the photo. */
// function Art({ className, from, to, icon: Icon }: { className?: string; from: string; to: string; icon: React.ElementType }) {
//   return (
//     <span
//       className={cn("absolute grid place-items-center rounded-[12px] shadow-[0_10px_24px_rgba(0,0,0,0.5)]", className)}
//       style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
//     >
//       <span className="absolute inset-0 rounded-[inherit] bg-[linear-gradient(160deg,rgba(255,255,255,0.35),transparent_45%)]" />
//       <Icon className="relative h-1/3 w-1/3 text-white/90" strokeWidth={1.6} />
//     </span>
//   );
// }
// 
// /* ---------- Decorative ---------- */
// 
// function HeroBackground() {
//   const notes = [
//     "-left-10 top-2 w-36 rotate-[-28deg] from-[#3d8a8f] to-[#1f4f55]",
//     "-left-14 top-[175px] w-40 rotate-[18deg] from-[#6b3fb0] to-[#3a1f70]",
//     "-left-6 top-[320px] w-36 rotate-[-12deg] from-[#3d8a8f] to-[#1f4f55]",
//     "-right-12 top-6 w-40 rotate-[30deg] from-[#7b49c4] to-[#43217c]",
//     "-right-14 top-[190px] w-44 rotate-[-22deg] from-[#5b33a0] to-[#2c1660]",
//     "left-[30%] top-[-30px] w-40 rotate-[8deg] from-[#5b33a0] to-[#2c1660]",
//   ];
//   return (
//     <div className="absolute inset-0">
//       <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_30%,#3a1d73_0%,#24124d_50%,#120a26_100%)]" />
//       {notes.map((c, i) => (
//         <div key={i} className={cn("absolute h-[68px] rounded-md bg-gradient-to-br opacity-60 blur-[1.5px]", c)}>
//           <div className="absolute inset-[6px] rounded-sm border border-white/15" />
//           <div className="absolute right-3 top-1/2 h-7 w-7 -translate-y-1/2 rounded-full border border-white/15" />
//         </div>
//       ))}
//       <div className="absolute inset-0 bg-[repeating-radial-gradient(circle_at_0_0,rgba(255,255,255,0.025)_0_1px,transparent_1px_3px)]" />
//       <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#140b24] to-transparent" />
//     </div>
//   );
// }
// 
// function QrPattern() {
//   const cells: [number, number][] = [];
//   for (let y = 0; y < 29; y++) for (let x = 0; x < 29; x++) if ((x * 7 + y * 13 + x * y) % 5 < 2) cells.push([x, y]);
//   const finder = (x: number, y: number) => (
//     <g key={`f${x}${y}`} fill="none" stroke="#1d5b61" strokeWidth="1">
//       <rect x={x + 0.5} y={y + 0.5} width="6" height="6" />
//       <rect x={x + 2} y={y + 2} width="3" height="3" fill="#1d5b61" />
//     </g>
//   );
//   return (
//     <svg viewBox="0 0 29 29" className="absolute inset-0 h-full w-full" shapeRendering="crispEdges">
//       {cells.map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#164a50" />)}
//       {finder(1, 21)}
//       {finder(21, 21)}
//     </svg>
//   );
// }
// 
// function Wheel() {
//   const fills = ["#2b8a8f", "#5b2a9a", "#2b8a8f", "#5b2a9a", "#2b8a8f", "#5b2a9a", "#2b8a8f", "#5b2a9a"];
//   const labels = ["500", "30", "200", "50", "100", "20", "10", "5"];
//   const rad = (d: number) => (d * Math.PI) / 180;
//   return (
//     <svg viewBox="0 0 200 200" className="pointer-events-none absolute -bottom-[92px] -right-[34px] h-[180px] w-[180px] -rotate-[25deg] drop-shadow-[0_0_14px_rgba(0,0,0,0.6)]">
//       <circle cx="100" cy="100" r="99" fill="url(#rim)" />
//       <defs>
//         <linearGradient id="rim" x1="0" y1="0" x2="1" y2="1">
//           <stop offset="0" stopColor="#f1f5f9" />
//           <stop offset="1" stopColor="#64748b" />
//         </linearGradient>
//       </defs>
//       <circle cx="100" cy="100" r="91" fill="#1e293b" />
//       {fills.map((f, i) => {
//         const [s, e] = [rad(i * 45), rad(i * 45 + 45)];
//         return <path key={i} d={`M100 100L${100 + 88 * Math.cos(s)} ${100 + 88 * Math.sin(s)}A88 88 0 0 1 ${100 + 88 * Math.cos(e)} ${100 + 88 * Math.sin(e)}Z`} fill={f} />;
//       })}
//       {labels.map((l, i) => {
//         const a = i * 45 + 22.5;
//         const [x, y] = [100 + 62 * Math.cos(rad(a)), 100 + 62 * Math.sin(rad(a))];
//         return (
//           <text key={l} x={x} y={y} fill="#f8fafc" fontSize="13" fontWeight="800" textAnchor="middle" dominantBaseline="middle" transform={`rotate(${a + 90} ${x} ${y})`}>
//             {l}
//           </text>
//         );
//       })}
//       <circle cx="100" cy="100" r="11" fill="#334155" stroke="#94a3b8" strokeWidth="2" />
//     </svg>
//   );
// }
// 
// function HomeGlyph() {
//   // orange "feather/plane" style home icon like the photo
//   return (
//     <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="#fb923c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
//       <path d="M3 5c5-1 11 0 18 3-6 1-10 4-13 9-1-4-3-8-5-12Z" />
//       <path d="M8 17c1-4 4-7 9-8" />
//       <path d="M6 10c3 0 6 1 9 3" />
//     </svg>
//   );
// }

// ===================================================================
// v3 (live): metallic chrome / gold 3D icons from /public/explore/metal
// ===================================================================

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Search, Mail, Check, UserRoundCog, Users, MapPin, Globe, LayoutGrid,
  Gift, Flame, ShoppingBag, Layers, Plus, Wallet, ArrowUpRight, Trophy, Archive, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useExploreIcons, EXPLORE_ICON_BASE } from "@/lib/explore-icons";
import { AppHeader } from "@/components/app-header";
import { ExploreHero } from "@/components/explore/explore-hero";
import { ExploreQuickActions } from "@/components/explore/explore-quick-actions";
import { RecommendedPeople } from "@/components/explore/recommended-people";
import { NearbyForYou } from "@/components/nearby-for-you";
import { ForYouStrip, newVisitSeed } from "@/components/for-you-strip";
import { ScrollToTop } from "@/components/scroll-to-top";

/* ---------- Data — swap with your APIs / images ---------- */

const PEOPLE = ["Aarav Mehta", "Aryan Rohilla", "Disha Chawla", "Jitendra Arora", "Mr Syed Ali"];

const NAV = [
  { icon: Wallet, label: "Spots", href: "/explore/buy" },
  { icon: ArrowUpRight, label: "Spending", href: "/spends" },
  { icon: null, label: "Home", href: "/explore", active: true },
  { icon: Trophy, label: "Rewards", href: "/invite" },
  { icon: Archive, label: "Groups", href: "/communities" },
];

/* ---------- Page (mobile only: locked to phone width) ---------- */

export default function Explore() {
  const { data: session } = useSession();
  const [me, setMe] = useState<{ id: string; name: string | null; avatarUrl: string | null; creditBalance: number } | null>(null);
  const [isPro, setIsPro] = useState(false);
  // New per visit, so "For you" shows a different 10 each time.
  const [visitSeed] = useState(newVisitSeed);

  useEffect(() => {
    if (!session?.user) return;
    (async () => {
      const res = await fetch("/api/users/me");
      if (res.ok) {
        const { profile } = await res.json();
        setMe(profile);
        setIsPro(profile.subscription?.plan === "PRO" && profile.subscription.status === "ACTIVE");
      }
    })();
  }, [session?.user]);

  // The session already carries the user id, so the QR renders immediately instead of
  // waiting on (or silently failing with) /api/users/me. Origin is read after mount to
  // keep server and client markup identical.
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const profileId = me?.id ?? session?.user?.id;
  const profileUrl = origin && profileId ? `${origin}/u/${profileId}` : "";
  const displayName = me?.name ?? session?.user?.name ?? "";
  const avatarUrl = me?.avatarUrl ?? session?.user?.image ?? null;

  return (
    <main className="min-h-dvh bg-black">
      <ScrollToTop path="/explore" />
      <div className="relative mx-auto min-h-dvh w-full max-w-[430px] overflow-x-hidden bg-[#0a0a0a] pb-[110px] text-white antialiased">
        {/* ============ HERO ============ */}
        <ExploreHero
          profileUrl={profileUrl}
          avatarUrl={avatarUrl}
          initial={displayName.charAt(0).toUpperCase() || "?"}
          header={
            /* Shared top bar: avatar (side menu) · logo · search + notifications */
            <AppHeader
              user={{
                name: displayName,
                handle: (displayName || "user").toLowerCase().replace(/\s+/g, ""),
                avatarUrl,
                followingCount: 0,
                followerCount: 0,
                isPro,
              }}
            />
          }
        />

        {/* ============ QUICK ACTIONS ============ */}
        <ExploreQuickActions userId={profileId} name={displayName} credits={me?.creditBalance ?? null} />

        {/* ============ RECOMMENDED ============ */}
        <RecommendedPeople signedIn={!!session?.user} />

        {/* ============ NEAR YOU (works even with the nearby filter off) ============ */}
        {session?.user && <NearbyForYou className="-mx-4 mt-2" />}

        {/* ============ FOR YOU: offers, requests & feed posts (10 at a time) ============ */}
        {session?.user && (
          <ForYouStrip
            kind="mixed"
            seed={`${visitSeed}-explore`}
            title="For you"
            subtitle="Offers, requests & feed posts from your niches, likes, views and area"
            className="mt-4"
          />
        )}

        {/* ============ STICKY SEARCH ============ */}
        {/* Search drawer opens from the header search button (tap, or double fast pull-down) */}
        <div className="sticky top-[max(env(safe-area-inset-top),0.5rem)] z-30 mt-10 flex justify-center">
          <Link
            href="/search"
            data-search-origin="pill"
            className="flex h-[50px] w-[220px] items-center gap-3.5 rounded-full border border-white/10 bg-[#1c1a2e]/75 px-5 text-white/80 shadow-[0_10px_30px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl active:scale-[0.98]"
          >
            <Search className="h-[16px] w-[16px] text-indigo-300" strokeWidth={2.2} />
            <span className="text-[13px] font-medium tracking-[0.02em]">Search services, people or requests</span>
          </Link>
        </div>

        {/* ============ SPEND LESS, SAVE MORE (bento grid) ============ */}
        <section className="mt-10 px-5">
          <SectionHeader eyebrow="Discover" title="Find the right person" />

          <Card href="/" className="h-[117px] px-[18px] py-[18px]">
            <CardTitle>Open requests</CardTitle>
            <p className="mt-[16px] text-[13px] text-[#8f8f99]">
              Up to <span className="font-semibold text-white tabular-nums">580</span> people looking
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-[12.5px] font-medium text-emerald-400">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              Open right now
            </p>
            <Glow className="right-0 top-0 bg-amber-400/20" color="bg-orange-500/25" />
            <Icon3D src="fire" className="right-3 top-3 h-[88px] w-[88px] rotate-[8deg]" />
          </Card>

          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-[16px]">
            <Card href="/communities" className="h-[157px] p-[16px]">
              <CardTitle>Groups</CardTitle>
              <Glow className="-right-4 -top-4 bg-white/10" color="bg-sky-500/20" />
              <Icon3D src="groups" className="right-2.5 top-2.5 h-[68px] w-[68px]" />
              <CardSub className="absolute bottom-[16px] left-[16px]">Join<br />Communities</CardSub>
            </Card>
            <Card href="/spends" className="h-[157px] p-[16px]">
              <CardTitle>Spending</CardTitle>
              <Glow className="-right-4 -top-4 bg-white/10" color="bg-emerald-500/20" />
              <Icon3D src="spends" className="right-2.5 top-2.5 h-[68px] w-[68px]" />
              <CardSub className="absolute bottom-[16px] left-[16px]">
                <span className="text-[15px] font-semibold text-white tabular-nums">₹0</span> this<br />month
              </CardSub>
            </Card>

            <Card href="/invite" className="row-span-2 h-[127px] p-[16px]">
              <CardTitle>Invite</CardTitle>
              <Glow className="-right-4 -top-4 bg-amber-400/20" color="bg-amber-500/25" />
              <Icon3D src="gift" className="right-2.5 top-2.5 h-[56px] w-[56px] rotate-[10deg]" />
              <CardSub className="absolute bottom-[14px] left-[16px]">
                Get <span className="font-semibold text-amber-300">300</span><br />credits per friend
              </CardSub>
            </Card>
            <Card href="/explore/buy" className="flex h-[55px] items-center px-[16px]">
              <CardTitle>My responses</CardTitle>
              <Icon3D src="slots" className="right-2 top-1/2 h-[38px] w-[38px] -translate-y-1/2 rotate-[10deg]" />
            </Card>
            <Card href="/explore/sell" className="-mt-[2px] flex h-[55px] items-center px-[16px]">
              <CardTitle>Post an offer</CardTitle>
              <Icon3D src="rocket" className="right-2 top-1/2 h-[38px] w-[38px] -translate-y-1/2" />
            </Card>
          </div>
        </section>

        {/* ============ BUY & SELL ============ */}
        <section className="mt-10 px-5">
          <SectionHeader eyebrow="Requests & offers" title="Post, respond, find" href="/categories" />
          <div className="grid grid-cols-3 gap-3">
            <MiniTile href="/post" src="megaphone" title="Post" sub="New request" glow="bg-white/10" color="bg-indigo-500/25" />
            <MiniTile href="/explore/sell" src="package" title="My posts" sub="Requests & offers" glow="bg-white/10" color="bg-orange-500/20" />
            <MiniTile href="/featured" src="star" title="Featured" sub="Get seen" glow="bg-amber-400/20" color="bg-yellow-500/20" />
            <MiniTile href="/?local=true" src="pin" title="Near me" sub="Close by" glow="bg-white/10" color="bg-rose-500/20" />
            <MiniTile href="/" src="globe" title="Anywhere" sub="Everywhere" glow="bg-white/10" color="bg-sky-500/20" />
            <MiniTile href="/categories" src="categories" title="Categories" sub="Browse all" glow="bg-white/10" color="bg-violet-500/20" />
          </div>
        </section>

        {/* ============ COMMUNITY ============ */}
        <section className="mt-10 px-5">
          <SectionHeader eyebrow="Community" title="Talk, ask & share" href="/forum" />
          <div className="grid grid-cols-2 gap-x-4 gap-y-[14px]">
            <Card href="/forum" className="row-span-2 h-[150px] p-[16px]">
              <CardTitle>Feed</CardTitle>
              <Glow className="-right-4 -top-4 bg-amber-400/20" color="bg-yellow-400/20" />
              <Icon3D src="bulb" className="right-2.5 top-2.5 h-[58px] w-[58px] rotate-[8deg]" />
              <CardSub className="absolute bottom-[16px] left-[16px]">Ask, answer<br />&amp; discover</CardSub>
            </Card>
            <Card href="/chats" className="flex h-[68px] flex-col justify-center px-[16px]">
              <CardTitle>Chats</CardTitle>
              <CardSub>Deal directly</CardSub>
              <Icon3D src="chat" className="right-2 top-1/2 h-[40px] w-[40px] -translate-y-1/2" />
            </Card>
            <Card href="/bookmarks" className="flex h-[68px] flex-col justify-center px-[16px]">
              <CardTitle>Saved</CardTitle>
              <CardSub>Your bookmarks</CardSub>
              <Icon3D src="bookmark" className="right-2 top-1/2 h-[40px] w-[40px] -translate-y-1/2 rotate-[8deg]" />
            </Card>
          </div>
        </section>

        {/* ============ WALLET ============ */}
        <section className="mt-10 px-5">
          <SectionHeader eyebrow="Wallet" title="Credits & payments" />
          <Card href="/credits" className="flex h-[92px] flex-col justify-center bg-[linear-gradient(135deg,#1e1b4b_0%,#14122b_55%,#0b0b0b_100%)] px-[18px]">
            <CardTitle>Credits wallet</CardTitle>
            <CardSub className="mt-1">Balance, top-ups and history</CardSub>
            <Glow className="right-0 top-0 bg-amber-400/15" color="bg-indigo-500/30" />
            <Icon3D src="money" className="right-4 top-1/2 h-[64px] w-[64px] -translate-y-1/2 -rotate-[6deg]" />
          </Card>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Card href="/credits/refunds" className="flex h-[68px] flex-col justify-center px-[16px]">
              <CardTitle>Top-ups</CardTitle>
              <CardSub>&amp; withdrawals</CardSub>
              <Icon3D src="coin" className="right-2 top-1/2 h-[40px] w-[40px] -translate-y-1/2" />
            </Card>
            <Card href="/invoices" className="flex h-[68px] flex-col justify-center px-[16px]">
              <CardTitle>Invoices</CardTitle>
              <CardSub>All receipts</CardSub>
              <Icon3D src="receipt" className="right-2 top-1/2 h-[40px] w-[40px] -translate-y-1/2 rotate-[8deg]" />
            </Card>
          </div>
        </section>

        {/* ============ STAY UPDATED ============ */}
        <section className="mt-10 px-5">
          <SectionHeader eyebrow="You" title="Stay in the loop" />
          <div className="overflow-hidden rounded-[18px] border border-white/[0.07] bg-[#0f0f12]">
            <RowLink href="/activity" src="rocket" title="Activity" sub="Offers, responses & updates" />
            <RowLink href="/notifications" src="bell" title="Notifications" sub="Never miss a request" />
            <RowLink href="/spin" src="gift" title="Spin & Win" sub="Win up to 500 credits" badge="New" />
          </div>
        </section>

        {/* ============ UPGRADES ============ */}
        <section className="mt-10">
          <div className="px-5">
            <SectionHeader eyebrow="What's new" title="xivago upgrades" />
          </div>
          <div className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-5 px-5">
            <Link href="/" className="relative flex h-[118px] w-[255px] shrink-0 snap-start items-end overflow-hidden rounded-[18px] border border-white/[0.06] bg-gradient-to-br from-[#8a3410] via-[#4a1d0e] to-[#1d120e] p-5 active:scale-[0.985]">
              <Icon3D src="coin" className="right-3 top-3 h-[52px] w-[52px] rotate-[12deg] opacity-90" />
              <p className="relative text-[20px] font-bold leading-tight tracking-[-0.01em]">
                Money with <span className="inline-block -rotate-2 rounded-[4px] bg-[#fbbf24] px-1 text-[#2a1a05]">memes</span>
              </p>
            </Link>
            <Link href="/spends" className="relative flex h-[118px] w-[255px] shrink-0 snap-start items-end overflow-hidden rounded-[18px] border border-white/[0.06] bg-gradient-to-br from-[#7a6216] via-[#3a2f10] to-[#17140c] p-5 active:scale-[0.985]">
              <Icon3D src="spends" className="right-3 top-3 h-[52px] w-[52px] opacity-90" />
              <p className="relative pr-10 text-[19px] font-bold leading-tight tracking-[-0.01em]">Find out what you spent last month</p>
            </Link>
            <Link href="/featured" className="relative flex h-[118px] w-[255px] shrink-0 snap-start items-end overflow-hidden rounded-[18px] border border-white/[0.06] bg-gradient-to-br from-[#3b2a8a] via-[#1f1752] to-[#0f0c22] p-5 active:scale-[0.985]">
              <Icon3D src="star" className="right-3 top-3 h-[52px] w-[52px] rotate-[10deg] opacity-90" />
              <p className="relative pr-10 text-[19px] font-bold leading-tight tracking-[-0.01em]">Feature your request at the top</p>
            </Link>
          </div>
        </section>

        <p className="mt-10 text-center text-[11px] tracking-[0.12em] text-white/25 uppercase">xivago · Find the right person</p>

        {/* ============ BOTTOM NAV (removed: the shared app bottom nav is used instead) ============
        <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-[430px] -translate-x-1/2 bg-[#141414] pb-[max(env(safe-area-inset-bottom),10px)]">
          <div className="flex items-center pt-[10px] pr-[60px]">
            {NAV.map(({ icon: Icon, label, href, active }) => (
              <Link key={label} href={href} className="flex flex-1 flex-col items-center gap-[5px]">
                {Icon ? (
                  <Icon className="h-[20px] w-[20px] text-[#6b6b6b]" strokeWidth={1.4} />
                ) : (
                  <HomeGlyph />
                )}
                <span className={cn("text-[10.5px]", active ? "text-[#fb923c]" : "text-[#6b6b6b]")}>{label}</span>
              </Link>
            ))}
          </div>
          <Link
            href="/explore/sell"
            className="absolute -top-[8px] right-0 grid h-[46px] w-[54px] place-items-center rounded-l-[14px] bg-gradient-to-br from-[#6d5cf6] to-[#7c3aed] shadow-[0_0_18px_rgba(124,58,237,0.55)] ring-1 ring-white/20"
          >
            <span className="-rotate-[10deg] text-[17px] font-black italic text-white [text-shadow:0_2px_0_#312e81]">sell</span>
          </Link>
        </nav> */}

        <style jsx global>{`.no-scrollbar::-webkit-scrollbar{display:none}.no-scrollbar{scrollbar-width:none}`}</style>
      </div>
    </main>
  );
}

/* ---------- Bento card + art slot ---------- */

function Card({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "relative block overflow-hidden rounded-[18px] border border-white/[0.07] bg-[linear-gradient(160deg,#141418_0%,#0b0b0d_70%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-transform duration-150 active:scale-[0.985]",
        className,
      )}
    >
      {children}
    </Link>
  );
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return <p className="relative z-10 text-[15px] font-semibold tracking-[-0.01em] text-[#f1f1f3]">{children}</p>;
}

function CardSub({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("relative z-10 text-[12.5px] leading-[1.45] text-[#8f8f99]", className)}>{children}</p>;
}

function SectionHeader({ eyebrow, title, href }: { eyebrow: string; title: string; href?: string }) {
  return (
    <div className="mb-4 flex items-end justify-between px-0.5">
      <div>
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-indigo-300/70">{eyebrow}</p>
        <h3 className="mt-1 text-[18px] font-bold tracking-[-0.02em] text-white">{title}</h3>
      </div>
      {href && (
        <Link href={href} className="flex items-center gap-0.5 pb-0.5 text-[12px] font-medium text-[#fb923c]">
          See all <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.2} />
        </Link>
      )}
    </div>
  );
}

/** Transparent 3D icon, pinned to a card's top-right corner. The icon set (colour / metallic /
 *  Pinterest) is the user's choice in Settings → Explore icons. */
function Icon3D({ src, className }: { src: string; className?: string }) {
  const set = useExploreIcons();
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${EXPLORE_ICON_BASE[set]}/${src}.png`}
      alt=""
      aria-hidden
      draggable={false}
      loading="lazy"
      className={cn(
        "pointer-events-none absolute select-none object-contain",
        set === "metal" ? "drop-shadow-[0_10px_16px_rgba(0,0,0,0.7)]" : "drop-shadow-[0_8px_14px_rgba(0,0,0,0.55)]",
        className,
      )}
    />
  );
}

/** Soft halo behind a corner icon: `className` holds position + the metallic tone,
 *  `color` is the tint used for the colour / Pinterest icon sets. */
function Glow({ className, color }: { className?: string; color?: string }) {
  const set = useExploreIcons();
  return (
    <span
      aria-hidden
      className={cn("pointer-events-none absolute h-24 w-24 rounded-full blur-2xl", className, set !== "metal" && color)}
    />
  );
}

function MiniTile({ href, src, title, sub, glow, color }: { href: string; src: string; title: string; sub: string; glow: string; color?: string }) {
  return (
    <Card href={href} className="h-[100px] p-3">
      <Glow className={cn("-right-6 -top-6 h-16 w-16", glow)} color={color} />
      <Icon3D src={src} className="right-2 top-2 h-[40px] w-[40px]" />
      <div className="absolute bottom-3 left-3 right-2">
        <p className="relative z-10 truncate text-[13px] font-semibold tracking-[-0.01em] text-[#f1f1f3]">{title}</p>
        <p className="relative z-10 truncate text-[11px] text-[#8f8f99]">{sub}</p>
      </div>
    </Card>
  );
}

function RowLink({ href, src, title, sub, badge }: { href: string; src: string; title: string; sub: string; badge?: string }) {
  const set = useExploreIcons();
  return (
    <Link href={href} className="flex items-center gap-3.5 border-b border-white/[0.06] px-4 py-3.5 last:border-b-0 active:bg-white/[0.03]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${EXPLORE_ICON_BASE[set]}/${src}.png`} alt="" aria-hidden loading="lazy" className="h-9 w-9 shrink-0 object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-[14px] font-semibold text-[#f1f1f3]">
          {title}
          {badge && <span className="rounded-full bg-[#fb923c]/15 px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wider text-[#fb923c]">{badge}</span>}
        </p>
        <p className="truncate text-[12px] text-[#8f8f99]">{sub}</p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-white/30" strokeWidth={2} />
    </Link>
  );
}

/** Placeholder art — replace with an <img> of your own product render to match the photo. */
function Art({ className, from, to, icon: Icon }: { className?: string; from: string; to: string; icon: React.ElementType }) {
  return (
    <span
      className={cn("absolute grid place-items-center rounded-[12px] shadow-[0_10px_24px_rgba(0,0,0,0.5)]", className)}
      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
    >
      <span className="absolute inset-0 rounded-[inherit] bg-[linear-gradient(160deg,rgba(255,255,255,0.35),transparent_45%)]" />
      <Icon className="relative h-1/3 w-1/3 text-white/90" strokeWidth={1.6} />
    </span>
  );
}

/* ---------- Decorative ---------- */

function HeroBackground() {
  const notes = [
    "-left-10 top-2 w-36 rotate-[-28deg] from-[#3d8a8f] to-[#1f4f55]",
    "-left-14 top-[175px] w-40 rotate-[18deg] from-[#6b3fb0] to-[#3a1f70]",
    "-left-6 top-[320px] w-36 rotate-[-12deg] from-[#3d8a8f] to-[#1f4f55]",
    "-right-12 top-6 w-40 rotate-[30deg] from-[#7b49c4] to-[#43217c]",
    "-right-14 top-[190px] w-44 rotate-[-22deg] from-[#5b33a0] to-[#2c1660]",
    "left-[30%] top-[-30px] w-40 rotate-[8deg] from-[#5b33a0] to-[#2c1660]",
  ];
  return (
    <div className="absolute inset-0">
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_30%,#3a1d73_0%,#24124d_50%,#120a26_100%)]" />
      {notes.map((c, i) => (
        <div key={i} className={cn("absolute h-[68px] rounded-md bg-gradient-to-br opacity-60 blur-[1.5px]", c)}>
          <div className="absolute inset-[6px] rounded-sm border border-white/15" />
          <div className="absolute right-3 top-1/2 h-7 w-7 -translate-y-1/2 rounded-full border border-white/15" />
        </div>
      ))}
      <div className="absolute inset-0 bg-[repeating-radial-gradient(circle_at_0_0,rgba(255,255,255,0.025)_0_1px,transparent_1px_3px)]" />
      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#140b24] to-transparent" />
    </div>
  );
}

function HomeGlyph() {
  // orange "feather/plane" style home icon like the photo
  return (
    <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="#fb923c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 5c5-1 11 0 18 3-6 1-10 4-13 9-1-4-3-8-5-12Z" />
      <path d="M8 17c1-4 4-7 9-8" />
      <path d="M6 10c3 0 6 1 9 3" />
    </svg>
  );
}
