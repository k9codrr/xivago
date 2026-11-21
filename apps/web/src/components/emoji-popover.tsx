"use client";

import EmojiPicker, { Theme } from "emoji-picker-react";

interface EmojiPopoverProps {
  open: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
  /** Positions the panel relative to the trigger -- chat bubbles need it to flip sides. */
  align?: "left" | "right";
}

/** Full emoji picker, used for both message reactions and composing. Backed
 * by `emoji-picker-react` rather than the old hardcoded 6-emoji set. */
export function EmojiPopover({ open, onClose, onSelect, align = "left" }: EmojiPopoverProps) {
  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className={`absolute z-40 bottom-full mb-2 ${align === "right" ? "right-0" : "left-0"}`}>
        <EmojiPicker
          theme={Theme.DARK}
          onEmojiClick={(data) => {
            onSelect(data.emoji);
          }}
          lazyLoadEmojis
          height={360}
          width={300}
        />
      </div>
    </>
  );
}
