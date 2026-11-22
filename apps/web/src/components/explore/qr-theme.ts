"use client";

import { useEffect, useState, useSyncExternalStore, type CSSProperties } from "react";

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

/* ───────── Background images (hero and QR card) ───────── */

/** "none", one of the built-in images below, or "custom" (the user's own photo on this device). */
export type ImageChoice = string;
export const CUSTOM_IMAGE = "custom";

/** Built-in hero images, drawn with CSS so they're sharp on every screen and cost no download. */
export const HERO_IMAGES: { id: string; label: string; css: string }[] = [
  {
    id: "aurora",
    label: "Aurora",
    css: "radial-gradient(120% 70% at 10% 10%, #2dd4bf88, transparent 55%), radial-gradient(90% 60% at 90% 20%, #818cf8aa, transparent 60%), radial-gradient(120% 80% at 50% 110%, #a855f777, transparent 60%), linear-gradient(180deg, #070b1a, #0c1530)",
  },
  {
    id: "sunset",
    label: "Sunset",
    css: "radial-gradient(80% 50% at 50% 95%, #fb923caa, transparent 70%), radial-gradient(120% 70% at 20% 0%, #be185d99, transparent 60%), linear-gradient(180deg, #2a0f2e 0%, #5b1a3a 45%, #a3402a 100%)",
  },
  {
    id: "nebula",
    label: "Nebula",
    css: "radial-gradient(40% 30% at 70% 30%, #f0abfc66, transparent 70%), radial-gradient(60% 45% at 25% 65%, #6366f188, transparent 70%), radial-gradient(1.5px 1.5px at 20% 20%, #fff, transparent), radial-gradient(1px 1px at 80% 70%, #fff, transparent), radial-gradient(1px 1px at 55% 15%, #fff, transparent), linear-gradient(160deg, #050510, #160a2b)",
  },
  {
    id: "mesh",
    label: "Mesh",
    css: "radial-gradient(60% 60% at 0% 0%, #22d3ee99, transparent 60%), radial-gradient(60% 60% at 100% 0%, #f472b699, transparent 60%), radial-gradient(60% 60% at 100% 100%, #facc1577, transparent 60%), radial-gradient(60% 60% at 0% 100%, #4ade8077, transparent 60%), #111827",
  },
  {
    id: "dunes",
    label: "Dunes",
    css: "radial-gradient(140% 50% at 50% 115%, #78350f, transparent 60%), radial-gradient(140% 45% at 30% 95%, #b45309cc, transparent 60%), linear-gradient(180deg, #1e1b4b 0%, #7c2d12 70%, #d97706 100%)",
  },
  {
    id: "holo",
    label: "Holo",
    css: "conic-gradient(from 200deg at 60% 40%, #67e8f9, #a78bfa, #f9a8d4, #fde68a, #67e8f9)",
  },
];

/** Built-in card images: rich enough to look like a photo, dark enough for the QR and label. */
export const CARD_IMAGES: { id: string; label: string; css: string }[] = [
  {
    id: "marble",
    label: "Marble",
    css: "radial-gradient(80% 60% at 20% 20%, #ffffff33, transparent 60%), repeating-linear-gradient(115deg, #ffffff0d 0 2px, transparent 2px 22px), linear-gradient(135deg, #1f2937, #4b5563 60%, #111827)",
  },
  {
    id: "carbon",
    label: "Carbon",
    css: "repeating-linear-gradient(45deg, #ffffff0a 0 4px, transparent 4px 8px), repeating-linear-gradient(-45deg, #0000004d 0 4px, transparent 4px 8px), linear-gradient(160deg, #18181b, #3f3f46)",
  },
  {
    id: "gold",
    label: "Gold",
    css: "radial-gradient(100% 80% at 20% 10%, #fde68a, transparent 55%), linear-gradient(135deg, #78350f, #b45309 40%, #f59e0b 70%, #78350f)",
  },
  {
    id: "ocean",
    label: "Ocean",
    css: "radial-gradient(90% 70% at 80% 90%, #22d3ee88, transparent 60%), radial-gradient(70% 60% at 10% 10%, #1e3a8a, transparent 70%), linear-gradient(160deg, #0c4a6e, #0e7490)",
  },
  {
    id: "flame",
    label: "Flame",
    css: "radial-gradient(90% 70% at 50% 110%, #facc15, transparent 60%), radial-gradient(90% 70% at 30% 70%, #f97316cc, transparent 60%), linear-gradient(180deg, #450a0a, #b91c1c)",
  },
  {
    id: "prism",
    label: "Prism",
    css: "conic-gradient(from 120deg at 30% 30%, #a78bfa, #38bdf8, #34d399, #fbbf24, #f472b6, #a78bfa)",
  },
];

/* Custom photos live in their own localStorage keys (downscaled JPEG data URLs) so the
   theme stays tiny, and every QrCard / hero on the page re-renders when one changes. */
