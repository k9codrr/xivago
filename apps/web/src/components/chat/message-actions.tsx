"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Copy, Download, Forward, Plus, Reply, Trash2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import EmojiPicker, { Theme } from "emoji-picker-react";

export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

export type MessageAction = "reply" | "copy" | "forward" | "save" | "delete";

interface Props {
  open: boolean;
  /** Where the pressed bubble sits on screen, so the preview lifts out of the same spot. */
  rect: DOMRect | null;
  isMine: boolean;
  myReaction: string | null;
  actions: MessageAction[];
  preview: ReactNode;
  onReact: (emoji: string) => void;
  onAction: (action: MessageAction) => void;
  onClose: () => void;
}

const ACTION_META: Record<MessageAction, { label: string; icon: LucideIcon; danger?: boolean }> = {
  reply: { label: "Reply", icon: Reply },
  copy: { label: "Copy", icon: Copy },
  forward: { label: "Forward", icon: Forward },
  save: { label: "Save to device", icon: Download },
  delete: { label: "Delete for everyone", icon: Trash2, danger: true },
};

const BAR_H = 56;
const MENU_ROW_H = 46;
const GAP = 10;

/**
 * Press-and-hold menu (Telegram / WhatsApp / iMessage): the screen dims and
 * blurs, the held bubble lifts out with a spring, the reaction bar pops in
 * above it and the actions list below it.
 */
export function MessageActions({ open, rect, isMine, myReaction, actions, preview, onReact, onAction, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) setPickerOpen(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  const vh = typeof window !== "undefined" ? (window.visualViewport?.height ?? window.innerHeight) : 800;
  const vw = typeof window !== "undefined" ? window.innerWidth : 400;
  const menuH = actions.length * MENU_ROW_H + 12;
  const previewH = rect ? Math.min(rect.height, vh * 0.42) : 0;
  const topSafe = 56;
  // Keep bar + bubble + menu on screen; move the whole group only as much as needed.
  const desiredTop = rect ? rect.top : vh / 3;
  const minTop = topSafe + BAR_H + GAP;
  const maxTop = vh - menuH - GAP - previewH - 16;
  const top = Math.max(minTop, Math.min(desiredTop, maxTop));
  const side = isMine ? { right: rect ? Math.max(8, vw - rect.right) : 12 } : { left: rect ? Math.max(8, rect.left) : 12 };

  return <>{createPortal(
    <AnimatePresence>
      {open && rect && (
        <motion.div key="msg-actions" className="fixed inset-0 z-[110]" initial={{ opacity: 1 }} exit={{ opacity: 1 }}>
          <motion.div
            className="absolute inset-0 bg-black/55 backdrop-blur-[14px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />

          {/* Reaction bar */}
          <motion.div
            className="absolute flex items-center gap-0.5 rounded-full bg-[#2a2a2e]/95 p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.55)] ring-1 ring-white/10"
            style={{ top: top - BAR_H - GAP + 4, ...side }}
            initial={{ opacity: 0, scale: 0.6, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.7, y: 10 }}
            transition={{ type: "spring", stiffness: 520, damping: 30 }}
          >
            {QUICK_REACTIONS.map((emoji, i) => (
              <motion.button
                key={emoji}
                type="button"
                aria-label={`React ${emoji}`}
                onClick={() => onReact(emoji)}
                initial={{ scale: 0, y: 10 }}
                animate={{ scale: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 600, damping: 20, delay: 0.03 * i }}
                whileTap={{ scale: 1.45 }}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full text-[25px] leading-none transition-colors",
                  myReaction === emoji ? "bg-white/20" : "hover:bg-white/10",
                )}
              >
                {emoji}
              </motion.button>
            ))}
            <div className="relative">
              <motion.button
                type="button"
                aria-label="More reactions"
                onClick={() => setPickerOpen((v) => !v)}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 600, damping: 20, delay: 0.2 }}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/80"
              >
                <Plus className="h-5 w-5" />
              </motion.button>
            </div>
          </motion.div>

          {/* Full emoji picker slides up from the bottom */}
          <AnimatePresence>
            {pickerOpen && (
              <motion.div
                className="absolute inset-x-0 bottom-0 z-10 flex justify-center pb-[max(env(safe-area-inset-bottom),12px)]"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", stiffness: 420, damping: 38 }}
              >
                <EmojiPicker
                  theme={Theme.DARK}
                  lazyLoadEmojis
                  width={Math.min(vw - 16, 420)}
                  height={380}
                  onEmojiClick={(d) => {
                    setPickerOpen(false);
                    onReact(d.emoji);
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Lifted bubble */}
          <motion.div
            className="pointer-events-none absolute overflow-hidden"
            style={{ ...side, width: rect.width, maxHeight: previewH }}
            initial={{ top: rect.top, scale: 1 }}
            animate={{ top, scale: 1.03 }}
            exit={{ top: rect.top, scale: 1, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
          >
            {preview}
          </motion.div>

          {/* Actions */}
          <motion.div
            className="absolute w-[230px] overflow-hidden rounded-2xl bg-[#2a2a2e]/95 py-1.5 shadow-[0_18px_50px_rgba(0,0,0,0.55)] ring-1 ring-white/10"
            style={{ top: top + previewH + GAP + 6, ...side, transformOrigin: isMine ? "top right" : "top left" }}
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 480, damping: 32 }}
          >
            {actions.map((a, i) => {
              const { label, icon: Icon, danger } = ACTION_META[a];
              return (
                <motion.button
                  key={a}
                  type="button"
                  onClick={() => onAction(a)}
                  initial={{ opacity: 0, x: isMine ? 8 : -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.04 + i * 0.03 }}
                  className={cn(
                    "flex w-full items-center justify-between px-4 text-left text-[15px] active:bg-white/10",
                    danger ? "text-[#FF453A]" : "text-white",
                  )}
                  style={{ height: MENU_ROW_H }}
                >
                  {label}
                  <Icon className="h-[18px] w-[18px] opacity-90" />
                </motion.button>
              );
            })}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )}</>;
}
