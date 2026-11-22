"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUp } from "lucide-react";
import { haptic } from "@/lib/haptics";

/**
 * Floating "back to top" button in the bottom-right corner, just above the
 * bottom nav: appears once you've scrolled a couple of screens down (and
 * you're scrolling up, like Instagram / X), glides the page back to the top
 * with a light haptic.
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
        // Bottom nav is ~76px tall plus the safe area; sit 16px above it.
        <div
          key="scroll-top"
          className="pointer-events-none fixed inset-x-0 z-[45] mx-auto flex max-w-md justify-end px-4"
          style={{ bottom: "calc(max(env(safe-area-inset-bottom), 0.75rem) + 92px)" }}
        >
        <motion.button
          type="button"
          aria-label="Scroll to top"
          onClick={() => {
            void haptic("light");
            window.scrollTo({ top: 0, behavior: "smooth" });
            setShow(false);
          }}
          initial={{ opacity: 0, y: 24, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.8 }}
          whileTap={{ scale: 0.92 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          title={label}
          className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#0A84FF] text-white shadow-[0_8px_24px_rgba(10,132,255,0.45)] ring-1 ring-white/15"
        >
          <ArrowUp className="h-5 w-5" strokeWidth={2.6} />
        </motion.button>
        </div>
      )}
    </AnimatePresence>
  );
}
