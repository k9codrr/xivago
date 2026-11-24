"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight, GalleryHorizontal, Images,
  IndianRupee, Loader2, ShoppingBag, Wallet, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPaise } from "@/lib/money";

interface Purchase {
  id: string;
  slot: number;
  boughtAt: string;
  amountPaise: number;
  paidWith: "CASH" | "CREDITS";
  demand: { id: string; summary: string; categoryName: string | null; coverUrl: string | null };
}

type Layout = "calendar" | "strip";
type Range = "year" | "month" | "week" | "day";
type PayFilter = "ALL" | "CASH" | "CREDITS";

const RANGES: Range[] = ["year", "month", "week", "day"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PAY_LABEL: Record<PayFilter, string> = { ALL: "All payments", CASH: "Paid by UPI/card", CREDITS: "Paid by credits" };
const NEXT_PAY: Record<PayFilter, PayFilter> = { ALL: "CASH", CASH: "CREDITS", CREDITS: "ALL" };

/** Local-date key, so a purchase lands on the day the user saw it happen. */
function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function startOfWeek(d: Date) {
  return addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -d.getDay());
}

function compactPaise(paise: number) {
  const rupees = paise / 100;
  if (rupees >= 100_000) return `₹${(rupees / 100_000).toFixed(1).replace(/\.0$/, "")}L`;
  if (rupees >= 1_000) return `₹${(rupees / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return formatPaise(paise);
}

const PAY_DOT: Record<Purchase["paidWith"], string> = { CASH: "bg-[#f97316]", CREDITS: "bg-[#3b82f6]" };

export default function SpendsPage() {
  const router = useRouter();
  const [purchases, setPurchases] = useState<Purchase[] | null>(null);
  const [layout, setLayout] = useState<Layout>("calendar");
  const [range, setRange] = useState<Range>("month");
  const [payFilter, setPayFilter] = useState<PayFilter>("ALL");
  const [cursor, setCursor] = useState(() => new Date());

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/my/spends");
      setPurchases(res.ok ? (await res.json()).purchases : []);
    })();
  }, []);

  const visible = useMemo(
    () => (purchases ?? []).filter((p) => payFilter === "ALL" || p.paidWith === payFilter),
    [purchases, payFilter],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, Purchase[]>();
    for (const p of visible) {
      const key = dayKey(new Date(p.boughtAt));
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    return map;
  }, [visible]);

  const totals = useMemo(
    () => ({
      slots: visible.length,
      spentPaise: visible.reduce((sum, p) => sum + p.amountPaise, 0),
      photos: visible.filter((p) => p.demand.coverUrl).length,
    }),
    [visible],
  );

  const backdrop = visible.find((p) => p.demand.coverUrl)?.demand.coverUrl;
  const today = new Date();

  function step(dir: 1 | -1) {
    setCursor((c) => {
      if (range === "year") return new Date(c.getFullYear() + dir, c.getMonth(), 1);
      if (range === "month") return new Date(c.getFullYear(), c.getMonth() + dir, 1);
      return addDays(c, range === "week" ? 7 * dir : dir);
    });
  }

  function openDay(d: Date) {
    setCursor(d);
    setRange("day");
  }

  const title =
    range === "year"
      ? String(cursor.getFullYear())
      : range === "month"
        ? cursor.toLocaleDateString("en-IN", { month: "long", year: "numeric" })
        : range === "week"
          ? `${startOfWeek(cursor).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${addDays(startOfWeek(cursor), 6).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
          : cursor.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "long" });

  return (
    <main className="min-h-dvh bg-black">
      <div className="relative mx-auto min-h-dvh w-full max-w-[430px] overflow-hidden bg-[#050608] pb-16 text-white antialiased">
        {/* Faded backdrop from the latest cover photo */}
        {backdrop && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={backdrop} alt="" aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[420px] w-full object-cover opacity-[0.14] blur-[2px]" />
        )}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[460px] bg-gradient-to-b from-transparent via-[#050608]/70 to-[#050608]" />

        {/* Header */}
        <header className="relative flex items-center px-4 pt-[max(env(safe-area-inset-top),1rem)]">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Close"
            className="grid h-11 w-11 place-items-center rounded-full bg-black/40 ring-1 ring-white/25 backdrop-blur"
          >
            <X className="h-5 w-5" strokeWidth={2.2} />
          </button>
          <h1 className="absolute left-1/2 -translate-x-1/2 text-[17px] font-semibold">Spending</h1>
        </header>

        {/* Summary card */}
        <section className="relative mx-4 mt-5 rounded-[22px] border border-[#2a5378]/50 bg-[#0b1724]/75 p-4 backdrop-blur-md">
          <div className="flex items-start gap-3.5">
            <span className="mt-2 grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full border border-[#2a5378]/70 bg-[#0f2338]">
              <ShoppingBag className="h-6 w-6 text-[#3b82f6]" />
            </span>
            <div className="min-w-0">
              <h2 className="text-[22px] font-bold leading-[1.15] tracking-[-0.01em]">Your spending</h2>
              <p className="mt-1 text-[13px] leading-snug text-white/70">
                A visual way to browse every slot you&apos;ve bought, on the day you bought it.
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <StatTile icon={CalendarDays} value={String(totals.slots)} label="Spots" href="/explore/buy" />
            <StatTile icon={IndianRupee} value={compactPaise(totals.spentPaise)} label="Spent" href="/checkout" />
            <StatTile icon={Images} value={String(totals.photos)} label="Photos" />
          </div>
        </section>

        {/* Calendar / Strip */}
        <div className="relative mx-4 mt-4 grid grid-cols-2 gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
          {(["calendar", "strip"] as const).map((l) => {
            const Icon = l === "calendar" ? CalendarDays : GalleryHorizontal;
            return (
              <button
                key={l}
                type="button"
                onClick={() => setLayout(l)}
                className={cn(
                  "flex h-11 items-center justify-center gap-2 rounded-full text-[15px] font-semibold capitalize transition-colors",
                  layout === l ? "bg-white text-black" : "border border-white/10 text-white",
                )}
              >
                <Icon className="h-4 w-4" /> {l}
              </button>
            );
          })}
        </div>

        {purchases === null ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-white/50" />
          </div>
        ) : layout === "strip" ? (
          <StripView purchases={visible} payFilter={payFilter} onPayFilter={() => setPayFilter(NEXT_PAY[payFilter])} />
        ) : (
          <section className="relative mx-4 mt-4 rounded-[22px] border border-white/10 bg-white/[0.03] p-3">
            {/* Year / Month / Week / Day */}
            <div className="grid grid-cols-4 rounded-full bg-white/[0.07] p-1">
              {RANGES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRange(r)}
                  className={cn(
                    "h-9 rounded-full text-[14px] font-semibold capitalize transition-colors",
                    range === r ? "bg-white text-black" : "text-white/85",
                  )}
                >
                  {r}
                </button>
              ))}
            </div>

            <PayChip filter={payFilter} onClick={() => setPayFilter(NEXT_PAY[payFilter])} />

            {/* Period navigation */}
            <div className="mt-3 flex items-center justify-between">
              <NavButton onClick={() => step(-1)} label="Previous">
                <ChevronLeft className="h-4 w-4" />
              </NavButton>
              <p className="text-[17px] font-semibold">{title}</p>
              <NavButton onClick={() => step(1)} label="Next">
                <ChevronRight className="h-4 w-4" />
              </NavButton>
            </div>

            {range === "year" && (
              <YearGrid
                year={cursor.getFullYear()}
                purchases={visible}
                onPick={(m) => {
                  setCursor(new Date(cursor.getFullYear(), m, 1));
                  setRange("month");
                }}
              />
            )}
            {range === "month" && <MonthGrid cursor={cursor} today={today} byDay={byDay} onPick={openDay} />}
            {range === "week" && <WeekRow cursor={cursor} today={today} byDay={byDay} onPick={openDay} />}
            {range === "day" && <DayList purchases={byDay.get(dayKey(cursor)) ?? []} />}

            <div className="mt-3 flex items-center justify-center gap-4 text-[11px] text-white/50">
              <span className="flex items-center gap-1.5"><span className={cn("h-1.5 w-1.5 rounded-full", PAY_DOT.CASH)} /> UPI/card</span>
              <span className="flex items-center gap-1.5"><span className={cn("h-1.5 w-1.5 rounded-full", PAY_DOT.CREDITS)} /> Credits</span>
            </div>
          </section>
        )}

        {purchases !== null && purchases.length === 0 && (
          <p className="relative mx-4 mt-4 text-center text-[13px] text-white/50">
            No response spots yet. <Link href="/" className="font-semibold text-white">Browse requests</Link> to respond to your first one.
          </p>
        )}
      </div>
    </main>
  );
}

