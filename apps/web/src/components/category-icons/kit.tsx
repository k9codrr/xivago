import * as React from "react";
import type { CategoryIconStyle } from "@/lib/category-icons";

/**
 * Drawing kit for the 3D metal category icons.
 *
 * Every design is drawn once on a 64x64 grid with three materials:
 *   b = body   (navy / chrome / porcelain white / black)
 *   g = gold   (the same polished gold in every finish)
 *   a = accent (royal blue / maroon / cobalt / silver)
 * and each palette decides what those materials look like. Solid shapes get a
 * darker extruded side, a diagonal metallic gradient and a soft top rim light,
 * which is what gives them the chunky "3D sticker" look on a transparent
 * background.
 */

export type MetalStyle = Exclude<CategoryIconStyle, "lucide">;
export type Mat = "b" | "g" | "a";

type Stop = [offset: number, color: string];
interface Material {
  stops: Stop[];
  /** Colour of the extruded side, also used as the stroke "shadow". */
  side: string;
}
interface Palette {
  b: Material;
  g: Material;
  a: Material;
  /** Flat engraving colour for small details (lines on gold, keyholes...). */
  ink: string;
}

/* Metal gradients run diagonally (top-left lit). Each one has a second bright
   band near the end, the "reflection" that makes polished metal read as metal. */

const GOLD: Material = {
  stops: [
    [0, "#fffbe6"],
    [0.14, "#ffe08a"],
    [0.34, "#e2a93a"],
    [0.54, "#a8701a"],
    [0.72, "#f5d36c"],
    [0.88, "#c89030"],
    [1, "#7a5008"],
  ],
  side: "#4f3204",
};

const CHROME: Material = {
  stops: [
    [0, "#ffffff"],
    [0.2, "#eef1f4"],
    [0.4, "#9aa1aa"],
    [0.55, "#5d646d"],
    [0.72, "#e6e9ec"],
    [0.88, "#a9afb7"],
    [1, "#6c737c"],
  ],
  side: "#33383e",
};

export const PALETTES: Record<MetalStyle, Palette> = {
  "blue-gold": {
    b: {
      stops: [[0, "#7393ea"], [0.25, "#3557b8"], [0.55, "#1a3388"], [0.8, "#2c4bab"], [1, "#0b1a52"]],
      side: "#060f30",
    },
    g: GOLD,
    a: { stops: [[0, "#b4c8f8"], [0.4, "#5076dc"], [0.75, "#2a4bb2"], [1, "#16307f"]], side: "#0d1f55" },
    ink: "#0d1f5c",
  },
  "chrome-gold": {
    b: CHROME,
    g: GOLD,
    a: { stops: [[0, "#e07d8e"], [0.35, "#a8344a"], [0.7, "#681727"], [0.85, "#8e2638"], [1, "#3f0a15"]], side: "#2a050c" },
    ink: "#3b3f45",
  },
  "white-blue-gold": {
    b: { stops: [[0, "#ffffff"], [0.45, "#f3f5f9"], [0.75, "#dde2ea"], [1, "#b3bccc"]], side: "#828da0" },
    g: GOLD,
    a: { stops: [[0, "#8aa6f7"], [0.35, "#3459d8"], [0.7, "#1a36a8"], [0.85, "#2b4cc4"], [1, "#0f2380"]], side: "#081650" },
    ink: "#2445c4",
  },
  "black-gold": {
    b: {
      stops: [[0, "#74747c"], [0.2, "#3c3c42"], [0.5, "#17171a"], [0.78, "#33333a"], [1, "#060607"]],
      side: "#000000",
    },
    g: GOLD,
    a: CHROME,
    ink: "#111114",
  },
};

const DEPTH = 3;
const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Display", Inter, system-ui, sans-serif';

type ShapeProps = React.SVGProps<SVGElement> & Record<string, unknown>;

