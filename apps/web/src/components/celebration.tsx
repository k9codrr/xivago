"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from "motion/react";
import { Coins, Lock, LockOpen, QrCode, Send, Sparkles } from "lucide-react";
import { playSound, type SoundName } from "@/lib/sounds";
import { haptic } from "@/lib/haptics";

/**
 * Full-screen success moments (FamPay / Paytm / GPay style). Fire one from
 * anywhere with `await celebrate({...})` -- the promise resolves once the
 * animation has finished (or the user tapped to skip), so the caller can
 * then show the next screen.
 *
 * Sequence: a short intro that fits the action (paper plane takes off, coins
 * drop, lock opens, QR frame locks on) → a springy success disc with ripple
 * rings and a self-drawing tick → confetti burst → title / amount count-up
 * → auto dismiss. Paired with a matching sound and haptic.
 */

export type CelebrationKind = "posted" | "credits" | "payment" | "unlock" | "scan" | "sent" | "generic";

export interface CelebrateOptions {
  kind: CelebrationKind;
  title: string;
  subtitle?: string;
  /** Count-up number shown big (e.g. credits added). */
  amount?: number;
  amountPrefix?: string;
  amountSuffix?: string;
  /** Total on-screen time in ms (default 2600). */
  duration?: number;
}

type Request = CelebrateOptions & { id: number; resolve: () => void };

const EVENT = "xivago:celebrate";
let seq = 0;

export function celebrate(opts: CelebrateOptions): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  return new Promise((resolve) => {
    window.dispatchEvent(new CustomEvent<Request>(EVENT, { detail: { ...opts, id: ++seq, resolve } }));
  });
}

const THEME: Record<CelebrationKind, { from: string; to: string; glow: string; sound: SoundName }> = {
  posted: { from: "#22c55e", to: "#16a34a", glow: "rgba(34,197,94,0.55)", sound: "success" },
  sent: { from: "#0ea5e9", to: "#2563eb", glow: "rgba(14,165,233,0.55)", sound: "success" },
  credits: { from: "#f59e0b", to: "#ea580c", glow: "rgba(245,158,11,0.6)", sound: "coins" },
  payment: { from: "#8b5cf6", to: "#6d28d9", glow: "rgba(139,92,246,0.55)", sound: "success" },
  unlock: { from: "#10b981", to: "#059669", glow: "rgba(16,185,129,0.55)", sound: "unlock" },
  scan: { from: "#06b6d4", to: "#0891b2", glow: "rgba(6,182,212,0.55)", sound: "scan" },
  generic: { from: "#22c55e", to: "#16a34a", glow: "rgba(34,197,94,0.55)", sound: "success" },
};

const CONFETTI_COLORS = ["#f43f5e", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#14b8a6", "#facc15", "#fff"];

export function CelebrationHost() {
  const [queue, setQueue] = useState<Request[]>([]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onEvent = (e: Event) => {
      const detail = (e as CustomEvent<Request>).detail;
      setQueue((q) => [...q, detail]);
    };
    window.addEventListener(EVENT, onEvent);
    return () => window.removeEventListener(EVENT, onEvent);
  }, []);

  const current = queue[0] ?? null;
  if (!mounted) return null;

  return <>{createPortal(
    <AnimatePresence
      onExitComplete={() => {
        // nothing: each request resolves itself when it finishes
      }}
    >
      {current && (
        <CelebrationScreen
          key={current.id}
          req={current}
          onDone={() => {
            current.resolve();
            setQueue((q) => q.slice(1));
          }}
        />
      )}
    </AnimatePresence>,
    document.body,
  )}</>;
}