/* ---------- Pieces ---------- */

function StatTile({ icon: Icon, value, label, href }: { icon: typeof CalendarDays; value: string; label: string; href?: string }) {
  const body = (
    <>
      <div className="flex items-center gap-1.5">
        <Icon className="h-4 w-4 shrink-0 text-[#3b82f6]" />
        <span className="truncate text-[22px] font-bold leading-none">{value}</span>
        {href && <ArrowUpRight className="ml-auto h-4 w-4 shrink-0 rounded-full bg-[#1e4d7a] p-[2px] text-[#93c5fd]" />}
      </div>
      <p className="mt-2 text-[12px] text-white/70">{label}</p>
    </>
  );
  const cls = "block rounded-[14px] border border-[#2a5378]/50 bg-[#081320]/80 px-3 py-2.5";
  return href ? <Link href={href} className={cls}>{body}</Link> : <div className={cls}>{body}</div>;
}

function PayChip({ filter, onClick }: { filter: PayFilter; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "mt-3 flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium",
        filter === "ALL" ? "border-white/10 bg-white/[0.06] text-white/85" : "border-[#3b82f6]/50 bg-[#3b82f6]/15 text-white",
      )}
    >
      <Wallet className="h-4 w-4" /> {PAY_LABEL[filter]}
    </button>
  );
}

