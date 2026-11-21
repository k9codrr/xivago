// import { redirect } from "next/navigation";

// // Sending and receiving credits is paused. To restore: delete this stub and uncomment below.
// export default function SendCreditsPaused() {
//   redirect("/activity");
// }

// --- Original implementation, commented out while credit sending/receiving is paused ---

// ── Previous Send / Receive page (kept for reference; replaced by the wallet design below) ──
// "use client";
//
// import { useState } from "react";
// import { useRouter } from "next/navigation";
// import { toast } from "sonner";
// import { ChevronLeft, Loader2, QrCode as QrCodeIcon, ScanLine, Coins } from "lucide-react";
// import { QRCodeSVG } from "qrcode.react";
// import { cn } from "@/lib/utils";
// import { QrScannerModal } from "@/components/qr-scanner-modal";
// import { AddCreditsModal } from "@/components/add-credits-modal";
//  
// export default function SendCreditsPage() {
//   const router = useRouter();
//   const [mode, setMode] = useState<"receive" | "send">("receive");
//   const [amount, setAmount] = useState("");
//   const [generating, setGenerating] = useState(false);
//   const [qrUrl, setQrUrl] = useState<string | null>(null);
//   const [scannerOpen, setScannerOpen] = useState(false);
//   const [topUpOpen, setTopUpOpen] = useState(false);
//
//   async function handleGenerate() {
//     setGenerating(true);
//     try {
//       const amt = amount.trim() ? parseInt(amount, 10) : undefined;
//       const res = await fetch("/api/credits/transfer", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ amount: amt }),
//       });
//       const data = await res.json();
//       if (!res.ok) {
//         toast.error(data?.error?.message ?? "Could not generate a QR code.");
//         return;
//       }
//       setQrUrl(`${window.location.origin}${data.url}`);
//     } finally {
//       setGenerating(false);
//     }
//   }
//
//   return (
//     <main className="min-h-dvh bg-neutral-950 pb-16 dark:bg-black">
//       <header className="flex items-center gap-3 px-4 py-3">
//         <button type="button" onClick={() => router.back()} aria-label="Back" className="text-neutral-300">
//           <ChevronLeft className="h-5 w-5" />
//         </button>
//         <h1 className="text-lg font-bold text-white">Send Credits</h1>
//       </header>
//
//       <div className="mx-4 flex gap-2 rounded-full bg-neutral-900 p-1">
//         {(["receive", "send"] as const).map((m) => (
//           <button
//             key={m}
//             type="button"
//             onClick={() => setMode(m)}
//             className={cn(
//               "flex-1 rounded-full py-2 text-sm font-semibold capitalize",
//               mode === m ? "bg-white text-black" : "text-neutral-400",
//             )}
//           >
//             {m}
//           </button>
//         ))}
//       </div>
//
//       {mode === "receive" && (
//         <div className="flex flex-col items-center gap-4 px-6 py-8">
//           {!qrUrl ? (
//             <>
//               <QrCodeIcon className="h-10 w-10 text-amber-400" />
//               <p className="text-center text-sm text-neutral-400">
//                 Generate a QR code so someone can send you credits directly.
//               </p>
//               <input
//                 value={amount}
//                 onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
//                 placeholder="Amount (leave blank to let them choose)"
//                 className="w-full rounded-xl bg-neutral-900 px-3.5 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none"
//               />
//               <button
//                 type="button"
//                 onClick={handleGenerate}
//                 disabled={generating}
//                 className="flex w-full items-center justify-center gap-2 rounded-full bg-amber-400 py-3 text-sm font-bold text-black disabled:opacity-50"
//               >
//                 {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate QR code"}
//               </button>
//             </>
//           ) : (
//             <>
//               <div className="rounded-2xl bg-white p-4">
//                 <QRCodeSVG value={qrUrl} size={220} />
//               </div>
//               <p className="text-xs text-neutral-500">Expires in 15 minutes</p>
//               <button type="button" onClick={() => setQrUrl(null)} className="text-xs text-neutral-400 underline">
//                 Generate a new one
//               </button>
//             </>
//           )}
//         </div>
//       )}
//
//       {mode === "send" && (
//         <div className="flex flex-col items-center gap-4 px-6 py-8">
//           <ScanLine className="h-10 w-10 text-amber-400" />
//           <p className="text-center text-sm text-neutral-400">
//             Scan someone&apos;s credits QR code to send them credits.
//           </p>
//           <button
//             type="button"
//             onClick={() => setScannerOpen(true)}
//             className="flex w-full items-center justify-center gap-2 rounded-full bg-amber-400 py-3 text-sm font-bold text-black"
//           >
//             <ScanLine className="h-4 w-4" /> Open scanner
//           </button>
//         </div>
//       )}
//
//       <div className="mx-4 mt-2 rounded-2xl border border-neutral-800 p-4">
//         <button
//           type="button"
//           onClick={() => setTopUpOpen(true)}
//           className="flex w-full items-center justify-center gap-2 rounded-full border border-neutral-700 py-2.5 text-sm font-semibold text-white"
//         >
//           <Coins className="h-4 w-4 text-amber-400" /> Add credits via UPI / Card
//         </button>
//       </div>
//
//       <QrScannerModal open={scannerOpen} onClose={() => setScannerOpen(false)} />
//       <AddCreditsModal open={topUpOpen} onClose={() => setTopUpOpen(false)} />
//     </main>
//   );
// }

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  ChevronDown,
  CreditCard,
  Gift,
  Loader2,
  Megaphone,
  Plus,
  RefreshCw,
  Zap,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { cn } from "@/lib/utils";
