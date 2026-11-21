"use client";

import { useEffect, useState, type CSSProperties } from "react";

/* ───────── Patterns (hero background + the halo right behind the QR card) ───────── */

export type PatternId = "checker" | "dots" | "grid" | "diagonal" | "waves" | "plus" | "pixels" | "none";

const svg = (body: string, size: number) =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 ${size} ${size}'>${body}</svg>`,
  )}")`;

/** Pixel squares in a fixed pseudo-random layout -- reads as "QR code" at a glance. */
function pixelBody(c: string) {
  let out = "";
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) if ((x * 7 + y * 13 + x * y) % 5 < 2) out += `<rect x='${x * 8}' y='${y * 8}' width='8' height='8' fill='${c}'/>`;
  return out;
}

export function patternStyle(id: PatternId, color: string): CSSProperties {
  switch (id) {
    case "checker":
      return {
        backgroundImage: `conic-gradient(${color} 25%, transparent 0 50%, ${color} 0 75%, transparent 0)`,
        backgroundSize: "56px 56px",
      };
    case "dots":
      return { backgroundImage: `radial-gradient(${color} 1.6px, transparent 1.8px)`, backgroundSize: "16px 16px" };
    case "grid":
      return {
        backgroundImage: `linear-gradient(${color} 1px, transparent 1px), linear-gradient(90deg, ${color} 1px, transparent 1px)`,
        backgroundSize: "26px 26px",
      };
    case "diagonal":
      return { backgroundImage: `repeating-linear-gradient(45deg, ${color} 0 2px, transparent 2px 14px)` };
    case "waves":
      return {
        backgroundImage: svg(`<path d='M0 20 Q10 10 20 20 T40 20' fill='none' stroke='${color}' stroke-width='2'/>`, 40),
        backgroundSize: "40px 22px",
      };
    case "plus":
      return {
        backgroundImage: svg(`<path d='M14 8v12M8 14h12' stroke='${color}' stroke-width='2' stroke-linecap='round'/>`, 28),
        backgroundSize: "28px 28px",
      };
    case "pixels":
      return { backgroundImage: svg(pixelBody(color), 64), backgroundSize: "64px 64px" };
    case "none":
      return {};
  }
}

export const PATTERNS: { id: PatternId; label: string }[] = [
  { id: "checker", label: "Checker" },
  { id: "pixels", label: "Pixels" },
  { id: "dots", label: "Dots" },
  { id: "grid", label: "Grid" },
  { id: "diagonal", label: "Lines" },
  { id: "waves", label: "Waves" },
  { id: "plus", label: "Plus" },
  { id: "none", label: "None" },
];

/* ───────── Hero backdrops ───────── */

export type BackdropId = "graphite" | "midnight" | "plum" | "forest" | "ember" | "ocean";

export const BACKDROPS: Record<BackdropId, { label: string; base: string; ink: string; glow: string }> = {
  graphite: { label: "Graphite", base: "#232325", ink: "rgba(255,255,255,0.055)", glow: "rgba(255,255,255,0.10)" },
  midnight: { label: "Midnight", base: "#10142a", ink: "rgba(129,140,248,0.10)", glow: "rgba(99,102,241,0.35)" },
  plum: { label: "Plum", base: "#1d0f33", ink: "rgba(196,181,253,0.09)", glow: "rgba(168,85,247,0.35)" },
  forest: { label: "Forest", base: "#0d2220", ink: "rgba(94,234,212,0.08)", glow: "rgba(20,184,166,0.30)" },
  ember: { label: "Ember", base: "#26140c", ink: "rgba(253,186,116,0.08)", glow: "rgba(249,115,22,0.32)" },
  ocean: { label: "Ocean", base: "#0b1b2b", ink: "rgba(125,211,252,0.09)", glow: "rgba(14,165,233,0.32)" },
};

/* ───────── QR card fills ───────── */

export type CardFillId = "amber" | "violet" | "teal" | "rose" | "mono" | "lime" | "sky";

