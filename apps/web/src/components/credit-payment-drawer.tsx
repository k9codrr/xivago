"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft, Coins, Loader2, Lock, LockOpen, ShieldCheck } from "lucide-react";
import { motion } from "motion/react";
import { ConfettiBurst } from "@/components/confetti-burst";
import { playSound } from "@/lib/sounds";
import { AddCreditsModal } from "@/components/add-credits-modal";
import { AnimatedTicket } from "@/components/ui/animated-ticket";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { isWeakTpin, TPIN_LENGTH, type CreditAuth } from "@/lib/validation/tpin";

export interface PaymentInvoice {
  id: string;
  number: string;
  totalCredits: number;
  balanceAfter: number;
  billedToName: string;
  createdAt: string;
}

interface Status {
  balance: number;
  isSet: boolean;
  lockedUntil: string | null;
  canResetWithOtp: boolean;
}

type Stage =
  | "loading"
  | "confirm"
  | "enter-pin"
  | "forgot"
  | "new-pin"
  | "repeat-pin"
  | "processing"
  | "success";

/** Past this the app stops waiting, so a stalled request can't trap anyone on the processing screen. */
const PAY_TIMEOUT_MS = 30_000;

/** How a forgotten T-PIN was proved, kept until the new one has been chosen. */
type ResetProof = { code: string } | { password: string };

interface CreditPaymentDrawerProps<T extends { invoice: PaymentInvoice | null }> {
  open: boolean;
  /** Called when the user backs out, or the payment was refused for good. */
  onClose: () => void;
  title: string;
  items: { label: string; credits: number }[];
  /** Makes the actual purchase. Must send `auth` in the JSON body. */
  request: (auth: CreditAuth) => Promise<Response>;
  /** The user dismissed the success screen. `toInvoice` means they are leaving for the invoice page. */
  onDone: (data: T, toInvoice: boolean) => void;
}

async function apiPost(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, data, code: data?.error?.code as string | undefined, message: data?.error?.message as string | undefined };
}

/** One input laid over the boxes, so the keyboard, paste and backspace all just work. */
export function PinInput({
  value,
  onChange,
  disabled,
  shake,
  autoFocus = true,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  shake?: boolean;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus && !disabled) ref.current?.focus();
  }, [autoFocus, disabled]);

  return (
    <div className={cn("relative mx-auto w-fit", shake && "animate-pin-shake")}>
      <div className="flex gap-2" aria-hidden>
        {Array.from({ length: TPIN_LENGTH }, (_, i) => (
          <span
            key={i}
            className={cn(
              "flex h-12 w-11 items-center justify-center rounded-xl border bg-neutral-900 text-xl transition-colors",
              i === value.length && !disabled ? "border-amber-400" : "border-neutral-800",
            )}
          >
            {i < value.length && <span className="h-2.5 w-2.5 rounded-full bg-white" />}
          </span>
        ))}
      </div>
      <input
        ref={ref}
        type="password"
        inputMode="numeric"
        autoComplete="off"
        aria-label={`${TPIN_LENGTH}-digit T-PIN`}
        disabled={disabled}
        value={value}
        maxLength={TPIN_LENGTH}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, TPIN_LENGTH))}
        className="absolute inset-0 w-full cursor-pointer bg-transparent text-transparent caret-transparent opacity-0 outline-none"
      />
    </div>
  );
}

