"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Share2 } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { playSound } from "@/lib/sounds";
import { haptic } from "@/lib/haptics";
import { PresenceAvatar } from "@/components/chat/chat-primitives";

interface ProfileQrModalProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  name: string;
}

interface Scan {
  at: string;
  by: { id: string; name: string; avatarUrl: string | null };
}

const POLL_MS = 2500;

/** Every profile has a shareable QR encoding its canonical URL -- scanned
 * via the Explore page scanner (see qr-scanner-modal.tsx) on another device.
 * While it's open we watch for scans: the moment someone scans it, the code
 * pulses green, a tick pops in and "Scanned by …" slides up (with sound). */
export function ProfileQrModal({ open, onClose, userId, name }: ProfileQrModalProps) {
  const [url, setUrl] = useState("");
  const [scan, setScan] = useState<Scan | null>(null);
  const sinceRef = useRef(new Date().toISOString());

  useEffect(() => {
    setUrl(`${window.location.origin}/u/${userId}`);
  }, [userId]);

  useEffect(() => {
    if (!open) return;
    sinceRef.current = new Date().toISOString();
    setScan(null);
    let cancelled = false;
    let clearTimer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/api/qr-scans?since=${encodeURIComponent(sinceRef.current)}`);
        if (!res.ok || cancelled) return;
        const { scans } = (await res.json()) as { scans: Scan[] };
        const latest = scans[0];
        if (!latest) return;
        sinceRef.current = latest.at;
        setScan(latest);
        playSound("scan");
        void haptic("success");
        if (clearTimer) clearTimeout(clearTimer);
        clearTimer = setTimeout(() => !cancelled && setScan(null), 4500);
      } catch {
        // offline: try again next tick
      }
    };
    const interval = setInterval(() => void tick(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
      if (clearTimer) clearTimeout(clearTimer);
    };
  }, [open]);

  async function handleShare() {
    try {
      if (navigator.share) {
        await navigator.share({ title: name, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch {
      // user cancelled the share sheet -- not an error
    }
  }

  const scanned = scan !== null;

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="border-neutral-800 bg-[#0a0a0a] text-white max-w-md mx-auto rounded-t-3xl p-5">
        <DrawerHeader className="px-0 pt-0 text-center">
          <DrawerTitle className="text-lg font-bold text-white">Your QR Code</DrawerTitle>
          <DrawerDescription className="text-xs text-neutral-400">
            Let people scan this to view your profile.
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          <div className="relative">
            {/* Scan pulse rings */}
            <AnimatePresence>
              {scanned &&
                [0, 1, 2].map((i) => (
                  <motion.span
                    key={`${scan.at}-${i}`}
                    aria-hidden
                    className="absolute inset-0 rounded-3xl border-[3px] border-[#22C55E]"
                    initial={{ scale: 1, opacity: 0.9 }}
                    animate={{ scale: 1.35, opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.2, delay: i * 0.22, ease: "easeOut" }}
                  />
                ))}
            </AnimatePresence>

            <motion.div
              className="relative overflow-hidden rounded-2xl bg-white p-4"
              animate={
                scanned
                  ? { scale: [1, 0.94, 1.04, 1], boxShadow: "0 0 0 4px #22C55E, 0 20px 60px rgba(34,197,94,0.45)" }
                  : { scale: 1, boxShadow: "0 0 0 0px rgba(34,197,94,0)" }
              }
              transition={{ duration: 0.6 }}
            >
              {url && <QRCodeSVG value={url} size={220} />}

              {/* Idle: a soft scan line sweeps so it reads as "live" */}
              {!scanned && (
                <motion.span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-3 h-8 rounded-full bg-gradient-to-b from-transparent via-[#0A84FF]/25 to-transparent"
                  initial={{ top: "0%" }}
                  animate={{ top: ["0%", "85%", "0%"] }}
                  transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
                />
              )}

              {/* Scanned: green wash + tick */}
              <AnimatePresence>
                {scanned && (
                  <motion.div
                    key={scan.at}
                    className="absolute inset-0 flex items-center justify-center bg-[#22C55E]/85 backdrop-blur-[2px]"
                    initial={{ clipPath: "circle(0% at 50% 50%)" }}
                    animate={{ clipPath: "circle(75% at 50% 50%)" }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5, ease: [0.65, 0, 0.35, 1] }}
                  >
                    <motion.span
                      className="flex h-20 w-20 items-center justify-center rounded-full bg-white"
                      initial={{ scale: 0, rotate: -60 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 420, damping: 16, delay: 0.2 }}
                    >
                      <Check className="h-10 w-10 text-[#16A34A]" strokeWidth={3.5} />
                    </motion.span>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>

          <div className="relative h-10 w-full">
            <AnimatePresence mode="wait">
              {scanned ? (
                <motion.div
                  key="by"
                  className="absolute inset-0 flex items-center justify-center gap-2"
                  initial={{ y: 14, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -10, opacity: 0 }}
                >
                  <PresenceAvatar id={scan.by.id} name={scan.by.name} src={scan.by.avatarUrl} size={28} />
                  <span className="text-sm font-semibold text-[#22C55E]">Scanned by {scan.by.name}</span>
                </motion.div>
              ) : (
                <motion.p key="name" className="absolute inset-0 text-center text-sm font-semibold leading-10 text-white" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {name}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <button
            type="button"
            onClick={handleShare}
            className="flex items-center gap-2 rounded-full bg-amber-400 px-5 py-2.5 text-sm font-bold text-black"
          >
            <Share2 className="h-4 w-4" /> Share
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
