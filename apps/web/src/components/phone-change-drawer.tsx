"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { PinInput } from "@/components/credit-payment-drawer";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { isValidIndianMobile } from "@/lib/phone";
import { TPIN_LENGTH } from "@/lib/validation/tpin";

async function post(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, data, message: data?.error?.message as string | undefined };
}

const inputClass =
  "w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-base outline-none focus:border-amber-400";
const primaryClass =
  "flex w-full items-center justify-center rounded-2xl bg-white py-3.5 text-sm font-bold text-black active:scale-[0.98] disabled:opacity-50";

export function PhoneChangeDrawer({
  open,
  onClose,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  onChanged: (phone: string) => void;
}) {
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState<{ tpinRequired: boolean } | null>(null);
  const [code, setCode] = useState("");
  const [tpin, setTpin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPhone("");
    setSent(null);
    setCode("");
    setTpin("");
    setError(null);
  }, [open]);

  async function sendCode() {
    setBusy(true);
    setError(null);
    const result = await post("/api/users/me/phone/send", { phone });
    setBusy(false);
    if (!result.ok) {
      setError(result.message ?? "Could not send the code.");
      return;
    }
    setSent({ tpinRequired: result.data.tpinRequired });
  }

  async function verify() {
    setBusy(true);
    setError(null);
    const result = await post("/api/users/me/phone/verify", { phone, code, tpin: tpin || undefined });
    setBusy(false);
    if (!result.ok) {
      setError(result.message ?? "Could not change your number.");
      setTpin("");
      return;
    }
    toast.success("Number verified.");
    onChanged(result.data.phone);
    onClose();
  }

  const canVerify = code.length === 6 && (!sent?.tpinRequired || tpin.length === TPIN_LENGTH);

  return (
    <Drawer open={open} onOpenChange={(next) => !next && onClose()}>
      <DrawerContent className="mx-auto max-w-md rounded-t-3xl border-neutral-800 bg-[#0a0a0a] text-white">
        <DrawerHeader className="text-left">
          <DrawerTitle className="text-lg font-bold text-white">Verify your number</DrawerTitle>
          <DrawerDescription className="text-neutral-400">
            {sent
              ? `Enter the code we sent on WhatsApp to ${phone}.`
              : "We'll send a code on WhatsApp. This number will also be used for WhatsApp login and T-PIN resets."}
          </DrawerDescription>
        </DrawerHeader>

        <div className="space-y-4 px-4 pb-[max(env(safe-area-inset-bottom),1.25rem)]">
          {!sent ? (
            <>
              <input
                autoFocus
                type="tel"
                aria-label="New phone number"
                placeholder="98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputClass}
              />
              <button type="button" disabled={busy || !isValidIndianMobile(phone)} onClick={() => void sendCode()} className={primaryClass}>
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Send code"}
              </button>
            </>
          ) : (
            <>
              <input
                autoFocus
                inputMode="numeric"
                autoComplete="one-time-code"
                aria-label="WhatsApp code"
                placeholder="6-digit code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className={`${inputClass} text-center tracking-[0.3em]`}
              />
              {sent.tpinRequired && (
                <div>
                  <p className="mb-2 text-center text-sm text-neutral-400">Your current T-PIN</p>
                  <PinInput value={tpin} onChange={setTpin} autoFocus={false} />
                </div>
              )}
              <button type="button" disabled={busy || !canVerify} onClick={() => void verify()} className={primaryClass}>
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Verify number"}
              </button>
            </>
          )}
          {error && (
            <p className="text-center text-sm text-rose-400" role="alert">
              {error}
            </p>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
