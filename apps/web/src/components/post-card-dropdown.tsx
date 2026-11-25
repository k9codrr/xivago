"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Bookmark, Flag, Maximize2, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHaptic } from "@/components/ui/haptic";
import { toast } from "sonner";

interface PostCardDropdownProps {
  demandId: string;
  onViewFull: () => void;
}

const MENU_ITEMS = [
  { id: "save", icon: Bookmark, label: "Save post" },
  { id: "report", icon: Flag, label: "Report post" },
  { id: "view", icon: Maximize2, label: "View full" },
  { id: "share", icon: Share2, label: "Share post" },
] as const;

export function PostCardDropdown({ demandId, onViewFull }: PostCardDropdownProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const tap = useHaptic("light");

  useEffect(() => setMounted(true), []);

  function handleAction(id: string) {
    tap();
    setOpen(false);
    switch (id) {
      case "save":
        fetch("/api/bookmarks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ demandId }),
        })
          .then((res) => {
            if (!res.ok) throw new Error();
            toast.success("Post saved");
          })
          .catch(() => toast.error("Sign in to save posts"));
        break;
      case "report":
        fetch(`/api/demands/${demandId}/report`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target: "DEMAND", reason: "Spam or duplicate" }),
        })
          .then(async (res) => {
            const data = await res.json().catch(() => null);
            if (!res.ok) {
              toast.error(data?.error?.message ?? "Could not report post");
              return;
            }
            toast.success(data?.message ?? "Post reported");
          })
          .catch(() => toast.error("Could not report post"));
        break;
      case "view":
        onViewFull();
        break;
      case "share":
        if (navigator.share) {
          void navigator.share({
            title: "Check out this post on Xivago",
            url: `${window.location.origin}/demands/${demandId}`,
          });
        } else {
          void navigator.clipboard.writeText(`${window.location.origin}/demands/${demandId}`);
          toast.success("Link copied!");
        }
        break;
    }
  }

  if (!mounted) return null;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          tap();
          setOpen(true);
        }}
        className="flex shadow-[inset_0_-8px_10px_#ffffff1f] h-9 w-10 shrink-0 items-center justify-center border rounded-[9px] text-white/80"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {<>{createPortal(
        <AnimatePresence>
          {open && (
            <>
              <motion.div
                className="fixed inset-0 z-[70] bg-black/40"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setOpen(false)}
              />
              <motion.div
                className="fixed inset-x-4 bottom-[max(env(safe-area-inset-bottom),1.5rem)] z-[71] mx-auto max-w-md"
                initial={{ y: 60, opacity: 0, scale: 0.92 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: 60, opacity: 0, scale: 0.92 }}
                transition={{ type: "spring", stiffness: 420, damping: 38 }}
              >
                <div
                  className="overflow-hidden rounded-[20px]"
                  style={{
                    background:
                      "linear-gradient(180deg, rgb(255 255 255 / 0.14) 0%, rgb(255 255 255 / 0.06) 45%, rgb(255 255 255 / 0.03) 100%), rgb(28 28 30 / 0.75)",
                    backdropFilter: "blur(50px) saturate(200%) brightness(1.05)",
                    WebkitBackdropFilter: "blur(50px) saturate(200%) brightness(1.05)",
                    boxShadow:
                      "inset 0 1px 0.5px rgb(255 255 255 / 0.4), inset 0 -1px 0.5px rgb(255 255 255 / 0.08), 0 24px 60px rgb(0 0 0 / 0.5), 0 0 0 0.5px rgb(255 255 255 / 0.15)",
                  }}
                >
                  {MENU_ITEMS.map((item, i) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAction(item.id);
                      }}
                      className={cn(
                        "flex w-full items-center gap-3.5 px-5 py-3.5 text-left text-white transition-colors active:bg-white/10",
                        i < MENU_ITEMS.length - 1 && "border-b border-white/[0.08]",
                      )}
                    >
                      <item.icon className="h-[18px] w-[18px] text-white/70" />
                      <span className="text-[16px] font-medium">{item.label}</span>
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(false);
                  }}
                  className="mt-2 flex w-full items-center justify-center rounded-[16px] py-3.5 text-[16px] font-semibold text-white active:opacity-70"
                  style={{
                    background:
                      "linear-gradient(180deg, rgb(255 255 255 / 0.12) 0%, rgb(255 255 255 / 0.06) 100%), rgb(28 28 30 / 0.80)",
                    backdropFilter: "blur(50px) saturate(200%)",
                    WebkitBackdropFilter: "blur(50px) saturate(200%)",
                    boxShadow: "0 0 0 0.5px rgb(255 255 255 / 0.12)",
                  }}
                >
                  Cancel
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body,
      )}</>}
    </>
  );
}
