import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";

/**
 * Where users write about privacy, data and grievances.
 * TODO(owner): confirm this mailbox exists before launch.
 */
export const LEGAL_CONTACT_EMAIL = "privacy@xivago.com";
/** Must match POLICY_VERSION's date in lib/consent.ts. */
export const LEGAL_LAST_UPDATED = "15 November 2026";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="px-5 pb-28 pt-[max(env(safe-area-inset-top),1.5rem)] text-neutral-200">
      <Link href="/" className="mb-4 inline-flex items-center gap-0.5 text-sm text-neutral-400 hover:text-white">
        <ChevronLeft className="h-4 w-4" /> Back
      </Link>
      <h1 className="text-2xl font-bold text-white">{title}</h1>
      <p className="mt-1 text-xs text-neutral-500">Last updated: {LEGAL_LAST_UPDATED}</p>
      <div className="mt-6 space-y-6 text-[14px] leading-relaxed [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-white [&_li]:ml-4 [&_li]:list-disc [&_ul]:space-y-1">
        {children}
      </div>
    </main>
  );
}
