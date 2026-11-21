"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Star, Loader2 } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

interface RateUserModalProps {
  open: boolean;
  onClose: () => void;
  bidId: string;
  ratedUserName: string;
  onSubmitted?: () => void;
}

const DIMENSIONS = [
  { key: "responsiveness", label: "Responsiveness" },
  { key: "quality", label: "Quality of work" },
  { key: "timeliness", label: "Timeliness" },
  { key: "value", label: "Value for price" },
] as const;

type DimensionKey = (typeof DIMENSIONS)[number]["key"];

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          className="p-0.5"
        >
          <Star
            className={cn(
              "h-6 w-6",
              n <= value ? "fill-amber-400 text-amber-400" : "fill-transparent text-neutral-600",
            )}
          />
        </button>
      ))}
    </div>
  );
}

export function RateUserModal({ open, onClose, bidId, ratedUserName, onSubmitted }: RateUserModalProps) {
  const [scores, setScores] = useState<Record<DimensionKey, number>>({
    responsiveness: 0,
    quality: 0,
    timeliness: 0,
    value: 0,
  });
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const allRated = DIMENSIONS.every((d) => scores[d.key] > 0);

  async function handleSubmit() {
    if (!allRated || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bidId, ...scores, comment: comment.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error?.message ?? "Could not submit rating.");
        return;
      }
      toast.success("Thanks for rating!");
      onSubmitted?.();
      onClose();
    } catch {
      toast.error("Something went wrong while submitting your rating.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="border-neutral-800 bg-[#0a0a0a] text-white max-w-md mx-auto rounded-t-3xl p-5">
        <DrawerHeader className="px-0 pt-0 text-left">
          <DrawerTitle className="text-lg font-bold text-white">Rate {ratedUserName}</DrawerTitle>
          <DrawerDescription className="text-xs text-neutral-400">
            Your rating helps others on xivago make better decisions.
          </DrawerDescription>
        </DrawerHeader>

        <div className="space-y-4 py-2">
          {DIMENSIONS.map((d) => (
            <div key={d.key} className="flex items-center justify-between">
              <span className="text-sm text-neutral-300">{d.label}</span>
              <StarPicker
                value={scores[d.key]}
                onChange={(v) => setScores((prev) => ({ ...prev, [d.key]: v }))}
              />
            </div>
          ))}

          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={500}
            placeholder="Add a comment (optional)"
            rows={3}
            className="w-full rounded-xl border border-neutral-800 bg-neutral-900/70 p-3 text-sm text-neutral-100 placeholder:text-neutral-500 outline-none focus-visible:border-neutral-700"
          />
        </div>

        <DrawerFooter className="px-0 pb-2 pt-1">
          <button
            type="button"
            disabled={!allRated || submitting}
            onClick={handleSubmit}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 py-3.5 text-sm font-bold text-black shadow-lg shadow-amber-400/20 transition hover:bg-amber-300 active:scale-95 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <span>Submit rating</span>}
          </button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