export interface Kit {
  /** Rounded rectangle slab. */
  R(m: Mat, x: number, y: number, w: number, h: number, r?: number, z?: number): React.ReactElement;
  /** Circle slab. */
  C(m: Mat, cx: number, cy: number, r: number, z?: number): React.ReactElement;
  /** Ellipse slab. */
  E(m: Mat, cx: number, cy: number, rx: number, ry: number, z?: number): React.ReactElement;
  /** Any filled path as a slab. */
  P(m: Mat, d: string, z?: number): React.ReactElement;
  /** Round-capped stroke (wires, handles, outlines). z=0 for flat engraving. */
  L(m: Mat, d: string, w?: number, z?: number): React.ReactElement;
  /** Flat ink detail: filled when no width, stroked otherwise. */
  D(d: string, w?: number): React.ReactElement;
  /** Bold glyph ($, %, TM...) in a material, or flat ink. */
  T(m: Mat | "ink", text: string, x: number, y: number, size: number): React.ReactElement;
  /** Transform a group of parts. */
  G(transform: string, children: React.ReactNode): React.ReactElement;
  /**
   * Dashed stroke: stitching (thin, long dashes), beaded rims (round caps, near-zero dashes)
   * or ridged coin edges (wide stroke, short dashes). "ink" uses the palette's engraving colour.
   */
  S(m: Mat | "ink", d: string, w: number, dash: string, opacity?: number, cap?: "round" | "butt"): React.ReactElement;
  /** Soft white glare (filled path) for glass, enamel and polished spots. */
  W(d: string, opacity?: number): React.ReactElement;
  /** Soft dark shade (filled path) for facets, folds and recesses. */
  X(d: string, opacity?: number): React.ReactElement;
  /** Thin white specular streak along a path. */
  H(d: string, opacity?: number, w?: number): React.ReactElement;
  /** Clip children to a path, for stripes, grooves and grain inside a shape. */
  K(d: string, children: React.ReactNode): React.ReactElement;
  /** Repeat parts with stable keys. */
  each<T>(items: readonly T[], draw: (item: T, i: number) => React.ReactNode): React.ReactNode[];
}

