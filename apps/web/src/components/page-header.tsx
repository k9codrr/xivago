"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Sticky top bar for secondary pages (settings, communities, invoices…):
 * back button · centred title · optional trailing action. These pages hide
 * the bottom tab bar, so the back button is the way out.
 */
export function PageHeader({
  title,
  fallbackHref = "/",
  action,
  onBack,
  className,
}: {
  title: string;
  /** Where to go when there is no history to go back to (opened from a link). */
  fallbackHref?: string;
  action?: ReactNode;
  /** Overrides the default back behaviour (e.g. to confirm unsaved changes). */
  onBack?: () => void;
  className?: string;
}) {
  const router = useRouter();

  function goBack() {
    if (onBack) return onBack();
    if (window.history.length > 1) router.back();
    else router.push(fallbackHref);
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-30 -mx-4 grid grid-cols-[minmax(3rem,auto)_1fr_minmax(3rem,auto)] items-center gap-2 border-b border-white/[0.06] bg-black/80 px-2 pb-2 pt-[max(env(safe-area-inset-top),0.5rem)] backdrop-blur-xl",
        className,
      )}
    >
      <button
        type="button"
        onClick={goBack}
        aria-label="Back"
        className="flex h-10 w-10 items-center justify-center rounded-full text-white transition active:scale-90 active:bg-white/10"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>
      <h1 className="truncate text-center text-[17px] font-semibold tracking-tight text-white">{title}</h1>
      <div className="flex min-w-[3rem] items-center justify-end">{action}</div>
    </header>
  );
}
