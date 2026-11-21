"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ConsentState } from "@/lib/consent-client";

/**
 * The two consent boxes every user must tick:
 *  1. "I confirm I am 18 years or older"
 *  2. "I agree to the Terms and Privacy Policy"
 * Every tick / untick is logged by useConsentCheckbox(). The links open in a
 * new tab so the form the user is filling in is not lost.
 */
export function ConsentCheckbox({
  consent,
  onChange,
  className,
  linkClassName,
}: {
  consent: ConsentState;
  /** Called after either box changes, with the new state of both. */
  onChange?: (state: { terms: boolean; age: boolean }) => void;
  className?: string;
  linkClassName?: string;
}) {
  const box = "mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-emerald-500";
  const row = "flex cursor-pointer items-start gap-2.5 text-left text-[13px] leading-snug";

  return (
    <div className={cn("space-y-2.5", className)}>
      <label className={row}>
        <input
          type="checkbox"
          checked={consent.ageChecked}
          onChange={(e) => {
            consent.toggleAge(e.target.checked);
            onChange?.({ terms: consent.termsChecked, age: e.target.checked });
          }}
          className={box}
          aria-describedby="age-consent-text"
        />
        <span id="age-consent-text">
          I confirm that I am <b>18 years of age or older</b> and legally able to use xivago.
        </span>
      </label>

      <label className={row}>
        <input
          type="checkbox"
          checked={consent.termsChecked}
          onChange={(e) => {
            consent.toggle(e.target.checked);
            onChange?.({ terms: e.target.checked, age: consent.ageChecked });
          }}
          className={box}
          aria-describedby="consent-text"
        />
        <span id="consent-text">
          I agree to the{" "}
          <Link href="/terms" target="_blank" className={cn("font-semibold underline underline-offset-2", linkClassName)}>
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" target="_blank" className={cn("font-semibold underline underline-offset-2", linkClassName)}>
            Privacy Policy
          </Link>
          , and I consent to xivago processing my personal data as described in them.
        </span>
      </label>
    </div>
  );
}