export const CARD_FILLS: Record<CardFillId, { label: string; from: string; to: string; qr: string; accent: string }> = {
  amber: { label: "Amber", from: "#3a3634", to: "#c2650f", qr: "rgba(255,255,255,0.13)", accent: "#f59e0b" },
  violet: { label: "Violet", from: "#2a2440", to: "#7c3aed", qr: "rgba(255,255,255,0.14)", accent: "#a78bfa" },
  teal: { label: "Teal", from: "#14302f", to: "#0d9488", qr: "rgba(255,255,255,0.14)", accent: "#2dd4bf" },
  rose: { label: "Rose", from: "#35222a", to: "#e11d48", qr: "rgba(255,255,255,0.13)", accent: "#fb7185" },
  mono: { label: "Mono", from: "#2a2a2c", to: "#6b6b70", qr: "rgba(255,255,255,0.15)", accent: "#e5e5e5" },
  lime: { label: "Lime", from: "#22291a", to: "#65a30d", qr: "rgba(255,255,255,0.13)", accent: "#a3e635" },
  sky: { label: "Sky", from: "#18263a", to: "#0284c7", qr: "rgba(255,255,255,0.14)", accent: "#38bdf8" },
};

/* ───────── Card border ───────── */

/** "rim" = Apple-icon style: lit at the top-left and bottom-right corners, fading out halfway. */
export type BorderStyleId = "rim" | "full" | "none";
export type BorderToneId = "white" | "gold" | "accent";

export const BORDER_STYLES: { id: BorderStyleId; label: string }[] = [
  { id: "rim", label: "Corners" },
  { id: "full", label: "Full" },
  { id: "none", label: "None" },
];

export const BORDER_TONES: { id: BorderToneId; label: string }[] = [
  { id: "white", label: "Silver" },
  { id: "gold", label: "Gold" },
  { id: "accent", label: "Match" },
];

export function borderColor(tone: BorderToneId, fill: CardFillId) {
  if (tone === "gold") return "#f5d27a";
  if (tone === "accent") return CARD_FILLS[fill].accent;
  return "rgba(255,255,255,0.9)";
}

/* ───────── Theme + presets ───────── */

export interface QrTheme {
  backdrop: BackdropId;
  pattern: PatternId;
  fill: CardFillId;
  border: BorderStyleId;
  borderTone: BorderToneId;
  /** true: big "Scan & Sell" art over a dimmed QR; false: clean, scannable QR plate. */
  label: boolean;
}

export const PRESETS: { id: string; label: string; theme: QrTheme }[] = [
  { id: "noir", label: "Noir", theme: { backdrop: "graphite", pattern: "checker", fill: "amber", border: "rim", borderTone: "white", label: true } },
  { id: "neon", label: "Neon", theme: { backdrop: "plum", pattern: "pixels", fill: "violet", border: "rim", borderTone: "accent", label: true } },
  { id: "lagoon", label: "Lagoon", theme: { backdrop: "forest", pattern: "waves", fill: "teal", border: "rim", borderTone: "white", label: true } },
  { id: "sunset", label: "Sunset", theme: { backdrop: "ember", pattern: "diagonal", fill: "rose", border: "full", borderTone: "gold", label: true } },
  { id: "blueprint", label: "Blueprint", theme: { backdrop: "ocean", pattern: "grid", fill: "sky", border: "rim", borderTone: "white", label: true } },
  { id: "studio", label: "Studio", theme: { backdrop: "midnight", pattern: "dots", fill: "mono", border: "rim", borderTone: "white", label: false } },
];

export const DEFAULT_THEME: QrTheme = PRESETS[0]!.theme;

const STORAGE_KEY = "xivago:qr-theme";

function sanitize(raw: unknown): QrTheme {
  const t = { ...DEFAULT_THEME, ...(typeof raw === "object" && raw ? raw : {}) } as QrTheme;
  if (!(t.backdrop in BACKDROPS)) t.backdrop = DEFAULT_THEME.backdrop;
  if (!PATTERNS.some((p) => p.id === t.pattern)) t.pattern = DEFAULT_THEME.pattern;
  if (!(t.fill in CARD_FILLS)) t.fill = DEFAULT_THEME.fill;
  if (!BORDER_STYLES.some((b) => b.id === t.border)) t.border = DEFAULT_THEME.border;
  if (!BORDER_TONES.some((b) => b.id === t.borderTone)) t.borderTone = DEFAULT_THEME.borderTone;
  t.label = typeof t.label === "boolean" ? t.label : DEFAULT_THEME.label;
  return t;
}

/** The QR card look is a per-device preference, so it lives in localStorage. */
export function useQrTheme(): [QrTheme, (t: QrTheme) => void] {
  const [theme, setTheme] = useState<QrTheme>(DEFAULT_THEME);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setTheme(sanitize(JSON.parse(saved)));
    } catch {
      /* storage unavailable or corrupt -- keep the default */
    }
  }, []);
  const update = (t: QrTheme) => {
    setTheme(t);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(t));
    } catch {
      /* storage unavailable */
    }
  };
  return [theme, update];
}
