"use client";

import * as React from "react";
import { Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

// --- SVG Icons ---

const CheckCircleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

// --- Helper Components ---

const DashedLine = () => <div className="w-full border-t-2 border-dashed border-border" aria-hidden="true" />;

/** Decorative: drawn from the value so each invoice looks unique, but not a scannable code. */
const Barcode = ({ value }: { value: string }) => {
  const hashCode = (s: string) =>
    s.split("").reduce((a, b) => {
      a = (a << 5) - a + b.charCodeAt(0);
      return a & a;
    }, 0);
  const seed = hashCode(value);
  const random = (s: number) => {
    const x = Math.sin(s) * 10000;
    return x - Math.floor(x);
  };

  const spacing = 1.5;
  const svgWidth = 250;
  const svgHeight = 70;
  const widths = Array.from({ length: 60 }, (_, index) => (random(seed + index) > 0.7 ? 2.5 : 1.5));
  const totalWidth = widths.reduce((acc, width) => acc + width + spacing, 0) - spacing;
  let nextX = (svgWidth - totalWidth) / 2;
  const bars = widths.map((width) => {
    const x = nextX;
    nextX += width + spacing;
    return { x, width };
  });

  return (
    <div className="flex flex-col items-center py-2">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        aria-hidden="true"
        className="fill-current text-foreground"
      >
        {bars.map((bar, index) => (
          <rect key={index} x={bar.x} y="10" width={bar.width} height="50" />
        ))}
      </svg>
      <p className="mt-2 text-xs tracking-[0.15em] text-muted-foreground">{value}</p>
    </div>
  );
};

const CONFETTI_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#eab308", "#8b5cf6", "#f97316"];

const ConfettiExplosion = () => {
  // Drawn once: re-rolling on a re-render would make every piece jump.
  const [pieces] = React.useState(() =>
    Array.from({ length: 100 }, (_, i) => ({
      left: `${Math.random() * 100}%`,
      top: `${-20 + Math.random() * 10}%`,
      backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      transform: `rotate(${Math.random() * 360}deg)`,
      animation: `ticket-confetti-fall ${2.5 + Math.random() * 2.5}s ${Math.random() * 2}s linear forwards`,
    })),
  );

  return (
    <>
      <style>
        {`
          @keyframes ticket-confetti-fall {
            0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
            100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
          }
        `}
      </style>
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden motion-reduce:hidden" aria-hidden="true">
        {pieces.map((style, i) => (
          <div key={i} className="absolute h-4 w-2" style={style} />
        ))}
      </div>
    </>
  );
};

// --- Main Ticket Component ---

export interface TicketProps extends React.HTMLAttributes<HTMLDivElement> {
  invoiceNumber: string;
  credits: number;
  date: Date;
  billedTo: string;
  balanceAfter: number;
}

const AnimatedTicket = React.forwardRef<HTMLDivElement, TicketProps>(
  ({ className, invoiceNumber, credits, date, billedTo, balanceAfter, ...props }, ref) => {
    const [showConfetti, setShowConfetti] = React.useState(false);

    React.useEffect(() => {
      const mountTimer = setTimeout(() => setShowConfetti(true), 100);
      const unmountTimer = setTimeout(() => setShowConfetti(false), 6000);
      return () => {
        clearTimeout(mountTimer);
        clearTimeout(unmountTimer);
      };
    }, []);

    const formattedDate = new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Kolkata",
    })
      .format(date)
      .replace(",", " •");

    return (
      <>
        {showConfetti && <ConfettiExplosion />}
        <div
          ref={ref}
          className={cn(
            "relative z-10 w-full max-w-sm rounded-2xl bg-card font-sans text-card-foreground shadow-lg",
            "animate-in fade-in-0 zoom-in-95 duration-500",
            className,
          )}
          {...props}
        >
          {/* Ticket cut-out effect */}
          <div className="absolute -left-4 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full bg-background" />
          <div className="absolute -right-4 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full bg-background" />

          <div className="flex flex-col items-center p-8 text-center">
            <div className="animate-in zoom-in-50 rounded-full bg-emerald-500/10 p-3 delay-300 duration-500">
              <CheckCircleIcon className="animate-in zoom-in-75 h-10 w-10 text-emerald-400 delay-500 duration-500" />
            </div>
            <h1 className="mt-4 text-2xl font-semibold">Thank you!</h1>
            <p className="mt-1 text-muted-foreground">Your payment was successful</p>
          </div>

          <div className="space-y-6 px-8 pb-8">
            <div className="flex items-start justify-between gap-4 text-left">
              <div className="min-w-0">
                <p className="text-xs uppercase text-muted-foreground">Invoice no.</p>
                <p className="whitespace-nowrap font-mono text-xs font-medium leading-7">{invoiceNumber}</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase text-muted-foreground">Amount</p>
                <p className="text-lg font-semibold">{credits.toLocaleString("en-IN")} credits</p>
              </div>
            </div>

            <div>
              <p className="text-xs uppercase text-muted-foreground">Date &amp; Time</p>
              <p className="font-medium">{formattedDate}</p>
            </div>

            <div className="flex items-center space-x-4 rounded-lg bg-muted/50 p-4">
              <Wallet className="h-6 w-6 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="truncate font-semibold">{billedTo}</p>
                <p className="text-sm text-muted-foreground">Wallet balance: {balanceAfter.toLocaleString("en-IN")} credits</p>
              </div>
            </div>

            <DashedLine />

            <Barcode value={invoiceNumber} />
          </div>
        </div>
      </>
    );
  },
);

AnimatedTicket.displayName = "AnimatedTicket";

export { AnimatedTicket };
