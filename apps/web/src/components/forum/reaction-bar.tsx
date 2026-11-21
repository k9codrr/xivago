"use client";

import { useState, useRef, useEffect } from "react";
import { Heart } from "lucide-react";
import { FORUM_REACTIONS } from "@/lib/validation/forum";
import { cn } from "@/lib/utils";
import { formatCount } from "@/lib/format-count";

interface ReactionBarProps {
  counts: Record<string, number>;
  total: number;
  myReaction: string | null;
  onReact: (emoji: string) => void;
  onRemove: () => void;
}

export function ReactionBar({ counts: _counts, total, myReaction, onReact, onRemove }: ReactionBarProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setPickerOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div className="relative flex items-center" ref={ref}>
      <button
        type="button"
        onClick={() => (myReaction ? onRemove() : setPickerOpen((v) => !v))}
        className={cn(
          "flex items-center gap-1.5 transition-colors",
          myReaction ? "text-red-500" : "text-neutral-400 hover:text-red-500",
        )}
      >
        {myReaction ? (
          <span className="text-base leading-none">{myReaction}</span>
        ) : (
          <Heart className="h-[18px] w-[18px]" />
        )}
        {total > 0 && <span className="text-xs tabular-nums">{formatCount(total)}</span>}
      </button>

      {pickerOpen && (
        <div className="absolute bottom-full left-0 z-20 mb-1 flex gap-1 rounded-full border border-neutral-200 bg-white px-2 py-1.5 shadow-lg dark:border-neutral-700 dark:bg-neutral-800">
          {FORUM_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                onReact(emoji);
                setPickerOpen(false);
              }}
              className="rounded-full p-1 text-lg transition-transform hover:scale-125"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}