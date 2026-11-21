"use client";

import { useEffect, useRef, useState } from "react";
import { X, Flashlight, FlashlightOff, ImageUp, Loader2 } from "lucide-react";
import type { Html5QrcodeCameraScanConfig } from "html5-qrcode";
import { cn } from "@/lib/utils";
import { useQrScanner } from "@/lib/use-qr-scanner";

const READER_ELEMENT_ID = "inline-qr-scanner-reader";
const FILE_READER_ELEMENT_ID = "inline-qr-scanner-file-reader";

/** html5-qrcode decodes from a canvas the size of its element in CSS pixels, so a
 * 204px tile would squeeze the whole camera frame into ~204px and a phone-screen QR
 * becomes unreadable. The reader is laid out at this width instead and scaled down
 * with a transform (which doesn't change its layout size) to fill the tile. */
const READER_WIDTH = 640;
/** Fraction of the visible square that is scanned; matches the corner guides. */
const SCAN_FRACTION = 0.8;

/** Centered square scan region (stable reference so the camera doesn't restart). */
const QRBOX: Html5QrcodeCameraScanConfig["qrbox"] = (w: number, h: number) => {
  const size = Math.floor(Math.min(w, h) * SCAN_FRACTION);
  return { width: size, height: size };
};

interface InlineQrScannerProps {
  onClose: () => void;
  className?: string;
}

/** Camera QR scanner that fills its container (e.g. the profile-QR tile on
 * Explore) instead of taking over the screen. Camera starts on mount and stops
 * on unmount, so the parent controls it simply by rendering it or not. */
export function InlineQrScanner({ onClose, className }: InlineQrScannerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const readerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const { torchSupported, torchOn, toggleTorch, scanFile, scanningFile } = useQrScanner({
    readerId: READER_ELEMENT_ID,
    fileReaderId: FILE_READER_ELEMENT_ID,
    active: true,
    onScanned: onClose,
    qrbox: QRBOX,
  });

  // Scale the full-size feed to cover the tile (like object-fit: cover), centered.
  useEffect(() => {
    const frame = frameRef.current;
    const reader = readerRef.current;
    if (!frame || !reader) return;
    const update = () => {
      const w = reader.offsetWidth;
      const h = reader.offsetHeight;
      if (!w) return;
      setScale(h ? Math.max(frame.clientWidth / w, frame.clientHeight / h) : frame.clientWidth / w);
    };
    const observer = new ResizeObserver(update);
    observer.observe(reader);
    observer.observe(frame);
    update();
    return () => observer.disconnect();
  }, []);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) scanFile(file);
  }

  const guideInset = `${((1 - SCAN_FRACTION) / 2) * 100}%`;

  return (
    <div ref={frameRef} className={cn("relative overflow-hidden bg-black", className)}>
      <div
        ref={readerRef}
        id={READER_ELEMENT_ID}
        style={{ width: READER_WIDTH, transform: `translate(-50%, -50%) scale(${scale})` }}
        // The library's own shaded box is replaced by the corner guides below.
        className="pointer-events-none absolute left-1/2 top-1/2 [&_#qr-shaded-region]:hidden [&_video]:block"
      />
      <div id={FILE_READER_ELEMENT_ID} className="hidden" />

      {/* Scan-area corners */}
      <span className="pointer-events-none absolute" style={{ inset: guideInset }}>
        <span className="absolute left-0 top-0 h-5 w-5 rounded-tl-[6px] border-l-2 border-t-2 border-white" />
        <span className="absolute right-0 top-0 h-5 w-5 rounded-tr-[6px] border-r-2 border-t-2 border-white" />
        <span className="absolute bottom-0 left-0 h-5 w-5 rounded-bl-[6px] border-b-2 border-l-2 border-white" />
        <span className="absolute bottom-0 right-0 h-5 w-5 rounded-br-[6px] border-b-2 border-r-2 border-white" />
      </span>

      <button
        type="button"
        onClick={onClose}
        aria-label="Close scanner"
        className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/50 text-white backdrop-blur"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-6 bg-gradient-to-t from-black/60 to-transparent pb-2.5 pt-5">
        <button
          type="button"
          onClick={toggleTorch}
          disabled={!torchSupported}
          aria-label={torchOn ? "Turn flash off" : "Turn flash on"}
          className={cn(
            "grid h-9 w-9 place-items-center rounded-full backdrop-blur transition-colors disabled:opacity-40",
            torchOn ? "bg-white text-black" : "bg-white/20 text-white",
          )}
        >
          {torchOn ? <Flashlight className="h-[18px] w-[18px]" /> : <FlashlightOff className="h-[18px] w-[18px]" />}
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={scanningFile}
          aria-label="Scan QR from an image"
          className="grid h-9 w-9 place-items-center rounded-full bg-white/20 text-white backdrop-blur disabled:opacity-60"
        >
          {scanningFile ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <ImageUp className="h-[18px] w-[18px]" />}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
      </div>
    </div>
  );
}