const CUSTOM_KEYS = { hero: "xivago:qr-hero-image", card: "xivago:qr-card-image" } as const;
export type ImageSlot = keyof typeof CUSTOM_KEYS;
const CUSTOM_EVENT = "xivago:qr-image-change";
const customCache: Record<ImageSlot, string | null | undefined> = { hero: undefined, card: undefined };

function readCustom(slot: ImageSlot): string | null {
  const cached = customCache[slot];
  if (cached !== undefined) return cached;
  let value: string | null = null;
  try {
    value = window.localStorage.getItem(CUSTOM_KEYS[slot]);
  } catch {
    value = null;
  }
  customCache[slot] = value;
  return value;
}

function subscribeCustom(cb: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === CUSTOM_KEYS.hero || e.key === CUSTOM_KEYS.card) {
      customCache.hero = undefined;
      customCache.card = undefined;
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CUSTOM_EVENT, cb);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CUSTOM_EVENT, cb);
  };
}

/** The user's own photo for the hero or the card, or null. */
export function useCustomImage(slot: ImageSlot): string | null {
  return useSyncExternalStore(subscribeCustom, () => readCustom(slot), () => null);
}

/** Saves (or with null, removes) the user's photo. Returns false when the device is out of storage. */
export function setCustomImage(slot: ImageSlot, dataUrl: string | null): boolean {
  try {
    if (dataUrl) window.localStorage.setItem(CUSTOM_KEYS[slot], dataUrl);
    else window.localStorage.removeItem(CUSTOM_KEYS[slot]);
  } catch {
    return false;
  }
  customCache[slot] = dataUrl;
  window.dispatchEvent(new Event(CUSTOM_EVENT));
  return true;
}

/** Downscales a picked photo to a JPEG data URL that fits comfortably in localStorage. */
export async function imageFileToDataUrl(file: File, maxEdge: number): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not read that image"));
      el.src = url;
    });
    const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not read that image");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** CSS `background` for an image choice, or null for "none" / a missing custom photo. */
export function imageBackground(choice: ImageChoice | undefined, slot: ImageSlot, custom: string | null): string | null {
  if (!choice || choice === "none") return null;
  if (choice === CUSTOM_IMAGE) return custom ? `center / cover no-repeat url("${custom}")` : null;
  const list = slot === "hero" ? HERO_IMAGES : CARD_IMAGES;
  return list.find((i) => i.id === choice)?.css ?? null;
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
  /** Image behind the whole hero (over the backdrop colour). "none" keeps the plain backdrop. */
  heroImage?: ImageChoice;
  /** Image on the QR card itself, replacing its colour fill. */
  cardImage?: ImageChoice;
}

export const PRESETS: { id: string; label: string; theme: QrTheme }[] = [
  { id: "noir", label: "Noir", theme: { backdrop: "graphite", pattern: "checker", fill: "amber", border: "rim", borderTone: "white", label: true } },
  { id: "neon", label: "Neon", theme: { backdrop: "plum", pattern: "pixels", fill: "violet", border: "rim", borderTone: "accent", label: true } },
  { id: "lagoon", label: "Lagoon", theme: { backdrop: "forest", pattern: "waves", fill: "teal", border: "rim", borderTone: "white", label: true } },
  { id: "sunset", label: "Sunset", theme: { backdrop: "ember", pattern: "diagonal", fill: "rose", border: "full", borderTone: "gold", label: true } },
  { id: "blueprint", label: "Blueprint", theme: { backdrop: "ocean", pattern: "grid", fill: "sky", border: "rim", borderTone: "white", label: true } },
  { id: "studio", label: "Studio", theme: { backdrop: "midnight", pattern: "dots", fill: "mono", border: "rim", borderTone: "white", label: false } },
  { id: "aurora", label: "Aurora", theme: { backdrop: "midnight", pattern: "none", fill: "teal", border: "rim", borderTone: "white", label: true, heroImage: "aurora", cardImage: "ocean" } },
  { id: "golden", label: "Golden hour", theme: { backdrop: "ember", pattern: "none", fill: "amber", border: "full", borderTone: "gold", label: true, heroImage: "sunset", cardImage: "gold" } },
  { id: "cosmos", label: "Cosmos", theme: { backdrop: "plum", pattern: "none", fill: "violet", border: "rim", borderTone: "accent", label: true, heroImage: "nebula", cardImage: "prism" } },
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
  const validImage = (v: unknown, list: { id: string }[]) =>
    typeof v === "string" && (v === "none" || v === CUSTOM_IMAGE || list.some((i) => i.id === v)) ? v : "none";
  t.heroImage = validImage(t.heroImage, HERO_IMAGES);
  t.cardImage = validImage(t.cardImage, CARD_IMAGES);
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
