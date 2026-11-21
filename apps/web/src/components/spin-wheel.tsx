"use client";

const FILLS = ["#2b8a8f", "#5b2a9a"];
const rad = (d: number) => (d * Math.PI) / 180;

/** Degrees between segment centres and the wheel's 3 o'clock start, for a wheel of `count` segments. */
export function segmentCenter(index: number, count: number) {
  const size = 360 / count;
  return index * size + size / 2;
}

/**
 * Next absolute rotation that leaves segment `index` under the top pointer,
 * after at least `turns` full spins from `current`. `jitter` (0..1) nudges the
 * stop point within the segment so it doesn't always land dead centre.
 */
export function rotationToSegment(current: number, index: number, count: number, turns = 6, jitter = 0.5) {
  const size = 360 / count;
  // Pointer sits at 270deg in SVG angle space (12 o'clock)
  const target = (((270 - segmentCenter(index, count) - (jitter - 0.5) * size * 0.7) % 360) + 360) % 360;
  const delta = (((target - current) % 360) + 360) % 360;
  return current + turns * 360 + delta;
}

/** Prize wheel with a fixed pointer at the top; rotate it by changing `rotation`. */
export function SpinWheel({ segments, rotation, spinning }: { segments: readonly number[]; rotation: number; spinning: boolean }) {
  const size = 360 / segments.length;
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[320px]">
      {/* Pointer */}
      <div className="absolute left-1/2 top-[-6px] z-10 -translate-x-1/2 drop-shadow-[0_4px_6px_rgba(0,0,0,0.5)]">
        <svg width="34" height="40" viewBox="0 0 34 40">
          <path d="M17 40 L2 8 A16 16 0 1 1 32 8 Z" fill="#fbbf24" stroke="#1e1b4b" strokeWidth="2" />
          <circle cx="17" cy="13" r="5" fill="#1e1b4b" />
        </svg>
      </div>

      <svg
        viewBox="0 0 200 200"
        className="h-full w-full drop-shadow-[0_0_24px_rgba(91,42,154,0.55)]"
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: spinning ? "transform 4.8s cubic-bezier(0.15, 0.7, 0.1, 1)" : "none",
        }}
      >
        <defs>
          <linearGradient id="spin-rim" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f1f5f9" />
            <stop offset="1" stopColor="#64748b" />
          </linearGradient>
        </defs>
        <circle cx="100" cy="100" r="99" fill="url(#spin-rim)" />
        <circle cx="100" cy="100" r="91" fill="#1e293b" />
        {segments.map((_, i) => {
          const [s, e] = [rad(i * size), rad(i * size + size)];
          return (
            <path
              key={i}
              d={`M100 100L${100 + 88 * Math.cos(s)} ${100 + 88 * Math.sin(s)}A88 88 0 0 1 ${100 + 88 * Math.cos(e)} ${100 + 88 * Math.sin(e)}Z`}
              fill={FILLS[i % FILLS.length]}
            />
          );
        })}
        {segments.map((credits, i) => {
          const a = segmentCenter(i, segments.length);
          const [x, y] = [100 + 62 * Math.cos(rad(a)), 100 + 62 * Math.sin(rad(a))];
          return (
            <text
              key={i}
              x={x}
              y={y}
              fill="#f8fafc"
              fontSize="14"
              fontWeight="800"
              textAnchor="middle"
              dominantBaseline="middle"
              transform={`rotate(${a + 90} ${x} ${y})`}
            >
              {credits}
            </text>
          );
        })}
        {/* Rim studs */}
        {Array.from({ length: segments.length * 2 }).map((_, i) => {
          const a = rad((i * size) / 2);
          return <circle key={i} cx={100 + 95 * Math.cos(a)} cy={100 + 95 * Math.sin(a)} r="1.8" fill="#fde68a" />;
        })}
        <circle cx="100" cy="100" r="14" fill="#334155" stroke="#94a3b8" strokeWidth="2" />
      </svg>
    </div>
  );
}
