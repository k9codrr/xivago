"use client";

import { forwardRef, useCallback, useLayoutEffect, useRef, type KeyboardEvent, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface ComposerTextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value"> {
  value: string;
  onValueChange: (value: string) => void;
  /** Desktop only: Enter sends, Shift+Enter breaks the line. On phones Return always breaks the line — the send button sends. */
  onSubmit?: () => void;
  /** Grows with the text up to this many lines, then scrolls. */
  maxRows?: number;
}

/**
 * Labels the on-screen Return key as a plain "return/new line" key. Passed as
 * the raw DOM attribute because this project's React types predate the prop.
 */
export const ENTER_ADDS_LINE = { enterKeyHint: "enter" } as Record<string, string>;

function isTouchKeyboard(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
}

/**
 * Message/comment box. Starts one line tall and grows as you type. The
 * on-screen Return key adds a new line (enterKeyHint="enter"), never sends.
 */
export const ComposerTextarea = forwardRef<HTMLTextAreaElement, ComposerTextareaProps>(function ComposerTextarea(
  { value, onValueChange, onSubmit, maxRows = 5, className, onKeyDown, ...rest },
  forwardedRef,
) {
  const innerRef = useRef<HTMLTextAreaElement | null>(null);

  const setRefs = useCallback(
    (el: HTMLTextAreaElement | null) => {
      innerRef.current = el;
      if (typeof forwardedRef === "function") forwardedRef(el);
      else if (forwardedRef) forwardedRef.current = el;
    },
    [forwardedRef],
  );

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    el.style.height = "auto";
    const style = window.getComputedStyle(el);
    const line = parseFloat(style.lineHeight) || 20;
    const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    const max = line * maxRows + padding;
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
    el.style.overflowY = el.scrollHeight > max ? "auto" : "hidden";
  }, [value, maxRows]);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && onSubmit && !isTouchKeyboard()) {
      e.preventDefault();
      onSubmit();
    }
  }

  return (
    <textarea
      ref={setRefs}
      rows={1}
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      onKeyDown={handleKeyDown}
      {...ENTER_ADDS_LINE}
      autoComplete="off"
      className={cn("block resize-none", className)}
      {...rest}
    />
  );
});
