"use client";

import { useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Image as ImageIcon, Loader2, X, BarChart3, MapPin, SmilePlus, Plus, AtSign } from "lucide-react";
import { EmojiPopover } from "@/components/emoji-popover";
import { MAX_FORUM_MEDIA, MAX_FORUM_TEXT } from "@/lib/validation/forum";
import {
  ALLOWED_IMAGE_TYPES,
  ALLOWED_VIDEO_TYPES,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
} from "@/lib/validation/upload";
import { cn } from "@/lib/utils";
import { MentionTextarea, type MentionTextareaHandle } from "./mention-textarea";
import { SnapSheet, SheetScrollArea } from "@/components/ui/snap-sheet";
import { useSheetStyle } from "@/lib/sheet-style";
import { useGeolocation } from "@/lib/use-geolocation";
import { celebrate } from "@/components/celebration";
import type { ForumPost } from "./types";

interface ForumComposerProps {
  isPro: boolean;
  communityId?: string;
  isMember?: boolean;
  onPosted: (post: ForumPost) => void;
  /**
   * "inline" (default): the full composer sits in the page.
   * "drawer": a compact "What's new?" row that opens the composer in a bottom drawer.
   */
  variant?: "inline" | "drawer";
}

const PLACEHOLDER = "Share a tip, question or win… Type @ to mention people or communities";

const TOOL_BUTTON =
  "rounded-full p-2 text-neutral-400 transition-[color,background-color,transform] hover:bg-neutral-100 hover:text-neutral-600 active:scale-90 disabled:opacity-30 dark:hover:bg-neutral-800";

