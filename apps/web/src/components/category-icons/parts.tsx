import * as React from "react";
import { HEART, oval, ring, type Kit, type Mat } from "./kit";

/** One design: its name (alt text / settings label) and how to draw it on the 64x64 grid. */
export type Design = [label: string, draw: (k: Kit) => React.ReactNode];

/* Shared building blocks used across many category designs. */

export const scaleAbout = (s: number, cx = 32, cy = 32) =>
  `translate(${cx} ${cy}) scale(${s}) translate(${-cx} ${-cy})`;

/** Mirror a part left↔right across x=32. */
export const flipX = (k: Kit, node: React.ReactNode) => k.G("translate(64 0) scale(-1 1)", node);

/** Small heart of material m centred at (x, y), scaled from the full 64px heart. */
export const heartAt = (k: Kit, m: Mat, x: number, y: number, s: number, z?: number) =>
  k.G(`translate(${x} ${y}) scale(${s}) translate(-32 -32)`, k.P(m, HEART, z));

/** Soft oval glare spot. */
export const glare = (k: Kit, cx: number, cy: number, rx: number, ry: number, o = 0.3) => k.W(oval(cx, cy, rx, ry), o);

/** Small gold screw / rivet head. */
export const rivet = (k: Kit, x: number, y: number, r = 1) => (
  <>
    {k.C("g", x, y, r, 0.4)}
    {k.D(`M${x - r * 0.6} ${y}H${x + r * 0.6}`, r * 0.3)}
  </>
);

/** Coin face with a ridged rim, beaded inner ring and engraved glyph. */
export function coin(k: Kit, cx: number, cy: number, r: number, z: number, glyph = "$") {
  return (
    <>
      {k.C("g", cx, cy, r, z)}
      {k.S("ink", ring(cx, cy, r - 0.9), 1.8, "0.45 1.05", 0.45)}
      {k.C("g", cx, cy, r * 0.78, 0.6)}
      {k.S("g", ring(cx, cy, r * 0.68), r * 0.07, "0.01 1.7", 1, "round")}
      {k.T("ink", glyph, cx + r * 0.04, cy + r * 0.38 + r * 0.07, r * 1.05)}
      {k.T("g", glyph, cx, cy + r * 0.38, r * 1.05)}
      {k.H(`M${cx - r * 0.72} ${cy - r * 0.2}A${r * 0.75} ${r * 0.75} 0 0 1 ${cx - r * 0.2} ${cy - r * 0.72}`, 0.75, r * 0.08)}
    </>
  );
}

/** Ridged rim on any circle (coins, dials, lenses, bezels). */
export const ridges = (k: Kit, cx: number, cy: number, r: number, w = 1.6, o = 0.4) =>
  k.S("ink", ring(cx, cy, r), w, "0.45 1.05", o);

/** Beaded dotted ring. */
export const beads = (k: Kit, m: Mat, cx: number, cy: number, r: number, size = 0.9, gap = 1.9) =>
  k.S(m, ring(cx, cy, r), size, `0.01 ${gap}`, 1, "round");

function starPoints(cx: number, cy: number, outer: number, inner: number, n: number, rot = -90) {
  return Array.from({ length: n * 2 }, (_, i) => {
    const rad = ((rot + (i * 180) / n) * Math.PI) / 180;
    const r = i % 2 === 0 ? outer : inner;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)] as const;
  });
}

/**
 * Bevel facets for a star drawn with star(): each arm gets a lit half and a
 * shaded half, which makes it look cut/pressed instead of flat.
 */
export function facets(k: Kit, cx: number, cy: number, outer: number, inner: number, n: number, rot = -90, strength = 1) {
  const pts = starPoints(cx, cy, outer, inner, n, rot);
  return k.each(pts, ([x, y], i) => {
    const [nx, ny] = pts[(i + 1) % pts.length] ?? pts[0]!;
    const d = `M${cx} ${cy}L${x.toFixed(2)} ${y.toFixed(2)}L${nx.toFixed(2)} ${ny.toFixed(2)}Z`;
    // Lit faces on the upper-left half, shaded on the lower-right.
    const facing = Math.cos(Math.atan2((y + ny) / 2 - cy, (x + nx) / 2 - cx) + Math.PI * 0.75);
    return i % 2 === 0 ? k.W(d, (0.12 + 0.16 * Math.max(0, facing)) * strength) : k.X(d, (0.12 + 0.14 * Math.max(0, -facing)) * strength);
  });
}

/* Mini scales of justice, used on the legal document + book. */
export const miniScales = (k: Kit, cx: number, top: number) => (
  <>
    {k.L("g", `M${cx} ${top}V${top + 12}`, 1.6, 0)}
    {k.L("g", `M${cx - 8} ${top + 3}H${cx + 8}`, 1.6, 0)}
    {k.P("g", `M${cx - 11} ${top + 8}H${cx - 5}A3 3 0 0 1 ${cx - 11} ${top + 8}Z`, 0)}
    {k.P("g", `M${cx + 5} ${top + 8}H${cx + 11}A3 3 0 0 1 ${cx + 5} ${top + 8}Z`, 0)}
    {k.R("g", cx - 4, top + 12, 8, 2, 1, 0)}
  </>
);

/** Small figure (head + shoulders) for photos and badges. */
export const person = (k: Kit, m: Mat, cx: number, cy: number, s: number, z = 0) => (
  <>
    {k.C(m, cx, cy - s * 0.55, s * 0.42, z)}
    {k.P(m, `M${cx - s} ${cy + s}C${cx - s} ${cy + s * 0.1} ${cx + s} ${cy + s * 0.1} ${cx + s} ${cy + s}Z`, z)}
  </>
);