export function makeKit(id: string, style: MetalStyle): Kit {
  const pal = PALETTES[style];
  const face = (m: Mat) => `url(#${id}${m})`;
  const strokeFace = (m: Mat) => `url(#${id}${m}s)`;
  const sideFill = (m: Mat) => `url(#${id}${m}x)`;
  let clipCount = 0;

  /**
   * A solid part, back to front:
   *   extruded side (two copies so thin parts have no gaps) â†’ metal face â†’
   *   glossy highlight â†’ shaded lower bevel â†’ bright upper rim.
   * Flat parts (z=0) get a thin drop line instead so they read as embossed.
   */
  function slab(m: Mat, z: number, shape: (p: ShapeProps) => React.ReactElement) {
    return (
      <g>
        {z > 0 ? (
          <>
            {shape({ fill: sideFill(m), transform: `translate(0 ${z})` })}
            {shape({ fill: sideFill(m), transform: `translate(0 ${z / 2})` })}
          </>
        ) : (
          shape({ fill: "#000", fillOpacity: 0.4, transform: "translate(0 0.6)" })
        )}
        {shape({ fill: face(m) })}
        {shape({ fill: `url(#${id}gl)` })}
        {shape({ fill: "none", stroke: `url(#${id}sh)`, strokeWidth: 1.3 })}
        {shape({ fill: "none", stroke: `url(#${id}r)`, strokeWidth: 0.8 })}
      </g>
    );
  }

  return {
    R: (m, x, y, w, h, r = 0, z = DEPTH) =>
      slab(m, z, (p) => <rect x={x} y={y} width={w} height={h} rx={r} {...(p as React.SVGProps<SVGRectElement>)} />),
    C: (m, cx, cy, r, z = DEPTH) =>
      slab(m, z, (p) => <circle cx={cx} cy={cy} r={r} {...(p as React.SVGProps<SVGCircleElement>)} />),
    E: (m, cx, cy, rx, ry, z = DEPTH) =>
      slab(m, z, (p) => <ellipse cx={cx} cy={cy} rx={rx} ry={ry} {...(p as React.SVGProps<SVGEllipseElement>)} />),
    P: (m, d, z = DEPTH) => slab(m, z, (p) => <path d={d} {...(p as React.SVGProps<SVGPathElement>)} />),
    // Strokes are drawn as tubes: dark side, metal body, then a thin specular line up-left.
    L: (m, d, w = 3, z = 2) => (
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {z > 0 ? (
          <>
            <path d={d} stroke={pal[m].side} strokeWidth={w} transform={`translate(0 ${z})`} />
            <path d={d} stroke={pal[m].side} strokeWidth={w} transform={`translate(0 ${z / 2})`} />
          </>
        ) : (
          <path d={d} stroke="#000" strokeOpacity={0.4} strokeWidth={w} transform="translate(0 0.6)" />
        )}
        <path d={d} stroke={strokeFace(m)} strokeWidth={w} />
        <path
          d={d}
          stroke="#fff"
          strokeOpacity={w >= 2.5 ? 0.55 : 0.35}
          strokeWidth={Math.max(0.4, w * 0.28)}
          transform={`translate(${-w * 0.1} ${-w * 0.2})`}
        />
      </g>
    ),
    D: (d, w) =>
      w ? (
        <path d={d} fill="none" stroke={pal.ink} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d={d} fill={pal.ink} />
      ),
    T: (m, text, x, y, size) => (
      <g fontFamily={FONT} fontWeight={800} fontSize={size} textAnchor="middle">
        {m === "ink" ? (
          <text x={x} y={y} fill={pal.ink}>
            {text}
          </text>
        ) : (
          <>
            <text x={x} y={y + 1.6} fill={pal[m].side}>
              {text}
            </text>
            <text x={x} y={y + 0.8} fill={pal[m].side}>
              {text}
            </text>
            <text x={x} y={y} fill={strokeFace(m)}>
              {text}
            </text>
            <text x={x} y={y} fill="none" stroke={`url(#${id}r)`} strokeWidth={0.6}>
              {text}
            </text>
          </>
        )}
      </g>
    ),
    G: (transform, children) => <g transform={transform}>{children}</g>,
    S: (m, d, w, dash, opacity = 1, cap = "butt") => (
      <path
        d={d}
        fill="none"
        stroke={m === "ink" ? pal.ink : strokeFace(m)}
        strokeWidth={w}
        strokeDasharray={dash}
        strokeLinecap={cap}
        opacity={opacity}
      />
    ),
    W: (d, opacity = 0.35) => <path d={d} fill="#fff" opacity={opacity} />,
    X: (d, opacity = 0.2) => <path d={d} fill="#000" opacity={opacity} />,
    H: (d, opacity = 0.6, w = 1.2) => (
      <path d={d} fill="none" stroke="#fff" strokeOpacity={opacity} strokeWidth={w} strokeLinecap="round" />
    ),
    K: (d, children) => {
      const clipId = `${id}k${clipCount++}`;
      return (
        <g>
          <clipPath id={clipId}>
            <path d={d} />
          </clipPath>
          <g clipPath={`url(#${clipId})`}>{children}</g>
        </g>
      );
    },
    each: (items, draw) => items.map((item, i) => <React.Fragment key={i}>{draw(item, i)}</React.Fragment>),
  };
}