export function ForumComposer({ isPro, communityId, isMember, onPosted, variant = "inline" }: ForumComposerProps) {
  const { data: session } = useSession();
  const sheetStyle = useSheetStyle();
  const { requestLocation } = useGeolocation();
  const canPost = communityId ? Boolean(isMember) : isPro;
  const [text, setText] = useState("");
  const [media, setMedia] = useState<{ file: File; preview: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<MentionTextareaHandle>(null);

  function handleFilesSelected(selected: File[]) {
    const room = MAX_FORUM_MEDIA - media.length;
    if (selected.length > room) {
      toast.error(`You can attach up to ${MAX_FORUM_MEDIA} photos or videos.`);
    }
    const accepted: { file: File; preview: string }[] = [];
    for (const file of selected.slice(0, Math.max(room, 0))) {
      const isImage = file.type in ALLOWED_IMAGE_TYPES;
      const isVideo = file.type in ALLOWED_VIDEO_TYPES;
      if (!isImage && !isVideo) {
        toast.error("Only images or videos are allowed.");
        continue;
      }
      const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
      if (file.size > maxBytes) {
        toast.error(`${file.name} is too large — max ${Math.round(maxBytes / (1024 * 1024))}MB.`);
        continue;
      }
      accepted.push({ file, preview: URL.createObjectURL(file) });
    }
    if (accepted.length === 0) return;
    setPollOpen(false);
    setMedia((prev) => [...prev, ...accepted]);
    if (variant === "drawer") setDrawerOpen(true); // picked from the compact row → continue in the drawer
  }

  function removeMedia(index: number) {
    setMedia((prev) => prev.filter((_, i) => i !== index));
  }

  function clearAttachment() {
    setMedia([]);
  }

  /** Uploads one file; null means it failed and the user has been told why. */
  async function uploadMedia(file: File) {
    const signRes = await fetch("/api/uploads/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "forum", contentType: file.type, fileSizeBytes: file.size }),
    });
    const signData = await signRes.json();
    if (!signRes.ok) {
      toast.error(signData?.error?.message ?? "Could not upload file.");
      return null;
    }
    const putRes = await fetch(signData.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!putRes.ok) {
      toast.error("Upload failed. Please try again.");
      return null;
    }
    return { url: signData.publicUrl as string, contentType: file.type };
  }

  function togglePoll() {
    if (!pollOpen) clearAttachment();
    setPollOpen((v) => !v);
  }

  async function toggleLocation() {
    if (location) {
      setLocation(null);
      return;
    }
    setLocating(true);
    // Shared, remembered location: no prompt if it was allowed before.
    const coords = await requestLocation();
    setLocating(false);
    if (coords) setLocation(coords);
    else toast.error("Could not get your location.");
  }

  async function handleSubmit() {
    const trimmed = text.trim();
    const cleanOptions = pollOpen ? pollOptions.map((o) => o.trim()).filter(Boolean) : [];
    if (pollOpen && cleanOptions.length < 2) {
      toast.error("A poll needs at least 2 options.");
      return;
    }
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      const uploaded = await Promise.all(media.map((m) => uploadMedia(m.file)));
      if (uploaded.some((u) => u === null)) return; // keep the draft so they can retry

      const res = await fetch("/api/forum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: trimmed,
          attachments: uploaded.length > 0 ? uploaded : undefined,
          communityId,
          lat: location?.lat,
          lng: location?.lng,
          poll: cleanOptions.length >= 2 ? { options: cleanOptions } : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error?.message ?? "Could not post.");
        return;
      }

      onPosted(data.post);
      setText("");
      clearAttachment();
      setPollOpen(false);
      setPollOptions(["", ""]);
      setLocation(null);
      setDrawerOpen(false);
      void celebrate({
        kind: "posted",
        title: "Posted!",
        subtitle: data.pendingReview
          ? "Your media gets a quick review before others can see it."
          : "Your thread is live in the feed.",
        duration: 2300,
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (communityId && !canPost) {
    return (
      <div className="border-b border-neutral-200 px-4 py-4 text-center text-sm text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
        Join this community to post in it.
      </div>
    );
  }

  const hasDraft = Boolean(text.trim() || media.length > 0 || pollOpen || location);

  /* ── Shared pieces, laid out differently inline vs. in the drawer ── */

  const avatar = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={session?.user?.image ?? "/icons/avatar-placeholder.svg"}
      alt=""
      className="h-9 w-9 shrink-0 rounded-full bg-neutral-100 object-cover dark:bg-neutral-800"
    />
  );

  const extras = (
    <>
      {media.length > 0 && (
        <div data-swipe-zone className="[scrollbar-width:none] [&::-webkit-scrollbar]:hidden mt-2 flex gap-2 overflow-x-auto">
          {media.map((m, i) => (
            <div key={m.preview} className="relative shrink-0 animate-in fade-in zoom-in-95 duration-300">
              {m.file.type.startsWith("video/") ? (
                <video src={m.preview} className="h-48 max-w-[240px] rounded-2xl border border-neutral-200 object-cover dark:border-neutral-700" muted />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.preview} alt={`Attachment ${i + 1} preview`} className="h-48 max-w-[240px] rounded-2xl border border-neutral-200 object-cover dark:border-neutral-700" />
              )}
              <button
                type="button"
                onClick={() => removeMedia(i)}
                className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1 text-white"
                aria-label={`Remove attachment ${i + 1}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {pollOpen && (
        <div className="mt-2 space-y-2 rounded-2xl border border-neutral-200 p-3 animate-in fade-in slide-in-from-top-2 duration-300 dark:border-neutral-700">
          {pollOptions.map((opt, i) => (
            <input
              key={i}
              value={opt}
              maxLength={80}
              onChange={(e) => setPollOptions((prev) => prev.map((o, idx) => (idx === i ? e.target.value : o)))}
              placeholder={`Option ${i + 1}`}
              className="w-full rounded-lg border border-neutral-200 bg-transparent px-2.5 py-1.5 text-sm outline-none animate-in fade-in slide-in-from-top-1 duration-200 dark:border-neutral-700"
            />
          ))}
          <div className="flex items-center justify-between">
            {pollOptions.length < 4 ? (
              <button
                type="button"
                onClick={() => setPollOptions((prev) => [...prev, ""])}
                className="flex items-center gap-1 text-xs font-medium text-brand-600"
              >
                <Plus className="h-3.5 w-3.5" /> Add option
              </button>
            ) : (
              <span />
            )}
            <button type="button" onClick={togglePoll} className="text-xs text-neutral-400 hover:text-neutral-600">
              Remove poll
            </button>
          </div>
        </div>
      )}

      {location && (
        <div className="mt-2 flex items-center gap-1 text-xs text-neutral-400 animate-in fade-in duration-200">
          <MapPin className="h-3.5 w-3.5" /> Location attached
        </div>
      )}
    </>
  );

  const tools = (
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => inputRef.current?.click()} disabled={pollOpen || media.length >= MAX_FORUM_MEDIA} className={TOOL_BUTTON} aria-label="Attach photos or videos">
        <ImageIcon className="h-[18px] w-[18px]" />
      </button>
      <button type="button" onClick={togglePoll} disabled={media.length > 0} className={TOOL_BUTTON} aria-label="Add poll">
        <BarChart3 className={cn("h-[18px] w-[18px]", pollOpen && "text-brand-600")} />
      </button>
      <button type="button" onClick={toggleLocation} className={TOOL_BUTTON} aria-label="Tag location">
        {locating ? (
          <Loader2 className="h-[18px] w-[18px] animate-spin" />
        ) : (
          <MapPin className={cn("h-[18px] w-[18px]", location && "text-brand-600")} />
        )}
      </button>
      <button type="button" onClick={() => editorRef.current?.startMention()} className={TOOL_BUTTON} aria-label="Mention someone">
        <AtSign className="h-[18px] w-[18px]" />
      </button>
      <div className="relative">
        <button type="button" onClick={() => setEmojiOpen((v) => !v)} className={TOOL_BUTTON} aria-label="Emoji">
          <SmilePlus className="h-[18px] w-[18px]" />
        </button>
        <EmojiPopover
          open={emojiOpen}
          onClose={() => setEmojiOpen(false)}
          onSelect={(emoji) => setText((prev) => (prev + emoji).slice(0, MAX_FORUM_TEXT))}
        />
      </div>
    </div>
  );

  const postButton = (
    <button
      type="button"
      onClick={handleSubmit}
      disabled={!text.trim() || submitting}
      className="flex h-8 items-center rounded-full bg-brand-600 px-4 text-sm font-semibold text-white transition-[opacity,transform] active:scale-95 disabled:opacity-40"
    >
      {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Post"}
    </button>
  );

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      multiple
      accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
      className="hidden"
      onChange={(e) => {
        const files = Array.from(e.target.files ?? []);
        if (files.length > 0) handleFilesSelected(files);
        e.target.value = "";
      }}
    />
  );

  if (variant === "inline") {
    return (
      <div className="border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex gap-3 px-4 pt-3">
          {avatar}
          <div className="min-w-0 flex-1">
            <MentionTextarea
              ref={editorRef}
              value={text}
              onChange={setText}
              maxLength={MAX_FORUM_TEXT}
              placeholder={PLACEHOLDER}
              className="pt-1.5"
            />
            {extras}
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-neutral-100 px-4 py-2 dark:border-neutral-800/70">
          {tools}
          <div className="flex items-center gap-3">
            <span className="text-xs text-neutral-400">
              {text.length}/{MAX_FORUM_TEXT}
            </span>
            {postButton}
          </div>
        </div>
        {fileInput}
      </div>
    );
  }

  /* ── Drawer variant: compact "What's new?" row → the same half/full snap sheet the post-a-request drawer uses ── */
  return (
    <>
      <div className="border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center gap-3 px-4 py-3">
          {avatar}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="min-w-0 flex-1 truncate py-1.5 text-left text-[15px] text-neutral-400 transition-opacity active:opacity-60"
          >
            {/* An unfinished post is kept when the sheet closes */}
            {hasDraft ? <span className="text-neutral-200">{text.trim() || "Draft"}</span> : "Share a tip, question or win…"}
          </button>
          {/* Quick actions jump straight into the sheet with that tool ready */}
          <div className="flex items-center">
            <button type="button" onClick={() => inputRef.current?.click()} className={TOOL_BUTTON} aria-label="Attach photo or video">
              <ImageIcon className="h-[18px] w-[18px]" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (!pollOpen) togglePoll();
                setDrawerOpen(true);
              }}
              className={TOOL_BUTTON}
              aria-label="Add poll"
            >
              <BarChart3 className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>
        {fileInput}
      </div>

      <SnapSheet open={drawerOpen} onClose={() => setDrawerOpen(false)} label="New thread" theme={sheetStyle}>
        <div data-swipe-zone className="flex min-h-0 flex-1 flex-col text-white">
          {/* Header: Cancel · title · counter */}
          <div className="flex shrink-0 items-center justify-between px-4 pb-2 pt-1">
            <button type="button" onClick={() => setDrawerOpen(false)} className="text-[15px] text-neutral-300 active:opacity-60">
              Cancel
            </button>
            <p className="text-[16px] font-semibold text-white">New thread</p>
            <span
              className={cn(
                "w-[52px] text-right text-xs tabular-nums",
                text.length > MAX_FORUM_TEXT * 0.9 ? "text-amber-400" : "text-neutral-500",
              )}
            >
              {text.length}/{MAX_FORUM_TEXT}
            </span>
          </div>

          {/* Body: avatar + name, editor (with @ suggestions), attachments */}
          <SheetScrollArea className="border-t border-white/[0.06] px-4 pb-4 pt-3">
            <div className="flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="flex flex-col items-center">
                {avatar}
                <span className="mt-2 w-[2px] flex-1 rounded-full bg-white/10" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-white">{session?.user?.name ?? "You"}</p>
                <MentionTextarea
                  ref={editorRef}
                  value={text}
                  onChange={setText}
                  maxLength={MAX_FORUM_TEXT}
                  placeholder={PLACEHOLDER}
                  rows={4}
                  className="mt-0.5 min-h-[96px] text-[16px]"
                />
                {extras}
              </div>
            </div>
          </SheetScrollArea>

          {/* Toolbar: images, poll, location, @mention, emoji · Post */}
          <div className="flex shrink-0 items-center justify-between border-t border-white/[0.06] px-3 py-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] animate-in fade-in slide-in-from-bottom-3 duration-500">
            {tools}
            {postButton}
          </div>
        </div>
      </SnapSheet>
    </>
  );
}
