"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { toast } from "sonner";
import { ConsentCheckbox } from "@/components/consent-checkbox";
import { isFullConsent, takePendingConsent, useConsentCheckbox, type CheckboxEvent } from "@/lib/consent-client";

/** Pages that must stay readable without accepting first. */
const EXEMPT = ["/login", "/signup", "/privacy", "/terms"];

async function postConsent(source: "LOGIN" | "PROMPT", checkboxEvents: CheckboxEvent[]) {
  const res = await fetch("/api/consent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accepted: true, ageConfirmed: true, source, checkboxEvents }),
  });
  return res.ok;
}

/**
 * Makes sure every signed-in user has accepted the current Terms of Service
 * and Privacy Policy:
 *  - ticked on the login screen → logged here right after sign-in (source LOGIN)
 *  - otherwise (older accounts, or after a policy update) → a blocking
 *    consent screen with the same checkbox (source PROMPT)
 */
export function ConsentGate() {
  const { status } = useSession();
  const pathname = usePathname() ?? "/";
  const [needsConsent, setNeedsConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const consent = useConsentCheckbox();

  const exempt = EXEMPT.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/consent");
      if (!res.ok || cancelled) return;
      const { needsConsent: needed } = (await res.json()) as { needsConsent: boolean };
      if (!needed) return;

      const pending = takePendingConsent();
      if (isFullConsent(pending) && (await postConsent("LOGIN", pending!))) return;
      if (!cancelled) setNeedsConsent(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

  if (!needsConsent || exempt || status !== "authenticated") return null;

  async function accept() {
    setSaving(true);
    const ok = await postConsent("PROMPT", consent.events);
    setSaving(false);
    if (ok) setNeedsConsent(false);
    else toast.error("Could not save. Please try again.");
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-title"
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
    >
      <div className="w-full max-w-md rounded-t-3xl bg-neutral-950 px-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-6 text-white ring-1 ring-white/10 sm:rounded-3xl">
        <h2 id="consent-title" className="text-lg font-semibold">
          Before you continue
        </h2>
        <p className="mt-2 text-sm text-white/60">
          xivago is only for people aged 18 or older. Please confirm your age and accept our Terms of Service and
          Privacy Policy. They explain what xivago does with your data and how you can delete your account at any
          time.
        </p>

        <ConsentCheckbox
          consent={consent}
          className="mt-5 text-white/70"
          linkClassName="text-white"
        />

        <button
          type="button"
          onClick={accept}
          disabled={!consent.checked || saving}
          className="mt-5 h-12 w-full rounded-full bg-white text-[15px] font-semibold text-black transition active:scale-[0.98] disabled:opacity-40"
        >
          {saving ? "Saving…" : "Agree and continue"}
        </button>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="mt-3 w-full text-center text-sm text-white/50 hover:text-white/80"
        >
          Log out
        </button>
      </div>
    </div>
  );
}
