"use client";

import { useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Download, Loader2, Trash2 } from "lucide-react";

/** Fetch /api/users/me/export and save it as a .json file. */
async function downloadMyData(): Promise<boolean> {
  try {
    const res = await fetch("/api/users/me/export", { cache: "no-store" });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      toast.error(data?.error?.message ?? "Could not download your data. Please try again.");
      return false;
    }
    const blob = await res.blob();
    const name =
      res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ??
      `xivago-my-data-${new Date().toISOString().slice(0, 10)}.json`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    toast.success("Your data has been downloaded.");
    return true;
  } catch {
    toast.error("Could not download your data. Please try again.");
    return false;
  }
}

/**
 * Settings → Delete my account. The dialog first offers a download of all
 * the user's data, then lists exactly what goes, then asks for DELETE to be
 * typed. On success the session is ended.
 */
export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [reason, setReason] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [skipDownload, setSkipDownload] = useState(false);

  async function onDownload() {
    setDownloading(true);
    if (await downloadMyData()) setDownloaded(true);
    setDownloading(false);
  }

  // Download first, or say you don't want a copy.
  const canDelete = confirmText.trim() === "DELETE" && !deleting && (downloaded || skipDownload);

  async function onDelete() {
    setDeleting(true);
    try {
      const res = await fetch("/api/users/me", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE", reason: reason.trim() || undefined }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error?.message ?? "Could not delete your account. Please try again.");
        setDeleting(false);
        return;
      }
      toast.success("Your account has been deleted.");
      await signOut({ callbackUrl: "/login" });
    } catch {
      toast.error("Could not delete your account. Please try again.");
      setDeleting(false);
    }
  }

  function close() {
    if (deleting) return;
    setOpen(false);
    setConfirmText("");
    setReason("");
    setSkipDownload(false);
  }

  return (
    <>
      <div className="card-shell p-4">
        <p className="text-sm text-neutral-500">
          Permanently delete your account and everything you&apos;ve posted. This can&apos;t be undone.{" "}
          <Link href="/privacy" className="underline">
            Privacy Policy
          </Link>
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-red-600/10 text-sm font-semibold text-red-500 ring-1 ring-red-500/30 transition active:scale-[0.98]"
        >
          <Trash2 className="h-4 w-4" />
          Delete my account
        </button>
        <button
          type="button"
          onClick={onDownload}
          disabled={downloading}
          className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-neutral-500 ring-1 ring-neutral-500/30 transition active:scale-[0.98] disabled:opacity-50"
        >
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Download my data
        </button>
      </div>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-account-title"
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
          onClick={close}
        >
          <div
            className="w-full max-w-md rounded-t-3xl bg-neutral-950 px-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-6 text-white ring-1 ring-white/10 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="h-5 w-5" />
              <h2 id="delete-account-title" className="text-lg font-semibold">
                Delete your account?
              </h2>
            </div>

            <div className="mt-4 rounded-2xl bg-white/5 p-3.5 ring-1 ring-white/10">
              <p className="text-sm font-semibold text-white">1. Download your data first</p>
              <p className="mt-1 text-xs text-white/50">
                A copy of your profile, posts, responses, messages you sent, feed posts, comments, ratings, credits,
                payments and invoices, as a JSON file. Once your account is deleted we can&apos;t get it back.
              </p>
              <button
                type="button"
                onClick={onDownload}
                disabled={downloading || deleting}
                className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-full bg-white text-sm font-semibold text-black transition active:scale-[0.98] disabled:opacity-50"
              >
                {downloading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : downloaded ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {downloading ? "Preparing…" : downloaded ? "Downloaded · download again" : "Download my data"}
              </button>
              {!downloaded && (
                <label className="mt-2.5 flex cursor-pointer items-center gap-2 text-xs text-white/50">
                  <input
                    type="checkbox"
                    checked={skipDownload}
                    onChange={(e) => setSkipDownload(e.target.checked)}
                    className="h-3.5 w-3.5 accent-red-500"
                  />
                  I don&apos;t need a copy of my data
                </label>
              )}
            </div>

            <p className="mt-4 text-sm text-white/70">2. This is permanent. We will delete:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-white/60">
              <li>Your profile, photo and settings</li>
              <li>All your requests, offers and responses</li>
              <li>Your feed posts, comments, polls and the communities you created</li>
              <li>All your chats and messages</li>
              <li>Your ratings, followers, bookmarks and notifications</li>
              <li>Your credits ({"you can't get them back"})</li>
            </ul>
            <p className="mt-3 text-xs text-white/40">
              Withdraw any credits you bought before deleting. An active PRO subscription is cancelled. By law we keep
              your payment and invoice records (with your name, email and phone) for 8 years, and a record that the
              account was deleted.
            </p>

            <label className="mt-4 block text-sm text-white/70">
              Why are you leaving? <span className="text-white/40">(optional)</span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                rows={2}
                className="mt-1.5 w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-white/30 focus:outline-none"
              />
            </label>

            <label className="mt-3 block text-sm text-white/70">
              Type <b className="text-white">DELETE</b> to confirm
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                autoCapitalize="characters"
                autoComplete="off"
                className="mt-1.5 h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white focus:border-white/30 focus:outline-none"
              />
            </label>

            <button
              type="button"
              onClick={onDelete}
              disabled={!canDelete}
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-red-600 text-[15px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-40"
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              {deleting ? "Deleting…" : "Delete my account forever"}
            </button>
            <button
              type="button"
              onClick={close}
              disabled={deleting}
              className="mt-3 w-full text-center text-sm text-white/50 hover:text-white/80"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
