"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { playSound } from "@/lib/sounds";
import { ArrowUp, Loader2 } from "lucide-react";
import { MAX_FORUM_TEXT } from "@/lib/validation/forum";
import { cn } from "@/lib/utils";
import { ComposerTextarea } from "@/components/ui/composer-textarea";
import type { ForumComment } from "./types";

interface ReplyBarProps {
  postId: string;
  onPosted: (comment: ForumComment) => void;
  placeholder?: string;
  className?: string;
}

/** Avatar + pill input that posts a comment. Renders nothing when signed out. */
export function ReplyBar({ postId, onPosted, placeholder = "Post your reply", className }: ReplyBarProps) {
  const { data: session } = useSession();
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!session?.user) return null;

  async function submit() {
    const text = draft.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/forum/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error?.message ?? "Could not post your comment.");
        return;
      }
      playSound("send");
      onPosted(data.comment);
      setDraft("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={cn("flex items-end gap-2.5", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={session.user.image ?? "/icons/avatar-placeholder.svg"}
        alt=""
        className="h-9 w-9 shrink-0 rounded-full bg-neutral-800 object-cover"
      />
      <div className="relative min-w-0 flex-1">
        <ComposerTextarea
          value={draft}
          onValueChange={(v) => setDraft(v.slice(0, MAX_FORUM_TEXT))}
          onSubmit={submit}
          placeholder={placeholder}
          aria-label="Reply"
          className="min-h-11 w-full rounded-[22px] bg-white/10 py-2.5 pl-4 pr-12 text-[15px] leading-6 text-white outline-none placeholder:text-neutral-400 focus-visible:ring-2 focus-visible:ring-white/25"
        />
        {draft.trim() && (
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            aria-label="Send reply"
            className="absolute bottom-1.5 right-1.5 flex h-8 w-8 min-h-0 items-center justify-center rounded-full bg-pearl text-slate-navy disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" strokeWidth={2.6} />}
          </button>
        )}
      </div>
    </div>
  );
}
