"use client";

import { createContext, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Bookmark, Copy, Flag, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { DemandReportDrawer, type ReportTarget } from "@/components/demand-detail/demand-report-drawer";

const ReportContext = createContext<((t: ReportTarget) => void) | null>(null);

/** Owns the single report drawer; any ReportButton below can open it. */
export function DemandReportProvider({
  demandId,
  signedIn,
  children,
}: {
  demandId: string;
  signedIn: boolean;
  children: React.ReactNode;
}) {
  const [target, setTarget] = useState<ReportTarget | null>(null);
  return (
    <ReportContext.Provider value={setTarget}>
      {children}
      <DemandReportDrawer demandId={demandId} target={target} signedIn={signedIn} onClose={() => setTarget(null)} />
    </ReportContext.Provider>
  );
}

export function ReportButton({
  target,
  className,
  children,
}: {
  target: ReportTarget;
  className?: string;
  children?: React.ReactNode;
}) {
  const open = useContext(ReportContext);
  return (
    <button
      type="button"
      onClick={() => open?.(target)}
      className={cn("inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:underline dark:text-red-400", className)}
    >
      {children ?? (
        <>
          <Flag className="h-3.5 w-3.5" /> {target === "USER" ? "Report user" : "Report this post"}
        </>
      )}
    </button>
  );
}

export function CopyPostId({ label, value }: { label: string; value: string }) {
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard?.writeText(value).then(() => toast.success("Post ID copied"))}
      className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
      aria-label={`Copy post ID ${value}`}
    >
      {label} <span className="font-mono font-semibold text-neutral-700 dark:text-neutral-200">{value}</span>
      <Copy className="h-3 w-3" />
    </button>
  );
}

const roundBtn =
  "pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-neutral-800 shadow-md backdrop-blur hover:bg-white dark:bg-neutral-900/80 dark:text-neutral-100";

/** Back / share / save buttons floating over the photo carousel. */
export function DemandTopBar({
  demandId,
  title,
  signedIn,
  initiallySaved,
}: {
  demandId: string;
  title: string;
  signedIn: boolean;
  initiallySaved: boolean;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initiallySaved);
  const [saving, setSaving] = useState(false);

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        /* dismissed */
      }
      return;
    }
    await navigator.clipboard?.writeText(url);
    toast.success("Link copied");
  }

  async function toggleSave() {
    if (!signedIn) {
      router.push(`/login?callbackUrl=${encodeURIComponent(`/demands/${demandId}`)}`);
      return;
    }
    setSaving(true);
    const next = !saved;
    setSaved(next);
    try {
      const res = next
        ? await fetch("/api/bookmarks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ demandId }),
          })
        : await fetch(`/api/bookmarks?demandId=${encodeURIComponent(demandId)}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success(next ? "Saved to bookmarks" : "Removed from bookmarks");
    } catch {
      setSaved(!next);
      toast.error("Could not update bookmarks.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between px-3 pt-[max(env(safe-area-inset-top),0.75rem)]">
      <button
        type="button"
        aria-label="Go back"
        className={roundBtn}
        onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
      >
        <ArrowLeft className="h-4.5 w-4.5" />
      </button>
      <div className="flex gap-2">
        <button type="button" aria-label="Share" className={roundBtn} onClick={share}>
          <Share2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label={saved ? "Remove from bookmarks" : "Save"}
          aria-pressed={saved}
          disabled={saving}
          className={roundBtn}
          onClick={toggleSave}
        >
          <Bookmark className={cn("h-4 w-4", saved && "fill-brand-500 text-brand-500")} />
        </button>
      </div>
    </div>
  );
}
