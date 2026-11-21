// "use client";

// import { useState, useRef } from "react";
// import { signIn } from "next-auth/react";
// import { useRouter } from "next/navigation";
// import { toast } from "sonner";
// import { Loader2 } from "lucide-react";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";

// const ERROR_MESSAGES: Record<string, string> = {
//   NOT_FOUND: "No code was sent to this number. Request a new one.",
//   EXPIRED: "This code has expired. Request a new one.",
//   TOO_MANY_ATTEMPTS: "Too many incorrect attempts. Request a new code.",
//   INVALID_CODE: "Incorrect code.",
//   ACCOUNT_BANNED: "This account has been suspended. Contact support.",
// };

// type Step = "phone" | "code";

// export function WhatsAppOtpLogin({ callbackUrl }: { callbackUrl: string }) {
//   const router = useRouter();
//   const [step, setStep] = useState<Step>("phone");
//   const [phone, setPhone] = useState("");
//   const [code, setCode] = useState("");
//   const [sending, setSending] = useState(false);
//   const [verifying, setVerifying] = useState(false);
//   const codeInputRef = useRef<HTMLInputElement>(null);

//   async function handleSendCode() {
//     if (sending) return;
//     setSending(true);
//     try {
//       const res = await fetch("/api/auth/whatsapp-otp/send", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ phone }),
//       });
//       const data = await res.json();
//       if (!res.ok) {
//         toast.error(data?.error?.message ?? "Could not send the code.");
//         return;
//       }
//       toast.success("Code sent via WhatsApp.");
//       setStep("code");
//       setTimeout(() => codeInputRef.current?.focus(), 50);
//     } finally {
//       setSending(false);
//     }
//   }

//   async function handleVerify() {
//     if (verifying || code.length !== 6) return;
//     setVerifying(true);
//     try {
//       // Client-side signIn() -- the same proven mechanism the email/
//       // password login already uses, just against the "whatsapp-otp"
//       // provider. See DECISIONS.md #39 for why this (not the REST
//       // /api/auth/whatsapp-otp/verify route) drives the browser flow.
//       const result = await signIn("whatsapp-otp", { phone, code, redirect: false });
//       if (result?.error) {
//         toast.error(ERROR_MESSAGES[result.error] ?? "Could not verify this code.");
//         return;
//       }
//       router.push(callbackUrl);
//       router.refresh();
//     } finally {
//       setVerifying(false);
//     }
//   }

//   if (step === "phone") {
//     return (
//       <div className="space-y-4">
//         <div>
//           <Label htmlFor="otp-phone">WhatsApp number</Label>
//           <Input
//             id="otp-phone"
//             type="tel"
//             inputMode="numeric"
//             placeholder="98765 43210"
//             value={phone}
//             onChange={(e) => setPhone(e.target.value)}
//             onKeyDown={(e) => e.key === "Enter" && handleSendCode()}
//           />
//         </div>
//         <Button type="button" className="w-full bg-[#25D366] hover:bg-[#1ea952]" onClick={handleSendCode} disabled={sending}>
//           {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
//           {sending ? "Sending…" : "Send code via WhatsApp"}
//         </Button>
//       </div>
//     );
//   }

//   return (
//     <div className="space-y-4">
//       <div>
//         <Label htmlFor="otp-code">6-digit code</Label>
//         <Input
//           id="otp-code"
//           ref={codeInputRef}
//           type="text"
//           inputMode="numeric"
//           maxLength={6}
//           placeholder="••••••"
//           value={code}
//           onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
//           onKeyDown={(e) => e.key === "Enter" && handleVerify()}
//           className="text-center text-lg tracking-[0.5em]"
//         />
//         <p className="mt-1.5 text-xs text-neutral-400">
//           Sent to {phone}.{" "}
//           <button type="button" onClick={() => setStep("phone")} className="font-semibold text-brand-600">
//             Change number
//           </button>
//         </p>
//       </div>
//       <Button type="button" className="w-full" onClick={handleVerify} disabled={verifying || code.length !== 6}>
//         {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
//         {verifying ? "Verifying…" : "Verify & log in"}
//       </Button>
//       <button type="button" onClick={handleSendCode} disabled={sending} className="w-full text-center text-xs text-neutral-400">
//         {sending ? "Resending…" : "Didn't get it? Resend code"}
//       </button>
//     </div>
//   );
// }

"use client";