import { formatPaise } from "@/lib/money";
import { QrScannerModal } from "@/components/qr-scanner-modal";
import { AddCreditsModal } from "@/components/add-credits-modal";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";

type Kind = "SLOT" | "POST_FEE" | "BOOST" | "FEATURED" | "SENT" | "RECEIVED" | "TOP_UP" | "GRANT" | "OTHER";

interface Person {
  id: string;
  name: string;
  avatarUrl: string | null;
  companyName: string | null;
}

interface HistoryEntry {
  id: string;
  kind: Kind;
  createdAt: string;
  credits: number;
  rupeesPaise: number | null;
  refunded: boolean;
  person: Person | null;
  demand: {
    id: string;
    summary: string;
    imageUrl: string | null;
    categoryName: string | null;
    subCategoryName: string | null;
    maxSlots: number;
    status: string;
    timelineEnd: string;
    budgetMin: number | null;
    budgetMax: number | null;
    author: Person;
  } | null;
  slot: { number: number | null; pitch: string | null } | null;
}

interface History {
  profile: { id: string; name: string; avatarUrl: string | null; creditBalance: number };
  entries: HistoryEntry[];
}

interface MonthGroup {
  key: string;
  label: string;
  entries: HistoryEntry[];
  spent: number;
  received: number;
  paidPaise: number;
  dailySpend: number[];
}

const KIND_LABEL: Record<Kind, string> = {
  SLOT: "Response spot",
  POST_FEE: "Posting fee",
  BOOST: "Featured boost",
  FEATURED: "Featured placement",
  SENT: "Credits sent",
  RECEIVED: "Credits received",
  TOP_UP: "Credits top-up",
  GRANT: "Welcome credits",
  OTHER: "Credit adjustment",
};

function entryTitle(e: HistoryEntry): string {
  if (e.kind === "SENT") return e.person ? `Sent to ${e.person.name}` : "Credits sent";
  if (e.kind === "RECEIVED") return e.person ? `From ${e.person.name}` : "Credits received";
  if (e.kind === "SLOT") return e.slot?.number ? `Response spot #${e.slot.number}` : "Response spot";
  return KIND_LABEL[e.kind];
}

