"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { passwordSchema } from "@/lib/validation/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";

const darkInput =
  "mt-1.5 h-12 rounded-2xl border-white/10 bg-white/5 px-4 text-white placeholder:text-white/25 focus-visible:border-white/30 focus-visible:ring-white/20";

type Step = "identify" | "reset";
type Channel = "email" | "whatsapp";

/**
 * Login → "Forgot password?". Step 1 takes the email or mobile and sends a
 * code by email (Resend) or to the verified WhatsApp number; step 2 takes the
 * code and the new password, and can re-send on the other channel. `onDone` gets the identifier so the login form can prefill it.
 */
export function ForgotPasswordForm({ initialIdentifier = "", onDone }: { initialIdentifier?: string; onDone: (identifier: string) => void }) {
  const [step, setStep] = useState<Step>("identify");
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [maskedTarget, setMaskedTarget] = useState("");
  const [channel, setChannel] = useState<Channel>("email");
  const [channels, setChannels] = useState<Record<Channel, boolean>>({ email: false, whatsapp: false });
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendCode(preferred?: Channel) {
    setError(null);
    if (identifier.trim().length < 3) return setError("Enter your email or mobile number");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/password-reset/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim(), channel: preferred }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) return setError(data?.error?.message ?? "Could not send the code.");
      setMaskedTarget(data.maskedTarget);
      setChannel(data.channel);
      setChannels(data.channels);
      setCode("");
      setStep("reset");
      toast.success(data.channel === "email" ? "Code sent to your email." : "Code sent on WhatsApp.");
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setError(null);
    if (!/^\d{6}$/.test(code)) return setError("Enter the 6-digit code");
    const strong = passwordSchema.safeParse(password);
    if (!strong.success) return setError(strong.error.issues[0]?.message ?? "Choose a stronger password");
    if (password !== confirm) return setError("Passwords do not match");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim(), channel, code, password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) return setError(data?.error?.message ?? "Could not reset your password.");
      toast.success("Password updated. Log in with your new password.");
      onDone(identifier.trim());
    } finally {
      setBusy(false);
    }
  }

  if (step === "identify") {
    return (
      <form
        noValidate
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void sendCode();
        }}
      >
        <div>
          <Label htmlFor="reset-identifier" className="text-white/60">Email or mobile number</Label>
          <Input
            id="reset-identifier"
            autoComplete="username"
            placeholder="you@example.com or 98765 43210"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className={darkInput}
          />
          <FieldError message={error ?? undefined} />
        </div>
        <p className="text-[13px] leading-relaxed text-white/45">
          We&apos;ll send a 6-digit code to your email, or to the WhatsApp number verified on your account.
        </p>
        <Button type="submit" disabled={busy} className="h-12 w-full rounded-full bg-white text-[15px] font-semibold text-black hover:bg-white/90">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send code"}
        </Button>
      </form>
    );
  }

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void reset();
      }}
    >
      <p className="text-sm text-white/60">
        Enter the code we sent {channel === "email" ? "to" : "on WhatsApp to"}{" "}
        <span className="font-medium text-white">{maskedTarget}</span>.
      </p>
      <div>
        <Label htmlFor="reset-code" className="text-white/60">Code</Label>
        <Input
          id="reset-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="••••••"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          className={`${darkInput} tracking-[0.4em]`}
        />
      </div>
      <div>
        <Label htmlFor="reset-password" className="text-white/60">New password</Label>
        <Input
          id="reset-password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={darkInput}
        />
      </div>
      <div>
        <Label htmlFor="reset-confirm" className="text-white/60">Confirm new password</Label>
        <Input
          id="reset-confirm"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={darkInput}
        />
        <FieldError message={error ?? undefined} />
      </div>
      <Button type="submit" disabled={busy} className="h-12 w-full rounded-full bg-white text-[15px] font-semibold text-black hover:bg-white/90">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reset password"}
      </Button>
      <div className="flex justify-center gap-5">
        <button
          type="button"
          disabled={busy}
          onClick={() => void sendCode(channel)}
          className="text-sm font-medium text-white/60 transition-colors hover:text-white"
        >
          Resend code
        </button>
        {channels.email && channels.whatsapp && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void sendCode(channel === "email" ? "whatsapp" : "email")}
            className="text-sm font-medium text-white/60 transition-colors hover:text-white"
          >
            {channel === "email" ? "Send on WhatsApp instead" : "Send by email instead"}
          </button>
        )}
      </div>
    </form>
  );
}