import { useEffect, useState, useRef } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ERROR_MESSAGES: Record<string, string> = {
  NOT_FOUND: "No code was sent to this number. Request a new one.",
  EXPIRED: "This code has expired. Request a new one.",
  TOO_MANY_ATTEMPTS: "Too many incorrect attempts. Request a new code.",
  INVALID_CODE: "Incorrect code.",
  ACCOUNT_BANNED: "This account has been suspended. Contact support.",
};

const darkInput =
  "mt-1.5 h-12 rounded-2xl border-white/10 bg-white/5 px-4 text-white placeholder:text-white/25 focus-visible:border-white/30 focus-visible:ring-white/20";

type Step = "phone" | "code";

export function WhatsAppOtpLogin({ callbackUrl }: { callbackUrl: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const codeInputRef = useRef<HTMLInputElement>(null);

  // Invite links (/login?ref=CODE or /signup?ref=CODE) pre-fill the referral code
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) setReferralCode(ref.toUpperCase());
  }, []);

  async function handleSendCode() {
    if (sending) return;
    setSending(true);
    try {
      if (referralCode.trim()) {
        const check = await fetch(`/api/referrals/check?code=${encodeURIComponent(referralCode.trim())}`);
        const { valid } = check.ok ? await check.json() : { valid: false };
        if (!valid) {
          toast.error("That referral code doesn't exist.");
          return;
        }
      }
      const res = await fetch("/api/auth/whatsapp-otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error?.message ?? "Could not send the code.");
        return;
      }
      toast.success("Code sent via WhatsApp.");
      setStep("code");
      setTimeout(() => codeInputRef.current?.focus(), 50);
    } finally {
      setSending(false);
    }
  }

  async function handleVerify() {
    if (verifying || code.length !== 6) return;
    setVerifying(true);
    try {
      // The referral code only takes effect if this number is signing up for the first time
      const result = await signIn("whatsapp-otp", { phone, code, referralCode: referralCode.trim(), redirect: false });
      if (result?.error) {
        toast.error(ERROR_MESSAGES[result.error] ?? "Could not verify this code.");
        return;
      }
      router.push(callbackUrl);
      router.refresh();
    } finally {
      setVerifying(false);
    }
  }

  if (step === "phone") {
    return (
      <div className="space-y-4">
        <div>
          <Label htmlFor="otp-phone" className="text-white/60">WhatsApp number</Label>
          <Input
            id="otp-phone"
            type="tel"
            inputMode="numeric"
            placeholder="98765 43210"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendCode()}
            className={darkInput}
          />
        </div>
        <div>
          <Label htmlFor="otp-referral" className="text-white/60">Referral code (new users, optional)</Label>
          <Input
            id="otp-referral"
            autoComplete="off"
            autoCapitalize="characters"
            placeholder="e.g. KANI7QX2"
            value={referralCode}
            onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
            className={darkInput}
          />
        </div>
        <Button
          type="button"
          className="h-12 w-full rounded-full bg-[#25D366] text-[15px] font-semibold text-white hover:bg-[#1eb85a]"
          onClick={handleSendCode}
          disabled={sending}
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {sending ? "Sending…" : "Send code via WhatsApp"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="otp-code" className="text-white/60">6-digit code</Label>
        <Input
          id="otp-code"
          ref={codeInputRef}
          type="text"
          inputMode="numeric"
          maxLength={6}
          placeholder="••••••"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          onKeyDown={(e) => e.key === "Enter" && handleVerify()}
          className="mt-1.5 h-14 rounded-2xl border-white/10 bg-white/5 text-center text-xl tracking-[0.6em] text-white focus-visible:border-white/30 focus-visible:ring-white/20"
        />
        <p className="mt-2 text-xs text-white/40">
          Sent to {phone}.{" "}
          <button
            type="button"
            onClick={() => setStep("phone")}
            className="font-semibold text-[#25D366]"
          >
            Change number
          </button>
        </p>
      </div>
      <Button
        type="button"
        className="h-12 w-full rounded-full bg-white text-[15px] font-semibold text-black hover:bg-white/90"
        onClick={handleVerify}
        disabled={verifying || code.length !== 6}
      >
        {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {verifying ? "Verifying…" : "Verify & log in"}
      </Button>
      <button
        type="button"
        onClick={handleSendCode}
        disabled={sending}
        className="w-full text-center text-xs text-white/40"
      >
        {sending ? "Resending…" : "Didn't get it? Resend code"}
      </button>
    </div>
  );
}
