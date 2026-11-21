"use client";

import { useMemo } from "react";
import { motion } from "motion/react";

const COLORS = ["#f43f5e", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#14b8a6", "#facc15", "#ffffff"];

/** One-shot confetti burst from a point (default: top centre). Pointer-events none; drop it in any relative box. */
export function ConfettiBurst({ count = 48, originY = "18%", className }: { count?: number; originY?: string; className?: string }) {
  const bits = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.25;
        const power = 140 + Math.random() * 220;
        return {
          x: Math.cos(angle) * power,
          y: Math.sin(angle) * power,
          fall: 260 + Math.random() * 260,
          rot: Math.random() * 900 - 450,
          color: COLORS[i % COLORS.length]!,
          w: 5 + Math.random() * 6,
          h: 8 + Math.random() * 9,
          round: Math.random() > 0.65,
          delay: Math.random() * 0.15,
        };
      }),
    [count],
  );
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className ?? ""}`}>
      <div className="absolute left-1/2" style={{ top: originY }}>
        {bits.map((b, i) => (
          <motion.span
            key={i}
            className="absolute"
            style={{ width: b.w, height: b.round ? b.w : b.h, borderRadius: b.round ? 999 : 2, background: b.color }}
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.3 }}
            animate={{ x: [0, b.x, b.x * 1.15], y: [0, b.y, b.y + b.fall], rotate: b.rot, opacity: [1, 1, 0], scale: [0.3, 1, 0.9] }}
            transition={{ duration: 2, delay: b.delay, ease: [0.2, 0.7, 0.4, 1], times: [0, 0.3, 1] }}
          />
        ))}
      </div>
    </div>
  );
}