function CelebrationScreen({ req, onDone }: { req: Request; onDone: () => void }) {
  const theme = THEME[req.kind];
  const duration = req.duration ?? 2600;
  const [stage, setStage] = useState<"intro" | "success">("intro");
  const doneRef = useRef(false);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  };

  useEffect(() => {
    const introMs = req.kind === "generic" ? 0 : 650;
    const t1 = setTimeout(() => {
      setStage("success");
      playSound(theme.sound);
      void haptic("success");
    }, introMs);
    const t2 = setTimeout(finish, duration);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const confetti = useMemo(
    () =>
      Array.from({ length: 44 }, (_, i) => {
        const angle = (i / 44) * Math.PI * 2 + Math.random() * 0.3;
        const dist = 120 + Math.random() * 170;
        return {
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist - 40,
          fall: 160 + Math.random() * 220,
          rot: Math.random() * 720 - 360,
          color: CONFETTI_COLORS[i % CONFETTI_COLORS.length]!,
          w: 5 + Math.random() * 6,
          h: 8 + Math.random() * 10,
          round: Math.random() > 0.6,
          delay: Math.random() * 0.12,
        };
      }),
    [],
  );

  return (
    <motion.div
      role="status"
      aria-live="polite"
      onClick={finish}
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.3 } }}
      transition={{ duration: 0.2 }}
    >
      {/* Backdrop with a colored bloom that swells on success */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" />
      <motion.div
        aria-hidden
        className="absolute left-1/2 top-[42%] h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[90px]"
        style={{ background: theme.glow }}
        initial={{ scale: 0.2, opacity: 0 }}
        animate={stage === "success" ? { scale: 1, opacity: 0.9 } : { scale: 0.4, opacity: 0.35 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      />

      <div className="relative flex h-[220px] w-[220px] items-center justify-center">
        <AnimatePresence mode="wait">
          {stage === "intro" ? (
            <Intro key="intro" kind={req.kind} color={theme.from} />
          ) : (
            <motion.div key="success" className="relative flex items-center justify-center">
              {/* Ripple rings */}
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  aria-hidden
                  className="absolute h-[132px] w-[132px] rounded-full border-2"
                  style={{ borderColor: theme.from }}
                  initial={{ scale: 0.8, opacity: 0.8 }}
                  animate={{ scale: 2.3, opacity: 0 }}
                  transition={{ duration: 1.4, delay: 0.1 + i * 0.25, ease: "easeOut", repeat: 1, repeatDelay: 0.2 }}
                />
              ))}

              {/* Confetti */}
              {confetti.map((c, i) => (
                <motion.span
                  key={i}
                  aria-hidden
                  className="absolute"
                  style={{
                    width: c.w,
                    height: c.round ? c.w : c.h,
                    borderRadius: c.round ? 999 : 2,
                    background: c.color,
                  }}
                  initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.4 }}
                  animate={{
                    x: [0, c.x, c.x * 1.1],
                    y: [0, c.y, c.y + c.fall],
                    rotate: c.rot,
                    opacity: [1, 1, 0],
                    scale: [0.4, 1, 0.9],
                  }}
                  transition={{ duration: 1.6, delay: 0.12 + c.delay, ease: [0.2, 0.7, 0.4, 1], times: [0, 0.35, 1] }}
                />
              ))}

              {/* Success disc */}
              <motion.div
                className="relative flex h-[132px] w-[132px] items-center justify-center rounded-full"
                style={{
                  background: `radial-gradient(circle at 30% 25%, ${theme.from}, ${theme.to})`,
                  boxShadow: `0 20px 60px ${theme.glow}, inset 0 2px 0 rgba(255,255,255,0.35)`,
                }}
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: [0, 1.18, 0.94, 1], rotate: 0 }}
                transition={{ duration: 0.7, times: [0, 0.5, 0.75, 1], ease: "easeOut" }}
              >
                <svg viewBox="0 0 52 52" className="h-[70px] w-[70px]" fill="none">
                  <motion.path
                    d="M14 27.5 L22.5 36 L39 17"
                    stroke="white"
                    strokeWidth={5.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.45, delay: 0.35, ease: [0.65, 0, 0.35, 1] }}
                  />
                </svg>
                {/* Sparkle glints */}
                {[
                  { x: 62, y: -58, d: 0.55 },
                  { x: -66, y: -40, d: 0.7 },
                  { x: 58, y: 54, d: 0.85 },
                ].map((s, i) => (
                  <motion.span
                    key={i}
                    aria-hidden
                    className="absolute text-white"
                    style={{ x: s.x, y: s.y }}
                    initial={{ scale: 0, opacity: 0, rotate: 0 }}
                    animate={{ scale: [0, 1.2, 0], opacity: [0, 1, 0], rotate: 90 }}
                    transition={{ duration: 0.9, delay: s.d }}
                  >
                    <Sparkles className="h-5 w-5" />
                  </motion.span>
                ))}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Copy */}
      <div className="relative mt-4 flex min-h-[120px] flex-col items-center px-8 text-center">
        <AnimatePresence>
          {stage === "success" && (
            <>
              {req.amount != null && (
                <motion.div
                  className="text-[44px] font-extrabold tracking-tight text-white tabular-nums"
                  initial={{ y: 24, opacity: 0, scale: 0.9 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 380, damping: 26, delay: 0.3 }}
                >
                  {req.amountPrefix}
                  <CountUp to={req.amount} />
                  {req.amountSuffix}
                </motion.div>
              )}
              <motion.p
                className="text-[22px] font-bold text-white"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.42 }}
              >
                {req.title}
              </motion.p>
              {req.subtitle && (
                <motion.p
                  className="mt-1.5 max-w-xs text-[14px] leading-5 text-white/65"
                  initial={{ y: 16, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 380, damping: 30, delay: 0.52 }}
                >
                  {req.subtitle}
                </motion.p>
              )}
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Progress bar to the next screen */}
      <motion.div
        aria-hidden
        className="absolute bottom-[max(env(safe-area-inset-bottom),24px)] h-1 w-24 overflow-hidden rounded-full bg-white/15"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        <motion.span
          className="block h-full rounded-full bg-white/70"
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration: duration / 1000, ease: "linear" }}
        />
      </motion.div>
    </motion.div>
  );
}