function entrySubtitle(e: HistoryEntry): string {
  const date = new Date(e.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  if (e.demand) return `${date} · ${e.demand.summary}`;
  if (e.kind === "TOP_UP") return `${date} · Razorpay`;
  return date;
}

function entryAmount(e: HistoryEntry): string {
  if (e.rupeesPaise != null) return `${e.refunded ? "Withdrawn " : ""}${formatPaise(e.rupeesPaise)}`;
  return `${e.credits > 0 ? "+" : "−"}${Math.abs(e.credits).toLocaleString("en-IN")}`;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

function groupByMonth(entries: HistoryEntry[]): MonthGroup[] {
  const groups = new Map<string, MonthGroup>();
  for (const e of entries) {
    const d = new Date(e.createdAt);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    let g = groups.get(key);
    if (!g) {
      const days = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      g = {
        key,
        label: d.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
        entries: [],
        spent: 0,
        received: 0,
        paidPaise: 0,
        dailySpend: Array(days).fill(0),
      };
      groups.set(key, g);
    }
    g.entries.push(e);
    if (e.credits < 0) {
      g.spent += -e.credits;
      g.dailySpend[d.getDate() - 1] = (g.dailySpend[d.getDate() - 1] ?? 0) - e.credits;
    } else {
      g.received += e.credits;
    }
    if (e.rupeesPaise != null && !e.refunded) g.paidPaise += e.rupeesPaise;
  }
  return [...groups.values()];
}

/** Image slot from the design: the demand's photo, the person's avatar, or a kind icon. */
function EntryImage({ entry, size = 44 }: { entry: HistoryEntry; size?: number }) {
  const src = entry.demand?.imageUrl ?? entry.person?.avatarUrl ?? null;
  const fallbackName = entry.demand?.categoryName ?? entry.person?.name;
  const Icon =
    entry.kind === "TOP_UP" ? CreditCard
    : entry.kind === "GRANT" ? Gift
    : entry.kind === "BOOST" || entry.kind === "FEATURED" ? Zap
    : entry.kind === "POST_FEE" ? Megaphone
    : entry.kind === "RECEIVED" ? ArrowDownLeft
    : ArrowUpRight;

  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-900 text-sm font-bold text-white"
      style={{ width: size, height: size }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : fallbackName && entry.kind !== "TOP_UP" && entry.kind !== "GRANT" ? (
        initials(fallbackName)
      ) : (
        <Icon className="h-5 w-5" />
      )}
    </span>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  const w = 100;
  const h = 28;
  const step = values.length > 1 ? w / (values.length - 1) : w;
  const points = values.map((v, i) => `${(i * step).toFixed(1)},${(h - (v / max) * h).toFixed(1)}`);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-7 w-full" aria-hidden>
      <polygon points={`0,${h} ${points.join(" ")} ${w},${h}`} fill="rgba(255,255,255,0.12)" />
      <polyline points={points.join(" ")} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1" />
    </svg>
  );
}

export default function SendCreditsPage() {
  const [history, setHistory] = useState<History | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [hideBalance, setHideBalance] = useState(false);
  const [viewAll, setViewAll] = useState(false);
  const [selected, setSelected] = useState<HistoryEntry | null>(null);

  // Existing receive / send / top-up flows, unchanged.
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [generating, setGenerating] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [topUpOpen, setTopUpOpen] = useState(false);

  const loadHistory = useCallback(async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/credits/history");
      if (res.ok) setHistory(await res.json());
      else toast.error("Could not load your credit history.");
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const amt = amount.trim() ? parseInt(amount, 10) : undefined;
      const res = await fetch("/api/credits/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amt }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error?.message ?? "Could not generate a QR code.");
        return;
      }
      setQrUrl(`${window.location.origin}${data.url}`);
    } finally {
      setGenerating(false);
    }
  }

  const months = useMemo(() => groupByMonth(history?.entries ?? []), [history]);
  const visibleMonths = viewAll ? months : months.slice(0, 1);
  const balance = history?.profile.creditBalance ?? 0;

  return (
    <main className="min-h-dvh bg-white pt-3 pb-28 text-black">
      {/* ── Balance card ── */}
      <section className="mx-3 rounded-[40px] bg-gradient-to-b from-[#2b2b2b] via-[#141414] to-black px-5 pb-6 pt-5 text-white">
        <div className="flex items-center justify-between">
          <Link
            href="/profile"
            className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-[#e9e2d0] text-sm font-bold text-black"
          >
            {history?.profile.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={history.profile.avatarUrl} alt={history.profile.name} className="h-full w-full object-cover" />
            ) : history ? (
              initials(history.profile.name)
            ) : null}
          </Link>
          <Link
            href="/chats"
            aria-label="Messages"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/5"
          >
            <Bell className="h-5 w-5" />
          </Link>
        </div>

        <div className="mt-10 flex flex-col items-center">
          <button
            type="button"
            onClick={() => setHideBalance((h) => !h)}
            className="flex items-center gap-1 text-lg font-medium"
          >
            Credits Wallet <ChevronDown className={cn("h-4 w-4 transition-transform", hideBalance && "rotate-180")} />
          </button>
          <p className="mt-1 bg-gradient-to-r from-white via-white to-neutral-500 bg-clip-text text-[56px] font-semibold leading-tight tracking-tight text-transparent">
            {history ? (hideBalance ? "••••" : balance.toLocaleString("en-IN")) : "—"}
          </p>
          <p className="flex items-center gap-2 text-lg text-neutral-200">
            {hideBalance ? "••••" : `₹${balance.toLocaleString("en-IN")} INR`}
            <button type="button" aria-label="Refresh" onClick={() => void loadHistory()} disabled={syncing}>
              <RefreshCw className={cn("h-4 w-4 text-neutral-500", syncing && "animate-spin")} />
            </button>
          </p>
        </div>

        <div className="mt-20 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => setReceiveOpen(true)}
            className="flex h-12 w-28 items-center justify-center gap-2 rounded-full border border-white/15 bg-gradient-to-b from-[#1f1f1f] to-black text-[13px] font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
          >
            <ArrowDownLeft className="h-4 w-4" /> Receive
          </button>
          <button
            type="button"
            aria-label="Add credits"
            onClick={() => setTopUpOpen(true)}
            className="flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-gradient-to-b from-[#2a2a2a] to-black shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
          >
            <Plus className="h-8 w-8" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            className="flex h-12 w-28 items-center justify-center gap-2 rounded-full border border-white/15 bg-gradient-to-b from-[#1f1f1f] to-black text-[13px] font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
          >
            <ArrowUpRight className="h-4 w-4" /> Send
          </button>
        </div>

        <div className="mt-14 flex justify-center">
          <span className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[13px]">
            <span className={cn("h-1.5 w-1.5 rounded-full", syncing ? "bg-amber-400" : "bg-mint")} />
            {syncing ? "Syncing…" : "Synchronized"}
          </span>
        </div>

        <div className="mt-4 flex justify-center">
          <Link href="/credits/refunds" className="text-[13px] text-neutral-400 underline underline-offset-4">
            Top-ups & withdrawals
          </Link>
        </div>
      </section>

      {/* ── History ── */}
      <section className="px-3 pt-6">
        <div className="mb-3 flex items-center justify-between px-1">
          <h2 className="text-lg font-medium">History</h2>
          {months.length > 1 && (
            <button
              type="button"
              onClick={() => setViewAll((v) => !v)}
              className="flex items-center gap-1 text-[15px] text-neutral-500"
            >
              {viewAll ? "Show less" : "View all"}
              <ChevronDown className={cn("h-4 w-4 transition-transform", viewAll && "rotate-180")} />
            </button>
          )}
        </div>

        {!history ? (
          <div className="flex justify-center py-10 text-neutral-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : months.length === 0 ? (
          <p className="py-10 text-center text-sm text-neutral-500">No credit activity yet.</p>
        ) : (
          <div className="space-y-6">
            {visibleMonths.map((m) => (
              <div key={m.key} className="space-y-3">
                {/* Month summary -- the dark "swiped" row in the design */}
                <div className="flex overflow-hidden rounded-xl bg-[#f1f1f1]">
                  <div className="flex w-[104px] shrink-0 flex-col justify-end bg-gradient-to-b from-[#1c1c1c] to-black px-3 pb-2.5 pt-1 text-white">
                    <Sparkline values={m.dailySpend} />
                    <p className="mt-1 text-lg font-medium leading-tight">−{m.spent.toLocaleString("en-IN")}</p>
                    <p className="text-xs text-neutral-400">credits spent</p>
                  </div>
                  <div className="flex flex-1 items-center justify-between gap-2 px-4 py-4">
                    <div className="min-w-0">
                      <p className="truncate text-lg">{m.label}</p>
                      <p className="text-xs text-neutral-500">
                        {m.entries.length} {m.entries.length === 1 ? "transaction" : "transactions"}
                        {m.paidPaise > 0 && ` · ${formatPaise(m.paidPaise)} paid`}
                      </p>
                    </div>
                    <p className="shrink-0 text-lg">+{m.received.toLocaleString("en-IN")}</p>
                  </div>
                </div>

                {m.entries.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => setSelected(e)}
                    className="flex w-full items-center gap-3 rounded-xl bg-[#f1f1f1] px-4 py-4 text-left"
                  >
                    <EntryImage entry={e} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-lg leading-tight">{entryTitle(e)}</p>
                      <p className="truncate text-xs text-neutral-500">{entrySubtitle(e)}</p>
                    </div>
                    <p className="shrink-0 text-lg">{entryAmount(e)}</p>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Entry detail ── */}
      <Drawer open={selected !== null} onOpenChange={(o) => !o && setSelected(null)}>
        <DrawerContent className="mx-auto max-w-md rounded-t-3xl border-neutral-200 bg-white p-5 text-black">
          {selected && <EntryDetail entry={selected} />}
        </DrawerContent>
      </Drawer>

      {/* ── Receive (existing QR request flow) ── */}
      <Drawer
        open={receiveOpen}
        onOpenChange={(o) => {
          if (!o) {
            setReceiveOpen(false);
            setQrUrl(null);
          }
        }}
      >
        <DrawerContent className="mx-auto max-w-md rounded-t-3xl border-neutral-800 bg-[#0a0a0a] p-5 text-white">
          <DrawerTitle className="text-lg font-bold text-white">Receive Credits</DrawerTitle>
          <DrawerDescription className="text-xs text-neutral-400">
            Generate a QR code so someone can send you credits directly.
          </DrawerDescription>
          <div className="flex flex-col items-center gap-4 py-6">
            {!qrUrl ? (
              <>
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
                  placeholder="Amount (leave blank to let them choose)"
                  className="w-full rounded-xl bg-neutral-900 px-3.5 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none"
                />
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generating}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-amber-400 py-3 text-sm font-bold text-black disabled:opacity-50"
                >
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate QR code"}
                </button>
              </>
            ) : (
              <>
                <div className="rounded-2xl bg-white p-4">
                  <QRCodeSVG value={qrUrl} size={220} />
                </div>
                <p className="text-xs text-neutral-500">Expires in 15 minutes</p>
                <button type="button" onClick={() => setQrUrl(null)} className="text-xs text-neutral-400 underline">
                  Generate a new one
                </button>
              </>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      <QrScannerModal open={scannerOpen} onClose={() => setScannerOpen(false)} />
      <AddCreditsModal
        open={topUpOpen}
        onClose={() => setTopUpOpen(false)}
        currentBalance={history?.profile.creditBalance ?? null}
        onSuccess={() => void loadHistory()}
      />
    </main>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 text-sm">
      <span className="shrink-0 text-neutral-500">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

function EntryDetail({ entry }: { entry: HistoryEntry }) {
  const d = entry.demand;
  const budget =
    d && (d.budgetMin || d.budgetMax)
      ? [d.budgetMin, d.budgetMax].filter((v): v is number => v != null).map((v) => `₹${v.toLocaleString("en-IN")}`).join("–")
      : null;

  return (
    <div>
      {d?.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={d.imageUrl} alt="" className="mb-4 h-40 w-full rounded-2xl object-cover" />
      )}
      <div className="flex items-center gap-3">
        <EntryImage entry={entry} size={48} />
        <div className="min-w-0 flex-1">
          <DrawerTitle className="truncate text-lg font-semibold text-black">{entryTitle(entry)}</DrawerTitle>
          <DrawerDescription className="text-xs text-neutral-500">{KIND_LABEL[entry.kind]}</DrawerDescription>
        </div>
        <p className="text-xl font-semibold">{entryAmount(entry)}</p>
      </div>

      <div className="mt-4 divide-y divide-neutral-200">
        <DetailRow label="Date">
          {new Date(entry.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
        </DetailRow>
        <DetailRow label="Paid with">
          {entry.rupeesPaise != null ? "Razorpay" : `${Math.abs(entry.credits).toLocaleString("en-IN")} credits`}
        </DetailRow>
        {entry.person && (
          <DetailRow label={entry.kind === "RECEIVED" ? "From" : entry.kind === "SLOT" ? "Request by" : "To"}>
            <Link href={`/u/${entry.person.id}`} className="font-medium underline-offset-2 hover:underline">
              {entry.person.name}
            </Link>
            {entry.person.companyName && <span className="block text-xs text-neutral-500">{entry.person.companyName}</span>}
          </DetailRow>
        )}
        {entry.slot && (
          <DetailRow label="Spot">
            {entry.slot.number ? `#${entry.slot.number}` : "—"}
            {d && ` of ${d.maxSlots}`}
          </DetailRow>
        )}
        {entry.slot?.pitch && <DetailRow label="Your pitch">{entry.slot.pitch}</DetailRow>}
        {d && (
          <>
            <DetailRow label="Request">{d.summary}</DetailRow>
            {d.categoryName && (
              <DetailRow label="Category">
                {d.categoryName}
                {d.subCategoryName && ` · ${d.subCategoryName}`}
              </DetailRow>
            )}
            {budget && <DetailRow label="Budget">{budget}</DetailRow>}
            <DetailRow label="Status">{d.status.charAt(0) + d.status.slice(1).toLowerCase()}</DetailRow>
          </>
        )}
      </div>

      {d && (
        <Link
          href={`/demands/${d.id}`}
          className="mt-5 flex w-full items-center justify-center rounded-full bg-black py-3 text-sm font-semibold text-white"
        >
          View request
        </Link>
      )}
    </div>
  );
}
