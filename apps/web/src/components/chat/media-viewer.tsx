"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, type PanInfo } from "motion/react";
import { ChevronLeft, ChevronRight, Download, Share2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ViewerItem {
  id: string;
  url: string;
  contentType: string;
  caption?: string;
  meta?: string;
}

/**
 * Full-screen photo / video viewer (WhatsApp / Telegram style): swipe left /
 * right between everything shared in the chat, swipe down or tap ✕ to close,
 * tap the photo to hide the chrome, save or share from the top bar.
 */
export function MediaViewer({
  items,
  index,
  onIndexChange,
  onClose,
}: {
  items: ViewerItem[];
  index: number | null;
  onIndexChange: (i: number) => void;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [chrome, setChrome] = useState(true);
  const [dir, setDir] = useState(0);
  useEffect(() => setMounted(true), []);

  const open = index !== null && items[index] !== undefined;
  const item = open ? items[index!] : null;

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index]);

  function go(step: number) {
    if (index === null) return;
    const next = index + step;
    if (next < 0 || next >= items.length) return;
    setDir(step);
    onIndexChange(next);
  }

  function onDragEnd(_: unknown, info: PanInfo) {
    const { offset, velocity } = info;
    if (Math.abs(offset.y) > Math.abs(offset.x)) {
      if (offset.y > 120 || velocity.y > 700) onClose();
      return;
    }
    if (offset.x < -80 || velocity.x < -500) go(1);
    else if (offset.x > 80 || velocity.x > 500) go(-1);
  }

  async function share() {
    if (!item) return;
    try {
      if (navigator.share) await navigator.share({ url: item.url });
      else {
        await navigator.clipboard.writeText(item.url);
      }
    } catch {
      // dismissed
    }
  }

  if (!mounted) return null;

  return <>{createPortal(
    <AnimatePresence>
      {open && item && (
        <motion.div
          className="fixed inset-0 z-[120] flex flex-col bg-black"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          role="dialog"
          aria-modal="true"
          aria-label="Media viewer"
        >
          {/* Top bar */}
          <motion.div
            animate={{ opacity: chrome ? 1 : 0, y: chrome ? 0 : -16 }}
            className="absolute inset-x-0 top-0 z-10 flex items-center gap-2 bg-gradient-to-b from-black/80 to-transparent px-2 pb-6 pt-[max(env(safe-area-inset-top),0.5rem)]"
          >
            <button type="button" onClick={onClose} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-full text-white active:bg-white/10">
              <X className="h-6 w-6" />
            </button>
            <div className="min-w-0 flex-1">
              {item.meta && <p className="truncate text-[13px] text-white/70">{item.meta}</p>}
              {items.length > 1 && (
                <p className="text-[12px] text-white/50">
                  {index! + 1} of {items.length}
                </p>
              )}
            </div>
            <button type="button" onClick={share} aria-label="Share" className="flex h-11 w-11 items-center justify-center rounded-full text-white active:bg-white/10">
              <Share2 className="h-5 w-5" />
            </button>
            <a
              href={item.url}
              download
              target="_blank"
              rel="noreferrer noopener"
              aria-label="Save"
              className="flex h-11 w-11 items-center justify-center rounded-full text-white active:bg-white/10"
            >
              <Download className="h-5 w-5" />
            </a>
          </motion.div>

          {/* Stage */}
          <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
            <AnimatePresence initial={false} custom={dir} mode="popLayout">
              <motion.div
                key={item.id}
                custom={dir}
                initial={{ x: dir > 0 ? "100%" : dir < 0 ? "-100%" : 0, opacity: dir === 0 ? 0 : 1, scale: dir === 0 ? 0.92 : 1 }}
                animate={{ x: 0, opacity: 1, scale: 1 }}
                exit={{ x: dir > 0 ? "-100%" : "100%", opacity: 1 }}
                transition={{ type: "spring", stiffness: 380, damping: 38 }}
                drag
                dragSnapToOrigin
                dragElastic={0.6}
                onDragEnd={onDragEnd}
                onClick={() => setChrome((c) => !c)}
                className="flex h-full w-full items-center justify-center"
              >
                {item.contentType.startsWith("video/") ? (
                  <video
                    src={item.url}
                    controls
                    autoPlay
                    playsInline
                    className="max-h-full max-w-full"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.url} alt={item.caption ?? ""} draggable={false} className="max-h-full max-w-full select-none object-contain" />
                )}
              </motion.div>
            </AnimatePresence>

            {items.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => go(-1)}
                  disabled={index === 0}
                  aria-label="Previous"
                  className={cn("absolute left-2 hidden h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur disabled:opacity-0 sm:flex", !chrome && "opacity-0")}
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  type="button"
                  onClick={() => go(1)}
                  disabled={index === items.length - 1}
                  aria-label="Next"
                  className={cn("absolute right-2 hidden h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur disabled:opacity-0 sm:flex", !chrome && "opacity-0")}
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            )}
          </div>

          {item.caption && (
            <motion.p
              animate={{ opacity: chrome ? 1 : 0 }}
              className="absolute inset-x-0 bottom-0 max-h-[30vh] overflow-y-auto bg-gradient-to-t from-black/85 to-transparent px-5 pb-[max(env(safe-area-inset-bottom),1rem)] pt-8 text-[15px] leading-5 text-white [overflow-wrap:anywhere]"
            >
              {item.caption}
            </motion.p>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )}</>;
}
