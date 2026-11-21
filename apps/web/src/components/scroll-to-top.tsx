"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUp } from "lucide-react";
import { haptic } from "@/lib/haptics";

/**
 * Floating "back to top" pill: appears once you've scrolled a couple of
 * screens down (and you're scrolling up, like Instagram / X), glides the
 * page back to the top with a light haptic.
 */
export function ScrollToTop({
  threshold = 1200,
  label = "Top",
  path,
}: {
  threshold?: number;
  label?: string;
  /** Tabs stay mounted in the background: only show while this route is the one on screen. */
  path?: string;
}) {
  const pathname = usePathname();
  const [show, setShow] = useState(false);
  const active = !path || pathname === path;

  useEffect(() => {
    let lastY = window.scrollY;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        const goingUp = y < lastY - 4;
        const goingDown = y > lastY + 4;
        if (y < threshold) setShow(false);
        else if (goingUp) setShow(true);
        else if (goingDown) setShow(false);
        lastY = y;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, [threshold]);

  return (
    <AnimatePresence>
      {show && active && (
        <div key="scroll-top" className="pointer-events-none fixed inset-x-0 top-[max(env(safe-area-inset-top),12px)] z-[45] flex justify-center">
        <motion.button
          type="button"
          aria-label="Scroll to top"
          onClick={() => {
            void haptic("light");
            window.scrollTo({ top: 0, behavior: "smooth" });
            setShow(false);
          }}
          initial={{ opacity: 0, y: -24, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -24, scale: 0.8 }}
          whileTap={{ scale: 0.92 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-[#0A84FF] px-4 py-2 text-[13px] font-semibold text-white shadow-[0_8px_24px_rgba(10,132,255,0.45)]"
        >
          <ArrowUp className="h-4 w-4" strokeWidth={2.6} />
          {label}
        </motion.button>
        </div>
      )}
    </AnimatePresence>
  );
}