function NavButton({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.08]">
      {children}
    </button>
  );
}

function Dots({ items }: { items: Purchase[] }) {
  if (items.length === 0) return null;
  return (
    <span className="mt-0.5 flex gap-[3px]">
      {items.slice(0, 3).map((p, i) => (
        <span key={p.id} className={cn("h-[5px] w-[5px] rounded-full", i === 0 ? PAY_DOT[p.paidWith] : "bg-white/45")} />
      ))}
    </span>
  );
}

/** One calendar cell: the day number, payment dots, and the bought demand's cover photo as background. */
function DayCell({
  date, inMonth, isToday, items, onPick, tall,
}: { date: Date; inMonth: boolean; isToday: boolean; items: Purchase[]; onPick: (d: Date) => void; tall?: boolean }) {
  const cover = items.find((p) => p.demand.coverUrl)?.demand.coverUrl;
  return (
    <button
      type="button"
      onClick={() => items.length > 0 && onPick(date)}
      className={cn(
        "relative overflow-hidden rounded-[10px] text-left",
        tall ? "h-[150px]" : "aspect-[0.92]",
        isToday ? "bg-[#0f2a44] ring-2 ring-inset ring-[#1d6fb8]" : inMonth ? "bg-white/[0.07]" : "bg-white/[0.035]",
        items.length === 0 && "cursor-default",
      )}
    >
      {cover && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cover} alt="" className={cn("absolute inset-0 h-full w-full object-cover", !inMonth && "opacity-50")} />
          <span className="absolute inset-0 bg-gradient-to-br from-black/55 via-black/10 to-transparent" />
        </>
      )}
      <span className="relative flex flex-col items-start px-1.5 pt-1">
        <span className={cn("text-[14px] font-semibold leading-tight", inMonth ? "text-white" : "text-white/35")}>{date.getDate()}</span>
        <Dots items={items} />
      </span>
      {tall && items.length > 0 && (
        <span className="absolute inset-x-1 bottom-1 truncate rounded-md bg-black/55 px-1 py-0.5 text-[10px] font-semibold">
          {compactPaise(items.reduce((s, p) => s + p.amountPaise, 0))}
        </span>
      )}
    </button>
  );
}

function MonthGrid({ cursor, today, byDay, onPick }: { cursor: Date; today: Date; byDay: Map<string, Purchase[]>; onPick: (d: Date) => void }) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const gridStart = startOfWeek(first);
  const lastOfMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const weeks = Math.ceil((first.getDay() + lastOfMonth.getDate()) / 7);
  const days = Array.from({ length: weeks * 7 }, (_, i) => addDays(gridStart, i));

  return (
    <>
      <div className="mt-3 grid grid-cols-7 gap-1.5 text-center text-[12px] text-white/60">
        {WEEKDAYS.map((d) => <span key={d}>{d}</span>)}
      </div>
      <div className="mt-1.5 grid grid-cols-7 gap-1.5">
        {days.map((d) => (
          <DayCell
            key={d.toISOString()}
            date={d}
            inMonth={d.getMonth() === cursor.getMonth()}
            isToday={dayKey(d) === dayKey(today)}
            items={byDay.get(dayKey(d)) ?? []}
            onPick={onPick}
          />
        ))}
      </div>
    </>
  );
}

