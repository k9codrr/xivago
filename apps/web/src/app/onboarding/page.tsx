"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { RoleChoice } from "@/lib/validation/auth";
import {
  CategoryFlowPicker,
  EMPTY_CATEGORY_FLOW_VALUE,
  type CategoryFlowValue,
} from "@/components/category-flow/category-flow-picker";

const ROLE_OPTIONS: Array<{
  value: RoleChoice;
  title: string;
  description: string;
  icon: typeof Briefcase;
}> = [
  {
    value: "VENDOR",
    title: "I provide services/products",
    description: "Browse requests, respond to them, and get found by people who need you.",
    icon: Briefcase,
  },
  {
    value: "BUSINESS",
    title: "I need services/products",
    description: "Post what you need. Providers respond, and you choose who to talk to.",
    icon: ShoppingBag,
  },
];

/**
 * Shown once to brand-new Facebook-login users (NextAuth `pages.newUser`).
 * Credentials signups already pick a role inline on /signup, so they never
 * land here. Role stays editable from Settings afterwards either way.
 */
export default function OnboardingPage() {
  const router = useRouter();
  const [role, setRole] = useState<RoleChoice>("VENDOR");
  const [referralCode, setReferralCode] = useState("");
  const [offering, setOffering] = useState<CategoryFlowValue>(EMPTY_CATEGORY_FLOW_VALUE);
  const [submitting, setSubmitting] = useState(false);

  async function confirmRole() {
    setSubmitting(true);
    try {
      if (referralCode.trim()) {
        const ref = await fetch("/api/referrals/redeem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: referralCode.trim() }),
        });
        const data = await ref.json();
        if (!ref.ok) {
          toast.error(data?.error?.message ?? "Could not apply this referral code.");
          return;
        }
        toast.success(`Referral applied: ${data.welcomeCredits} bonus credits added to your wallet.`);
        setReferralCode("");
      }

      const res = await fetch("/api/onboarding/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Category picks only apply to providers; buyers pick per demand when posting.
        body: JSON.stringify(role === "VENDOR" ? { role, ...offering } : { role }),
      });
      if (!res.ok) {
        toast.error("Could not save your choice. Try again.");
        return;
      }
      router.push("/");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col justify-center px-6 pb-10 pt-[max(env(safe-area-inset-top),2.5rem)]">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-bold text-neutral-900">One quick thing</h1>
        <p className="mb-6 text-sm text-neutral-500">
          What brings you to xivago? You can change this anytime in Settings.
        </p>

        <div className="grid grid-cols-1 gap-2.5">
          {ROLE_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const selected = role === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRole(opt.value)}
                className={cn(
                  "card-shell flex items-start gap-3 p-3.5 text-left transition-colors",
                  selected && "border-brand-500 bg-brand-50",
                )}
                aria-pressed={selected}
              >
                <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", selected ? "text-brand-600" : "text-neutral-400")} />
                <span>
                  <span className="block text-sm font-semibold text-neutral-900">{opt.title}</span>
                  <span className="block text-xs text-neutral-500">{opt.description}</span>
                </span>
              </button>
            );
          })}
        </div>

        {role === "VENDOR" && (
          <div className="mt-5">
            <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">What do you offer? (optional)</p>
            <p className="mb-3 text-xs text-neutral-500">
              Pick a sub-category, then your service and the common needs you help with. You can edit this later in your profile.
            </p>
            <CategoryFlowPicker value={offering} onChange={setOffering} />
          </div>
        )}

        <div className="mt-5">
          <Label htmlFor="referralCode">Referral code (optional)</Label>
          <Input
            id="referralCode"
            autoComplete="off"
            autoCapitalize="characters"
            placeholder="e.g. KANI7QX2"
            value={referralCode}
            onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
          />
        </div>

        <Button className="mt-6 w-full" onClick={confirmRole} disabled={submitting}>
          {submitting ? "Saving…" : "Continue"}
        </Button>
      </div>
    </main>
  );
}
