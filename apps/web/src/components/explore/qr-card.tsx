"use client";

import type { CSSProperties } from "react";
import { QRCodeSVG } from "qrcode.react";
import { cn } from "@/lib/utils";
import { CARD_FILLS, borderColor, imageBackground, patternStyle, useCustomImage, type QrTheme } from "./qr-theme";

/** 1x1 transparent GIF -- lets qrcode.react clear the centre modules for the avatar overlay. */
const TRANSPARENT_PIXEL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/** Placeholder encoded while the session loads; only ever shown dimmed behind the label art. */
const PLACEHOLDER_VALUE = "https://xivago.com";

interface QrCardProps {
  theme: QrTheme;
  /** Card edge in px; fonts and radii scale with it. */
  size: number;
  value?: string;
  avatarUrl?: string | null;
  initial?: string;
  className?: string;
}

/**
 * Apple-icon style rim: a thin stroke lit at the top-left and bottom-right corners
 * that fades out halfway along each edge. Drawn as a gradient-filled ring (mask
 * composite cuts out the content box), so it follows the card's corner radius.
 */
export function RimBorder({ color, mode, width = 1.5 }: { color: string; mode: QrTheme["border"]; width?: number }) {
  if (mode === "none") return null;
  const background =
    mode === "rim"
      ? `linear-gradient(135deg, ${color} 0%, transparent 34%, transparent 66%, ${color} 100%)`
      : `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 45%, transparent))`;
  const style: CSSProperties = {
    padding: width,
    background,
    WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
    WebkitMaskComposite: "xor",
    mask: "linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0)",
  };
  return <span aria-hidden className="pointer-events-none absolute inset-0 z-20 rounded-[inherit]" style={style} />;
}

export function QrCard({ theme, size, value, avatarUrl, initial, className }: QrCardProps) {
  const fill = CARD_FILLS[theme.fill];
  const radius = Math.round(size * 0.115);
  const qrValue = value || PLACEHOLDER_VALUE;
  const customCard = useCustomImage("card");
  const cardImage = imageBackground(theme.cardImage, "card", customCard);

  return (
    <div
      className={cn("relative overflow-hidden", className)}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        // An image replaces the colour fill; a soft shade keeps the label and QR readable on it.
        background: cardImage
          ? `linear-gradient(160deg, rgba(0,0,0,0.12), rgba(0,0,0,0.42)), ${cardImage}`
          : `radial-gradient(130% 130% at 100% 100%, ${fill.to} 0%, color-mix(in srgb, ${fill.to} 35%, transparent) 38%, transparent 70%), ${fill.from}`,
        boxShadow: `0 22px 50px -12px rgba(0,0,0,0.75), 0 0 60px -20px ${fill.accent}`,
      }}
    >
      {theme.label ? (
        <>
          {/* Dimmed QR as texture under the art */}
          <QRCodeSVG
            value={qrValue}
            size={size}
            level="M"
            bgColor="transparent"
            fgColor={fill.qr}
            className="absolute"
            style={{ inset: size * 0.07, width: size * 0.86, height: size * 0.86 }}
          />
          <p
            className="absolute font-black leading-[0.86] tracking-[-0.045em] text-white [text-shadow:0_4px_18px_rgba(0,0,0,0.35)]"
            style={{ left: size * 0.13, top: size * 0.15, fontSize: size * 0.255 }}
          >
            Scan
            <br />
            &amp; Sell
          </p>
        </>
      ) : (
        <>
          {/* Clean plate: dark-on-light keeps the code readable by every camera app */}
          <span
            className="absolute bg-white"
            style={{ inset: size * 0.085, borderRadius: radius * 0.62, boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.06)" }}
          />
          <QRCodeSVG
            value={qrValue}
            size={size}
            level="M"
            bgColor="transparent"
            fgColor="#111114"
            className="absolute"
            style={{ inset: size * 0.13, width: size * 0.74, height: size * 0.74 }}
            imageSettings={{ src: TRANSPARENT_PIXEL, height: size * 0.17, width: size * 0.17, excavate: true }}
          />
          <span
            className="absolute left-1/2 top-1/2 grid -translate-x-1/2 -translate-y-1/2 place-items-center overflow-hidden rounded-full ring-2 ring-white"
            style={{ width: size * 0.15, height: size * 0.15, background: fill.from }}
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="font-bold text-white" style={{ fontSize: size * 0.06 }}>
                {initial || "?"}
              </span>
            )}
          </span>
        </>
      )}

      {/* Glassy sheen */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "linear-gradient(155deg, rgba(255,255,255,0.10) 0%, transparent 38%)" }}
      />
      <RimBorder color={borderColor(theme.borderTone, theme.fill)} mode={theme.border} />
    </div>
  );
}

/** Pattern halo that sits directly behind the card and fades out radially. */
export function CardHalo({ theme, className }: { theme: QrTheme; className?: string }) {
  const fill = CARD_FILLS[theme.fill];
  return (
    <span aria-hidden className={cn("pointer-events-none absolute", className)}>
      <span
        className="absolute inset-0 opacity-90"
        style={{
          ...patternStyle(theme.pattern === "none" ? "dots" : theme.pattern, "rgba(255,255,255,0.16)"),
          WebkitMaskImage: "radial-gradient(closest-side, #000 45%, transparent 100%)",
          maskImage: "radial-gradient(closest-side, #000 45%, transparent 100%)",
        }}
      />
      <span
        className="absolute inset-[18%] rounded-full blur-3xl"
        style={{ background: `color-mix(in srgb, ${fill.accent} 30%, transparent)` }}
      />
    </span>
  );
}