function WeekRow({ cursor, today, byDay, onPick }: { cursor: Date; today: Date; byDay: Map<string, Purchase[]>; onPick: (d: Date) => void }) {
  const start = startOfWeek(cursor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return (
    <>
      <div className="mt-3 grid grid-cols-7 gap-1.5 text-center text-[12px] text-white/60">
        {WEEKDAYS.map((d) => <span key={d}>{d}</span>)}
      </div>
      <div className="mt-1.5 grid grid-cols-7 gap-1.5">
        {days.map((d) => (
          <DayCell key={d.toISOString()} date={d} inMonth isToday={dayKey(d) === dayKey(today)} items={byDay.get(dayKey(d)) ?? []} onPick={onPick} tall />
        ))}
      </div>
    </>
  );
}

function YearGrid({ year, purchases, onPick }: { year: number; purchases: Purchase[]; onPick: (month: number) => void }) {
  const months = Array.from({ length: 12 }, (_, m) => {
    const items = purchases.filter((p) => {
      const d = new Date(p.boughtAt);
      return d.getFullYear() === year && d.getMonth() === m;
    });
    return { m, items, cover: items.find((p) => p.demand.coverUrl)?.demand.coverUrl };
  });
  return (
    <div className="mt-3 grid grid-cols-3 gap-2">
      {months.map(({ m, items, cover }) => (
        <button key={m} type="button" onClick={() => onPick(m)} className="relative h-[92px] overflow-hidden rounded-[12px] bg-white/[0.07] text-left">
          {cover && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
              <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/30" />
            </>
          )}
          <span className="relative flex h-full flex-col justify-between p-2">
            <span className="text-[14px] font-semibold">{new Date(year, m, 1).toLocaleDateString("en-IN", { month: "short" })}</span>
            <span className="text-[11px] text-white/75">
              {items.length ? `${items.length} spot${items.length > 1 ? "s" : ""} · ${compactPaise(items.reduce((s, p) => s + p.amountPaise, 0))}` : "—"}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

function DayList({ purchases }: { purchases: Purchase[] }) {
  if (purchases.length === 0) {
    return <p className="py-10 text-center text-[13px] text-white/50">No response spots on this day.</p>;
  }
  return (
    <ul className="mt-3 space-y-2.5">
      {purchases.map((p) => <PurchaseRow key={p.id} p={p} />)}
    </ul>
  );
}

function PurchaseRow({ p }: { p: Purchase }) {
  return (
    <li>
      <Link href={`/demands/${p.demand.id}`} className="flex items-center gap-3 rounded-[14px] bg-white/[0.06] p-2.5 ring-1 ring-inset ring-white/10">
        <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[10px] bg-white/[0.08]">
          {p.demand.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.demand.coverUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <ShoppingBag className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-white/40" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 text-[14px] font-medium leading-snug">{p.demand.summary}</span>
          <span className="mt-1 flex items-center gap-1.5 text-[12px] text-white/55">
            <span className={cn("h-1.5 w-1.5 rounded-full", PAY_DOT[p.paidWith])} />
            Slot {p.slot} · {new Date(p.boughtAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
          </span>
        </span>
        <span className="shrink-0 text-[14px] font-bold">{formatPaise(p.amountPaise)}</span>
      </Link>
    </li>
  );
}

/** Film-strip layout: one horizontal row of cover cards per month, newest first. */
function StripView({ purchases, payFilter, onPayFilter }: { purchases: Purchase[]; payFilter: PayFilter; onPayFilter: () => void }) {
  const groups = useMemo(() => {
    const map = new Map<string, { label: string; items: Purchase[] }>();
    for (const p of purchases) {
      const d = new Date(p.boughtAt);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const group = map.get(key) ?? { label: d.toLocaleDateString("en-IN", { month: "long", year: "numeric" }), items: [] };
      group.items.push(p);
      map.set(key, group);
    }
    return [...map.values()];
  }, [purchases]);

  return (
    <section className="relative mt-4">
      <div className="px-4">
        <PayChip filter={payFilter} onClick={onPayFilter} />
      </div>
      {groups.map((g) => (
        <div key={g.label} className="mt-5">
          <div className="flex items-baseline justify-between px-4">
            <h3 className="text-[16px] font-semibold">{g.label}</h3>
            <span className="text-[12px] text-white/55">
              {g.items.length} slot{g.items.length > 1 ? "s" : ""} · {compactPaise(g.items.reduce((s, p) => s + p.amountPaise, 0))}
            </span>
          </div>
          <div className="no-scrollbar mt-2.5 flex snap-x gap-2.5 overflow-x-auto px-4">
            {g.items.map((p) => (
              <Link
                key={p.id}
                href={`/demands/${p.demand.id}`}
                className="relative h-[190px] w-[142px] shrink-0 snap-start overflow-hidden rounded-[14px] bg-white/[0.07] ring-1 ring-inset ring-white/10"
              >
                {p.demand.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.demand.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <ShoppingBag className="absolute left-1/2 top-[38%] h-8 w-8 -translate-x-1/2 text-white/30" />
                )}
                <span className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/40" />
                <span className="absolute left-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-[11px] font-semibold backdrop-blur">
                  {new Date(p.boughtAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </span>
                <span className="absolute inset-x-2 bottom-2">
                  <span className="line-clamp-2 text-[12.5px] font-medium leading-snug">{p.demand.summary}</span>
                  <span className="mt-1 flex items-center gap-1.5 text-[12px] font-bold">
                    <span className={cn("h-1.5 w-1.5 rounded-full", PAY_DOT[p.paidWith])} />
                    {formatPaise(p.amountPaise)}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
