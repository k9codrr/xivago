"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, ChevronLeft } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

export type DealProgressCode = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "PROBLEM";

export interface CheckInData {
  bidId: string;
  role: "VENDOR" | "SEEKER";
  due: boolean;
  latestStatus: DealProgressCode | null;
  otherLatestStatus: DealProgressCode | null;
  rated: boolean;
  demandSummary: string;
  otherParty: { id: string; name: string; avatarUrl: string | null; companyName: string | null };
}

interface DealCheckInDrawerProps {
  open: boolean;
  onClose: () => void;
  data: CheckInData;
  /** Called after an answer is saved; `wantsRating` = they said it's done and haven't rated yet. */
  onAnswered: (status: DealProgressCode, wantsRating: boolean) => void;
}

const OPTIONS: Array<{ status: DealProgressCode; label: string; hint: string }> = [
  { status: "IN_PROGRESS", label: "Yes, we're working on it", hint: "The project is under way" },
  { status: "NOT_STARTED", label: "Not started yet", hint: "Still discussing or waiting" },
  { status: "COMPLETED", label: "It's completed", hint: "Work delivered and done" },
  { status: "CANCELLED", label: "It didn't happen", hint: "We didn't go ahead" },
  { status: "PROBLEM", label: "There's a problem", hint: "Something's not right" },
];

const MOODS = [
  { value: 1, emoji: "😞", label: "Badly" },
  { value: 2, emoji: "😕", label: "Not great" },
  { value: 3, emoji: "😐", label: "Okay" },
  { value: 4, emoji: "🙂", label: "Good" },
  { value: 5, emoji: "🤩", label: "Great" },
];

/** Answers that go straight through without a follow-up step. */
const INSTANT: DealProgressCode[] = ["NOT_STARTED", "CANCELLED"];

export function DealCheckInDrawer({ open, onClose, data, onAnswered }: DealCheckInDrawerProps) {
  const [status, setStatus] = useState<DealProgressCode | null>(null);
  const [mood, setMood] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const otherName = data.otherParty.companyName ?? data.otherParty.name;
  const firstName = data.otherParty.name.split(" ")[0] ?? data.otherParty.name;

  function reset() {
    setStatus(null);
    setMood(null);
    setNote("");
  }

  async function post(body: Record<string, unknown>) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/deals/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bidId: data.bidId, ...body }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Could not save your answer.");
        return false;
      }
      return true;
    } catch {
      toast.error("Something went wrong. Please try again.");
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  async function submit(s: DealProgressCode) {
    if (submitting) return;
    const ok = await post({ status: s, mood, note: note.trim() || null });
    if (!ok) return;
    toast.success(s === "PROBLEM" ? "Thanks — our team will take a look." : "Thanks for the update!");
    const wantsRating = s === "COMPLETED" && !data.rated;
    reset();
    onClose();
    onAnswered(s, wantsRating);
  }

  async function snooze() {
    if (submitting) return;
    if (await post({ snooze: true })) {
      reset();
      onClose();
    }
  }

  function pick(s: DealProgressCode) {
    if (INSTANT.includes(s)) void submit(s);
    else setStatus(s);
  }

  // The other side already said it's done/cancelled — ask them to confirm.
  const confirmPrompt =
    data.otherLatestStatus === "COMPLETED"
      ? `${firstName} marked this project as completed. Is that right?`
      : data.otherLatestStatus === "CANCELLED"
        ? `${firstName} said this project didn't go ahead. Is that right?`
        : null;

  return (
    <Drawer
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          reset();
          onClose();
        }
      }}
    >
      <DrawerContent className="mx-auto max-w-md rounded-t-3xl border-neutral-800 bg-[#0a0a0a] p-5 text-white">
        <DrawerHeader className="px-0 pt-0 text-left">
          <div className="mb-3 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={data.otherParty.avatarUrl ?? "/icons/avatar-placeholder.svg"}
              alt={otherName}
              className="h-11 w-11 rounded-full bg-[#262626] object-cover"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-neutral-100">{otherName}</p>
              <p className="truncate text-xs text-neutral-500">{data.demandSummary}</p>
            </div>
          </div>
          <DrawerTitle className="text-lg font-bold text-white">
            {status === "IN_PROGRESS"
              ? `How's it going with ${firstName}?`
              : status === "COMPLETED"
                ? `How did it go with ${firstName}?`
                : status === "PROBLEM"
                  ? "What's going wrong?"
                  : `Quick check-in about ${firstName}`}
          </DrawerTitle>
          <DrawerDescription className="text-xs text-neutral-400">
            {status === "PROBLEM"
              ? "Only the xivago team sees this. We may reach out to help."
              : status
                ? "Your answer stays private and helps keep xivago trustworthy."
                : (confirmPrompt ?? `Are you working with ${firstName} on this project?`)}
          </DrawerDescription>
        </DrawerHeader>

        {!status && (
          <div className="space-y-2 py-2">
            {OPTIONS.map((o) => (
              <button
                key={o.status}
                type="button"
                disabled={submitting}
                onClick={() => pick(o.status)}
                className={cn(
                  "flex w-full items-center justify-between rounded-2xl border border-neutral-800 bg-neutral-900/60 px-4 py-3 text-left transition active:scale-[0.98] disabled:opacity-50",
                  data.latestStatus === o.status && "border-amber-400/40",
                )}
              >
                <span>
                  <span className="block text-sm font-medium text-neutral-100">{o.label}</span>
                  <span className="block text-xs text-neutral-500">{o.hint}</span>
                </span>
                {data.latestStatus === o.status && <span className="text-[10px] text-amber-400">Last answer</span>}
              </button>
            ))}
          </div>
        )}

        {status && (
          <div className="space-y-4 py-2">
            {status !== "PROBLEM" && (
              <div className="flex justify-between">
                {MOODS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setMood(m.value)}
                    className={cn(
                      "flex w-14 flex-col items-center gap-1 rounded-2xl py-2 transition",
                      mood === m.value ? "bg-amber-400/15 ring-1 ring-amber-400/50" : "bg-neutral-900/60",
                    )}
                  >
                    <span className="text-2xl">{m.emoji}</span>
                    <span className="text-[10px] text-neutral-400">{m.label}</span>
                  </button>
                ))}
              </div>
            )}
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder={status === "PROBLEM" ? "Tell us what happened" : "Anything to add? (optional)"}
              className="w-full rounded-xl border border-neutral-800 bg-neutral-900/70 p-3 text-sm text-neutral-100 outline-none placeholder:text-neutral-500 focus-visible:border-neutral-700"
            />
          </div>
        )}

        <DrawerFooter className="px-0 pb-2 pt-1">
          {status ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStatus(null)}
                aria-label="Back"
                className="flex h-12 w-12 items-center justify-center rounded-2xl border border-neutral-800 text-neutral-300"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                disabled={submitting || (status === "PROBLEM" ? note.trim().length < 5 : mood == null)}
                onClick={() => submit(status)}
                className="flex flex-1 items-center justify-center rounded-2xl bg-amber-400 py-3.5 text-sm font-bold text-black transition hover:bg-amber-300 active:scale-95 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : status === "COMPLETED" && !data.rated ? "Next: rate" : "Send"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={submitting}
              onClick={snooze}
              className="w-full py-2 text-xs font-medium text-neutral-500 hover:text-neutral-300"
            >
              Ask me later
            </button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