function CountUp({ to }: { to: number }) {
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => Math.round(v).toLocaleString("en-IN"));
  useEffect(() => {
    const c = animate(mv, to, { duration: 1.1, delay: 0.35, ease: [0.16, 1, 0.3, 1] });
    return () => c.stop();
  }, [mv, to]);
  return <motion.span>{text}</motion.span>;
}

/** The ~0.6s lead-in that says what just happened. */
function Intro({ kind, color }: { kind: CelebrationKind; color: string }) {
  const exit = { scale: 0.3, opacity: 0, transition: { duration: 0.18 } };

  if (kind === "posted" || kind === "sent") {
    return (
      <motion.div className="relative" exit={exit}>
        {/* Trail */}
        {[0, 1, 2, 3].map((i) => (
          <motion.span
            key={i}
            aria-hidden
            className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full"
            style={{ background: color }}
            initial={{ x: -90, y: 80, opacity: 0 }}
            animate={{ x: [-90, -20 - i * 12], y: [80, 20 + i * 12], opacity: [0, 0.8, 0] }}
            transition={{ duration: 0.55, delay: 0.05 * i }}
          />
        ))}
        <motion.div
          initial={{ x: -110, y: 110, rotate: -20, scale: 0.6, opacity: 0 }}
          animate={{ x: [-110, 0, 6], y: [110, 0, -8], rotate: [-20, 0, 8], scale: [0.6, 1.1, 1], opacity: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="flex h-24 w-24 items-center justify-center rounded-[28px] bg-white/10 ring-1 ring-white/20 backdrop-blur"
        >
          <Send className="h-11 w-11 text-white" style={{ filter: `drop-shadow(0 0 18px ${color})` }} />
        </motion.div>
      </motion.div>
    );
  }

  if (kind === "credits") {
    return (
      <motion.div className="relative flex h-28 w-28 items-end justify-center" exit={exit}>
        {[0, 1, 2, 3, 4].map((i) => (
          <motion.span
            key={i}
            className="absolute flex h-14 w-14 items-center justify-center rounded-full text-amber-900 shadow-lg"
            style={{ background: "radial-gradient(circle at 35% 30%, #fde68a, #f59e0b 60%, #b45309)", bottom: i * 9 }}
            initial={{ y: -220, opacity: 0, rotateX: 70 }}
            animate={{ y: 0, opacity: 1, rotateX: 0 }}
            transition={{ type: "spring", stiffness: 520, damping: 22, delay: i * 0.08 }}
          >
            <Coins className="h-6 w-6" />
          </motion.span>
        ))}
      </motion.div>
    );
  }

  if (kind === "unlock" || kind === "payment") {
    return (
      <motion.div
        className="flex h-24 w-24 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={exit}
        transition={{ type: "spring", stiffness: 420, damping: 24 }}
      >
        <motion.div initial={{ rotate: 0 }} animate={{ rotate: [0, -12, 10, 0] }} transition={{ duration: 0.5, delay: 0.1 }}>
          <AnimatePresence mode="wait" initial={false}>
            <LockSwap color={color} />
          </AnimatePresence>
        </motion.div>
      </motion.div>
    );
  }

  if (kind === "scan") {
    return (
      <motion.div className="relative flex h-40 w-40 items-center justify-center" exit={exit}>
        {[
          "left-0 top-0 border-l-4 border-t-4 rounded-tl-2xl",
          "right-0 top-0 border-r-4 border-t-4 rounded-tr-2xl",
          "left-0 bottom-0 border-l-4 border-b-4 rounded-bl-2xl",
          "right-0 bottom-0 border-r-4 border-b-4 rounded-br-2xl",
        ].map((cls, i) => (
          <motion.span
            key={i}
            className={`absolute h-10 w-10 ${cls}`}
            style={{ borderColor: color }}
            initial={{ scale: 1.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 24, delay: i * 0.04 }}
          />
        ))}
        <motion.span
          aria-hidden
          className="absolute inset-x-3 h-0.5 rounded-full"
          style={{ background: color, boxShadow: `0 0 16px ${color}` }}
          initial={{ top: "12%" }}
          animate={{ top: ["12%", "88%", "50%"] }}
          transition={{ duration: 0.6 }}
        />
        <QrCode className="h-16 w-16 text-white/80" />
      </motion.div>
    );
  }

  return null;
}

function LockSwap({ color }: { color: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setOpen(true), 320);
    return () => clearTimeout(t);
  }, []);
  return open ? (
    <motion.span key="open" initial={{ y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }}>
      <LockOpen className="h-11 w-11" style={{ color }} />
    </motion.span>
  ) : (
    <motion.span key="closed" exit={{ y: -6, opacity: 0 }}>
      <Lock className="h-11 w-11 text-white" />
    </motion.span>
  );
}
