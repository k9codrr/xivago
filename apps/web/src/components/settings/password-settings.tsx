"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { KeyRound, Loader2 } from "lucide-react";
import { passwordSchema } from "@/lib/validation/auth";
import { cn } from "@/lib/utils";

type Mode = "closed" | "change" | "forgot";
type Channel = "email" | "whatsapp";

const input =
  "h-11 w-full rounded-xl border border-neutral-200 bg-white px-3.5 text-[15px] text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none dark:border-neutral-800 dark:bg-neutral-950 dark:text-white dark:focus:border-neutral-600";

/**
 * Settings → Password. Change it with the current password, or — when it's
 * forgotten — with a code sent by email (Resend) or to the verified WhatsApp number.
 */
export function PasswordSettings() {
  const [mode, setMode] = useState<Mode>("closed");
  const [channels, setChannels] = useState<Record<Channel, boolean> | null>(null);
  const [channel, setChannel] = useState<Channel>("email");
  const [currentPassword, setCurrentPassword] = useState("");
  const [code, setCode] = useState("");
  const [maskedTarget, setMaskedTarget] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/users/me/password")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setChannels(d?.channels ?? { email: false, whatsapp: false }))
      .catch(() => setChannels({ email: false, whatsapp: false }));
  }, []);

  function reset(next: Mode) {
    setMode(next);
    setCurrentPassword("");
    setCode("");
    setMaskedTarget(null);
    setPassword("");
    setConfirm("");
    setError(null);
  }

  async function sendCode(preferred: Channel) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/users/me/password/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: preferred }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) return setError(data?.error?.message ?? "Could not send the code.");
      setMaskedTarget(data.maskedTarget);
      setChannel(data.channel);
      setCode("");
      toast.success(data.channel === "email" ? "Code sent to your email." : "Code sent on WhatsApp.");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setError(null);
    if (mode === "change" && !currentPassword) return setError("Enter your current password");
    if (mode === "forgot" && !/^\d{6}$/.test(code)) return setError("Enter the 6-digit code");
    const strong = passwordSchema.safeParse(password);
    if (!strong.success) return setError(strong.error.issues[0]?.message ?? "Choose a stronger password");
    if (password !== confirm) return setError("Passwords do not match");

    setBusy(true);
    try {
      const res = await fetch("/api/users/me/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "change" ? { currentPassword, password } : { channel, code, password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) return setError(data?.error?.message ?? "Could not update your password.");
      toast.success("Password updated.");
      reset("closed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card-shell p-4">
      {mode === "closed" ? (
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-neutral-100 dark:bg-neutral-800">
            <KeyRound className="h-4 w-4 text-neutral-500" />
          </span>
          <p className="flex-1 text-sm text-neutral-500">Change the password you use to log in with email.</p>
          <button
            type="button"
            onClick={() => reset("change")}
            className="shrink-0 rounded-full border border-neutral-200 px-3.5 py-1.5 text-[13px] font-semibold text-neutral-800 active:scale-[0.97] dark:border-neutral-700 dark:text-neutral-100"
          >
            Change
          </button>
        </div>
      ) : (
        <form
          noValidate
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div className="flex rounded-xl bg-neutral-100 p-1 dark:bg-neutral-900">
            {(["change", "forgot"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => reset(m)}
                className={cn(
                  "flex-1 rounded-lg py-1.5 text-[13px] font-semibold transition-colors",
                  mode === m
                    ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-white"
                    : "text-neutral-500",
                )}
              >
                {m === "change" ? "I know my password" : "Forgot password"}
              </button>
            ))}
          </div>

          {mode === "change" ? (
            <input
              type="password"
              autoComplete="current-password"
              placeholder="Current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={input}
            />
          ) : channels && !channels.email && !channels.whatsapp ? (
            <p className="rounded-xl bg-neutral-100 px-3.5 py-3 text-[13px] text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
              Add a real email address or verify a WhatsApp number in Edit profile to reset your password with a code.
            </p>
          ) : maskedTarget ? (
            <div className="space-y-1.5">
              <p className="text-[13px] text-neutral-500">Enter the code sent to {maskedTarget}.</p>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="6-digit code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className={cn(input, "tracking-[0.3em]")}
              />
            </div>
          ) : (
            <div className="space-y-2">
              {(["email", "whatsapp"] as const)
                .filter((c) => channels?.[c])
                .map((c) => (
                  <button
                    key={c}
                    type="button"
                    disabled={busy}
                    onClick={() => void sendCode(c)}
                    className="flex h-11 w-full items-center justify-center rounded-xl border border-neutral-200 text-[14px] font-semibold text-neutral-800 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-100"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : c === "email" ? "Send code by email" : "Send code on WhatsApp"}
                  </button>
                ))}
              {channels === null && <Loader2 className="mx-auto h-4 w-4 animate-spin text-neutral-400" />}
            </div>
          )}

          {(mode === "change" || maskedTarget) && (
            <>
              <input
                type="password"
                autoComplete="new-password"
                placeholder="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={input}
              />
              <input
                type="password"
                autoComplete="new-password"
                placeholder="Confirm new password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={input}
              />
              <p className="text-[12px] text-neutral-400">8+ characters with upper and lower case letters and a number.</p>
            </>
          )}

          {error && <p className="text-[13px] font-medium text-red-600">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => reset("closed")}
              className="h-10 flex-1 rounded-xl border border-neutral-200 text-[14px] font-semibold text-neutral-600 dark:border-neutral-700 dark:text-neutral-300"
            >
              Cancel
            </button>
            {(mode === "change" || maskedTarget) && (
              <button
                type="submit"
                disabled={busy}
                className="flex h-10 flex-1 items-center justify-center rounded-xl bg-neutral-900 text-[14px] font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save password"}
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