export function CreditPaymentDrawer<T extends { invoice: PaymentInvoice | null }>({
  open,
  onClose,
  title,
  items,
  request,
  onDone,
}: CreditPaymentDrawerProps<T>) {
  const router = useRouter();
  const total = items.reduce((sum, item) => sum + item.credits, 0);

  const [stage, setStage] = useState<Stage>("loading");
  const [status, setStatus] = useState<Status | null>(null);
  const [pin, setPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [proof, setProof] = useState<ResetProof | null>(null);
  const [otpSentTo, setOtpSentTo] = useState<string | null>(null);
  const [resetCode, setResetCode] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [paid, setPaid] = useState<T | null>(null);

  const loadStatus = useCallback(async () => {
    const res = await fetch("/api/tpin");
    if (!res.ok) throw new Error("status");
    const next = (await res.json()) as Status;
    setStatus(next);
    return next;
  }, []);

  // Every opening starts clean. Nothing about a T-PIN outlives the drawer.
  useEffect(() => {
    if (!open) return;
    setStage("loading");
    setPin("");
    setNewPin("");
    setError(null);
    setProof(null);
    setOtpSentTo(null);
    setResetCode("");
    setResetPassword("");
    setPaid(null);
    loadStatus()
      .then(() => setStage("confirm"))
      .catch(() => {
        toast.error("Could not start the payment. Please try again.");
        onClose();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset once per opening
  }, [open, loadStatus]);

  const wrongEntry = (message: string) => {
    void haptic("error");
    setError(message);
    setPin("");
    setShake(true);
    setTimeout(() => setShake(false), 400);
  };

  const pay = async (tpin: string) => {
    setStage("processing");
    setError(null);
    playSound("unlock");
    try {
      // Long enough to read as a step even when the server answers instantly.
      const [res] = await Promise.all([
        Promise.race([
          request({ tpin, expectedCredits: total }),
          new Promise<null>((resolve) => setTimeout(resolve, PAY_TIMEOUT_MS, null)),
        ]),
        new Promise((resolve) => setTimeout(resolve, 900)),
      ]);
      if (!res) {
        // It may still go through, so a blind retry could pay twice.
        void haptic("warning");
        toast.error("This is taking too long. Check your invoices before trying again.");
        onClose();
        return;
      }
      const data = await res.json().catch(() => null);

      if (res.ok) {
        void haptic("success");
        playSound(data?.invoice ? "coins" : "success");
        if (!data?.invoice) {
          // No new credits went out after all, e.g. a bid already held elsewhere covered it.
          toast.success("Done. No extra credits were needed.");
          onDone(data as T, false);
          return;
        }
        setPaid(data as T);
        setStage("success");
        return;
      }

      const code: string | undefined = data?.error?.code;
      const message: string = data?.error?.message ?? "Payment failed. Please try again.";
      setStage("enter-pin");
      if (code === "TPIN_INVALID") {
        playSound("error");
        wrongEntry(message);
      } else if (code === "TPIN_LOCKED") {
        wrongEntry(message);
        await loadStatus();
      } else if (code === "INSUFFICIENT_CREDITS") {
        void haptic("warning");
        toast.error(message);
        await loadStatus();
        setPin("");
        setStage("confirm");
      } else {
        // Sold out, price changed, demand closed: nothing left to retry here.
        void haptic("error");
        toast.error(message);
        if (code === "AMOUNT_CHANGED") router.refresh();
        onClose();
      }
    } catch {
      setStage("enter-pin");
      wrongEntry("Network error. Check your connection before trying again.");
    }
  };

  const continueFromConfirm = () => {
    setPin("");
    setError(null);
    setStage(status?.isSet ? "enter-pin" : "new-pin");
  };

  const handlePinEntry = (value: string) => {
    setPin(value);
    if (error) setError(null);
    if (value.length === TPIN_LENGTH) void pay(value);
  };

  const handleNewPin = (value: string) => {
    setPin(value);
    if (error) setError(null);
    if (value.length < TPIN_LENGTH) return;
    if (isWeakTpin(value)) {
      wrongEntry("That T-PIN is too easy to guess. Try another.");
      return;
    }
    setNewPin(value);
    setPin("");
    setStage("repeat-pin");
  };

  const handleRepeatPin = async (value: string) => {
    setPin(value);
    if (error) setError(null);
    if (value.length < TPIN_LENGTH) return;
    if (value !== newPin) {
      wrongEntry("Those didn't match. Choose your T-PIN again.");
      setNewPin("");
      setStage("new-pin");
      return;
    }

    setBusy(true);
    const saved = proof
      ? await apiPost("/api/tpin/reset", { tpin: value, ...proof })
      : await apiPost("/api/tpin", { tpin: value });
    setBusy(false);

    if (saved.ok) {
      setProof(null);
      setStatus((s) => (s ? { ...s, isSet: true, lockedUntil: null } : s));
      void pay(value);
      return;
    }
    setNewPin("");
    if (proof) {
      // A bad code or password only shows up now, so send them back to fix it.
      setProof(null);
      setPin("");
      setError(saved.message ?? "Could not reset your T-PIN.");
      setStage("forgot");
    } else {
      setStage("new-pin");
      wrongEntry(saved.message ?? "Could not save your T-PIN.");
    }
  };

  const sendResetCode = async () => {
    setBusy(true);
    setError(null);
    const sent = await apiPost("/api/tpin/reset/otp");
    setBusy(false);
    if (!sent.ok) {
      setError(sent.message ?? "Could not send the code.");
      return;
    }
    setOtpSentTo(sent.data.maskedPhone);
  };

  const submitProof = () => {
    setProof(status?.canResetWithOtp ? { code: resetCode } : { password: resetPassword });
    setResetCode("");
    setResetPassword("");
    setPin("");
    setError(null);
    setStage("new-pin");
  };

  const finish = (toInvoice: boolean) => {
    if (!paid) return;
    onDone(paid, toInvoice);
    if (toInvoice && paid.invoice) router.push(`/invoices/${paid.invoice.id}`);
  };

  const balance = status?.balance ?? 0;
  const shortBy = total - balance;
  const lockedUntil = status?.lockedUntil && new Date(status.lockedUntil) > new Date() ? new Date(status.lockedUntil) : null;
  const isFullScreen = stage === "success";

  return (
    <>
      <Drawer
        open={open}
        // Can't be swiped away mid-payment, or before the receipt is acknowledged.
        dismissible={stage !== "processing" && stage !== "success"}
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
      >
        <DrawerContent
          // Portalled content still bubbles through the React tree, into any clickable card around it.
          onClick={(e) => e.stopPropagation()}
          className={cn(
            // Opens on top of the post-demand drawer (z-[60]).
            "!z-[70] mx-auto max-w-md border-neutral-800 text-white",
            isFullScreen
              ? // Important because vaul writes the short T-PIN height back inline when the keyboard closes.
                "!bottom-0 !h-dvh !max-h-dvh overflow-hidden rounded-none bg-background data-[vaul-drawer-direction=bottom]:mt-0 data-[vaul-drawer-direction=bottom]:rounded-none"
              : "rounded-t-3xl bg-[#0a0a0a]",
          )}
        >
          {stage === "loading" && (
            <>
              <DrawerTitle className="sr-only">Preparing payment</DrawerTitle>
              <DrawerDescription className="sr-only">Loading your wallet</DrawerDescription>
              <div className="flex justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
              </div>
            </>
          )}

          {stage === "confirm" && (
            <>
              <DrawerHeader className="text-left">
                <DrawerTitle className="text-lg font-bold text-white">Confirm payment</DrawerTitle>
                <DrawerDescription className="line-clamp-2 text-neutral-400">{title}</DrawerDescription>
              </DrawerHeader>

              <div className="space-y-3 px-4">
                <div className="py-2 text-center">
                  <p className="text-4xl font-bold tracking-tight">{total.toLocaleString("en-IN")}</p>
                  <p className="mt-1 text-sm text-neutral-400">credits (₹{total.toLocaleString("en-IN")})</p>
                </div>

                <dl className="space-y-2 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-3.5 text-sm">
                  {items.map((item) => (
                    <div key={item.label} className="flex justify-between gap-3">
                      <dt className="text-neutral-400">{item.label}</dt>
                      <dd className="shrink-0 font-medium">{item.credits.toLocaleString("en-IN")} credits</dd>
                    </div>
                  ))}
                  <div className="flex justify-between gap-3 border-t border-neutral-800 pt-2">
                    <dt className="text-neutral-400">Wallet balance</dt>
                    <dd className="flex shrink-0 items-center gap-1 font-medium">
                      <Coins className="h-3.5 w-3.5 text-amber-400" /> {balance.toLocaleString("en-IN")} credits
                    </dd>
                  </div>
                  {shortBy <= 0 && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-neutral-400">Balance after payment</dt>
                      <dd className="shrink-0 font-medium">{(balance - total).toLocaleString("en-IN")} credits</dd>
                    </div>
                  )}
                </dl>

                {shortBy > 0 && (
                  <p className="text-center text-sm font-medium text-rose-400">
                    You&apos;re short by {shortBy.toLocaleString("en-IN")} credits.
                  </p>
                )}
              </div>

              <DrawerFooter>
                {shortBy > 0 ? (
                  <button
                    type="button"
                    onClick={() => setTopUpOpen(true)}
                    className="w-full rounded-2xl bg-amber-400 py-3.5 text-sm font-bold text-black active:scale-[0.98]"
                  >
                    Add credits
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={continueFromConfirm}
                    className="w-full rounded-2xl bg-white py-3.5 text-sm font-bold text-black active:scale-[0.98]"
                  >
                    Continue to pay {total.toLocaleString("en-IN")} credits
                  </button>
                )}
                <button type="button" onClick={onClose} className="py-2 text-sm font-medium text-neutral-400">
                  Cancel
                </button>
              </DrawerFooter>
            </>
          )}

          {stage === "enter-pin" && (
            <PinStep
              icon={<Lock className="h-5 w-5" />}
              heading="Enter your T-PIN"
              sub={`To pay ${total.toLocaleString("en-IN")} credits`}
              onBack={() => setStage("confirm")}
              error={error}
              footer={
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setStage("forgot");
                  }}
                  className="py-2 text-sm font-medium text-amber-400"
                >
                  Forgot T-PIN?
                </button>
              }
            >
              <PinInput value={pin} onChange={handlePinEntry} disabled={Boolean(lockedUntil)} shake={shake} />
              {lockedUntil && !error && (
                <p className="mt-3 text-center text-sm text-rose-400">
                  Locked until {lockedUntil.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}. You can reset your T-PIN to pay now.
                </p>
              )}
            </PinStep>
          )}

          {stage === "new-pin" && (
            <PinStep
              icon={<ShieldCheck className="h-5 w-5" />}
              heading={proof ? "Choose a new T-PIN" : "Create your T-PIN"}
              sub={`${TPIN_LENGTH} digits. You'll enter it every time you pay with credits.`}
              onBack={() => {
                setProof(null);
                setStage(status?.isSet ? "enter-pin" : "confirm");
              }}
              error={error}
            >
              <PinInput value={pin} onChange={handleNewPin} shake={shake} />
            </PinStep>
          )}

          {stage === "repeat-pin" && (
            <PinStep
              icon={<ShieldCheck className="h-5 w-5" />}
              heading="Enter it once more"
              sub="Just to be sure."
              onBack={() => {
                setPin("");
                setStage("new-pin");
              }}
              error={error}
            >
              <PinInput value={pin} onChange={(v) => void handleRepeatPin(v)} disabled={busy} shake={shake} />
              {busy && <Loader2 className="mx-auto mt-4 h-5 w-5 animate-spin text-neutral-400" />}
            </PinStep>
          )}

          {stage === "forgot" && (
            <PinStep
              icon={<Lock className="h-5 w-5" />}
              heading="Reset your T-PIN"
              sub={
                status?.canResetWithOtp
                  ? otpSentTo
                    ? `Enter the code we sent on WhatsApp to ${otpSentTo}.`
                    : "We'll send a code to your verified WhatsApp number."
                  : "Confirm your account password. If you signed up with Facebook, contact support from the Help Center."
              }
              onBack={() => {
                setError(null);
                setStage("enter-pin");
              }}
              error={error}
            >
              <div className="space-y-3">
                {status?.canResetWithOtp ? (
                  otpSentTo ? (
                    <input
                      autoFocus
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      aria-label="WhatsApp code"
                      placeholder="6-digit code"
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-center text-lg tracking-[0.3em] outline-none focus:border-amber-400"
                    />
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void sendResetCode()}
                      className="flex w-full items-center justify-center rounded-2xl bg-white py-3.5 text-sm font-bold text-black disabled:opacity-50"
                    >
                      {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Send code"}
                    </button>
                  )
                ) : (
                  <input
                    autoFocus
                    type="password"
                    autoComplete="current-password"
                    aria-label="Account password"
                    placeholder="Account password"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 outline-none focus:border-amber-400"
                  />
                )}
                {(otpSentTo || !status?.canResetWithOtp) && (
                  <button
                    type="button"
                    disabled={status?.canResetWithOtp ? resetCode.length !== 6 : !resetPassword}
                    onClick={submitProof}
                    className="w-full rounded-2xl bg-white py-3.5 text-sm font-bold text-black disabled:opacity-50"
                  >
                    Continue
                  </button>
                )}
              </div>
            </PinStep>
          )}

          {stage === "processing" && (
            <>
              <DrawerTitle className="sr-only">Processing payment</DrawerTitle>
              <DrawerDescription className="sr-only">Please wait while your payment goes through</DrawerDescription>
              <div className="flex flex-col items-center gap-4 py-14" role="status">
                {/* PIN accepted: the lock opens, then credits flow out on a progress ring. */}
                <span className="relative flex h-24 w-24 items-center justify-center">
                  <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
                    <circle cx="50" cy="50" r="44" stroke="rgba(251,191,36,0.15)" strokeWidth="6" fill="none" />
                    <motion.circle
                      cx="50"
                      cy="50"
                      r="44"
                      stroke="#fbbf24"
                      strokeWidth="6"
                      strokeLinecap="round"
                      fill="none"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: [0, 0.7, 0.92] }}
                      transition={{ duration: 2.4, times: [0, 0.4, 1], ease: "easeOut" }}
                    />
                  </svg>
                  <motion.span
                    className="absolute flex items-center justify-center text-emerald-400"
                    initial={{ scale: 1, opacity: 1 }}
                    animate={{ scale: [1, 1.15, 0], opacity: [1, 1, 0] }}
                    transition={{ duration: 0.7, times: [0, 0.5, 1] }}
                  >
                    <LockOpen className="h-9 w-9" />
                  </motion.span>
                  <motion.span
                    className="absolute"
                    initial={{ scale: 0, rotate: -90 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 16, delay: 0.6 }}
                  >
                    <Coins className="h-9 w-9 text-amber-400" />
                  </motion.span>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <motion.span
                      key={i}
                      className="absolute h-2.5 w-2.5 rounded-full bg-amber-300"
                      initial={{ opacity: 0, x: 0, y: 0 }}
                      animate={{ opacity: [0, 1, 0], x: [0, (i - 2) * 22], y: [0, -60 - (i % 2) * 14] }}
                      transition={{ duration: 0.9, delay: 0.8 + i * 0.12, repeat: Infinity, repeatDelay: 0.5 }}
                    />
                  ))}
                </span>
                <motion.p
                  className="text-sm font-semibold"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                >
                  PIN verified · paying {total.toLocaleString("en-IN")} credits…
                </motion.p>
                <p className="text-xs text-neutral-500">Please don&apos;t close the app.</p>
              </div>
            </>
          )}

          {stage === "success" && paid?.invoice && (
            <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
              <ConfettiBurst className="z-20" originY="12%" />
              <DrawerTitle className="sr-only">Payment successful</DrawerTitle>
              <DrawerDescription className="sr-only">Invoice {paid.invoice.number}</DrawerDescription>
              {/* vaul turns touch scrolling off on the drawer, so the ticket has to be its own scroller. */}
              <div data-vaul-no-drag className="flex min-h-0 flex-1 touch-pan-y justify-center overflow-y-auto overscroll-contain px-6 pb-3 pt-4">
                <AnimatedTicket
                  className="h-fit"
                  invoiceNumber={paid.invoice.number}
                  credits={paid.invoice.totalCredits}
                  date={new Date(paid.invoice.createdAt)}
                  billedTo={paid.invoice.billedToName}
                  balanceAfter={paid.invoice.balanceAfter}
                />
              </div>
              {/* Outside the scroller, so a way out is on screen at any height. */}
              <div className="z-10 mx-auto flex w-full max-w-sm shrink-0 flex-col gap-1 px-6 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3">
                <button
                  type="button"
                  onClick={() => finish(true)}
                  className="w-full rounded-2xl bg-white py-3.5 text-sm font-bold text-black active:scale-[0.98]"
                >
                  View invoice
                </button>
                <button type="button" onClick={() => finish(false)} className="py-2.5 text-sm font-medium text-neutral-300">
                  Done
                </button>
              </div>
            </div>
          )}
        </DrawerContent>
      </Drawer>

      {topUpOpen && (
        <AddCreditsModal
          open
          onClose={() => setTopUpOpen(false)}
          requiredCredits={total}
          currentBalance={balance}
          onSuccess={() => void loadStatus()}
        />
      )}
    </>
  );
}

function PinStep({
  icon,
  heading,
  sub,
  onBack,
  error,
  children,
  footer,
}: {
  icon: React.ReactNode;
  heading: string;
  sub: string;
  onBack: () => void;
  error: string | null;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="relative px-4 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-4">
      <button type="button" onClick={onBack} aria-label="Back" className="absolute left-3 top-3 rounded-full p-2 text-neutral-400">
        <ChevronLeft className="h-5 w-5" />
      </button>
      <div className="flex flex-col items-center text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-400/10 text-amber-400">{icon}</span>
        <DrawerTitle className="mt-3 text-lg font-bold text-white">{heading}</DrawerTitle>
        <DrawerDescription className="mt-1 max-w-xs text-neutral-400">{sub}</DrawerDescription>
      </div>
      <div className="mt-5">{children}</div>
      <p className="mt-3 min-h-5 text-center text-sm text-rose-400" role="alert">
        {error}
      </p>
      {footer && <div className="mt-1 flex justify-center">{footer}</div>}
    </div>
  );
}