/** Gradient + filter definitions a kit's parts point at. Render once inside each <svg>. */
export function KitDefs({ id, style }: { id: string; style: MetalStyle }) {
  const pal = PALETTES[style];
  const glossPeak = style === "white-blue-gold" ? 0.35 : 0.6;
  return (
    <defs>
      {(["b", "g", "a"] as const).map((m) => (
        <React.Fragment key={m}>
          <linearGradient id={`${id}${m}`} x1="0" y1="0" x2="1" y2="1">
            {pal[m].stops.map(([o, c]) => (
              <stop key={o} offset={o} stopColor={c} />
            ))}
          </linearGradient>
          <linearGradient id={`${id}${m}s`} gradientUnits="userSpaceOnUse" x1="8" y1="4" x2="56" y2="60">
            {pal[m].stops.map(([o, c]) => (
              <stop key={o} offset={o} stopColor={c} />
            ))}
          </linearGradient>
          {/* Extruded side: darkest metal tone fading to the side colour. */}
          <linearGradient id={`${id}${m}x`} x1="0" y1="0" x2="0.3" y2="1">
            <stop offset="0" stopColor={pal[m].stops[pal[m].stops.length - 1]?.[1] ?? pal[m].side} />
            <stop offset="1" stopColor={pal[m].side} />
          </linearGradient>
        </React.Fragment>
      ))}
      {/* Upper rim light */}
      <linearGradient id={`${id}r`} x1="0" y1="0" x2="0.25" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity="0.95" />
        <stop offset="0.35" stopColor="#fff" stopOpacity="0.25" />
        <stop offset="0.6" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
      {/* Lower bevel shade */}
      <linearGradient id={`${id}sh`} x1="0" y1="0" x2="0.2" y2="1">
        <stop offset="0.5" stopColor="#000" stopOpacity="0" />
        <stop offset="1" stopColor="#000" stopOpacity="0.5" />
      </linearGradient>
      {/* Soft gloss hotspot, top-left of every surface */}
      <radialGradient id={`${id}gl`} cx="0.3" cy="0.16" r="0.8" fx="0.28" fy="0.1">
        <stop offset="0" stopColor="#fff" stopOpacity={glossPeak} />
        <stop offset="0.3" stopColor="#fff" stopOpacity={glossPeak * 0.3} />
        <stop offset="0.65" stopColor="#fff" stopOpacity="0" />
      </radialGradient>
      <filter id={`${id}bl`} x="-50%" y="-300%" width="200%" height="700%">
        <feGaussianBlur stdDeviation="2.2" />
      </filter>
    </defs>
  );
}

/** Soft contact shadow on the "ground" under the icon. */
export function KitGround({ id }: { id: string }) {
  return <ellipse cx="32" cy="60.5" rx="21" ry="2.6" fill="#000" opacity="0.6" filter={`url(#${id}bl)`} />;
}

/* â”€â”€ Path helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

const f = (n: number) => Number(n.toFixed(2));

/** n-pointed star. rot is the angle of the first point in degrees. */
export function star(cx: number, cy: number, outer: number, inner: number, n: number, rot = -90) {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const rad = ((rot + (i * 180) / n) * Math.PI) / 180;
    const r = i % 2 === 0 ? outer : inner;
    pts.push(`${f(cx + r * Math.cos(rad))} ${f(cy + r * Math.sin(rad))}`);
  }
  return `M${pts.join("L")}Z`;
}

/** Cog wheel outline with n teeth. */
export function gear(cx: number, cy: number, outer: number, inner: number, n: number) {
  const step = 360 / n;
  const pts: string[] = [];
  const at = (deg: number, r: number) => {
    const rad = (deg * Math.PI) / 180;
    pts.push(`${f(cx + r * Math.cos(rad))} ${f(cy + r * Math.sin(rad))}`);
  };
  for (let i = 0; i < n; i++) {
    const a = i * step;
    at(a - step * 0.32, inner);
    at(a - step * 0.17, outer);
    at(a + step * 0.17, outer);
    at(a + step * 0.32, inner);
  }
  return `M${pts.join("L")}Z`;
}

/** Ellipse as a path (for glare spots and clipping). */
export function oval(cx: number, cy: number, rx: number, ry: number) {
  return `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${rx * 2} 0a${rx} ${ry} 0 1 0 ${-rx * 2} 0Z`;
}

/** Rounded rectangle as a path (for stitching and clipping). */
export function rrect(x: number, y: number, w: number, h: number, r: number) {
  return `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
}

/** Full circle as a stroke-able path. */
export function ring(cx: number, cy: number, r: number) {
  return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0`;
}

export const HEART =
  "M32 54C14 42 8 33 8 23C8 15 14 10 21 10C26 10 30 13 32 17C34 13 38 10 43 10C50 10 56 15 56 23C56 33 50 42 32 54Z";
export const SHIELD = "M32 6L54 13V30C54 44 44 53 32 58C20 53 10 44 10 30V13Z";
export const PIN = "M32 58C32 58 12 38 12 24A20 20 0 0 1 52 24C52 38 32 58 32 58Z";
export const BELL = "M32 10C22 10 18 18 18 28V40L12 46H52L46 40V28C46 18 42 10 32 10Z";
