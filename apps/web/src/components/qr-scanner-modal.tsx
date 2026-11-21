"use client";

import { useRef } from "react";
import { X, Flashlight, FlashlightOff, ImageUp, Loader2 } from "lucide-react";
import { useQrScanner } from "@/lib/use-qr-scanner";

const READER_ELEMENT_ID = "qr-scanner-reader";
const FILE_READER_ELEMENT_ID = "qr-scanner-file-reader";

interface QrScannerModalProps {
  open: boolean;
  onClose: () => void;
}

/** Fullscreen QR scanner. Scanning/validation logic lives in useQrScanner. */
export function QrScannerModal({ open, onClose }: QrScannerModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { torchSupported, torchOn, toggleTorch, scanFile, scanningFile } = useQrScanner({
    readerId: READER_ELEMENT_ID,
    fileReaderId: FILE_READER_ELEMENT_ID,
    active: open,
    onScanned: onClose,
    qrbox: 250,
  });

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) scanFile(file);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between px-4 pb-3 pt-[max(env(safe-area-inset-top),0.75rem)]">
        <h2 className="text-base font-semibold text-white">Scan QR Code</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="text-white">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="flex flex-1 items-center justify-center px-4">
        <div id={READER_ELEMENT_ID} className="w-full max-w-sm overflow-hidden rounded-2xl" />
      </div>
      <div id={FILE_READER_ELEMENT_ID} className="hidden" />
      <p className="px-4 pb-5 text-center text-xs text-neutral-400">
        Point your camera at a xivago profile or credits QR code.
      </p>
      <div className="flex items-start justify-center gap-10 px-4 pb-[max(env(safe-area-inset-bottom),2rem)]">
        <button
          type="button"
          onClick={toggleTorch}
          disabled={!torchSupported}
          aria-label={torchOn ? "Turn flash off" : "Turn flash on"}
          className="flex flex-col items-center gap-1.5 text-[11px] font-medium text-white disabled:opacity-40"
        >
          <span
            className={`grid h-14 w-14 place-items-center rounded-full transition-colors ${
              torchOn ? "bg-white text-black" : "bg-white/15 text-white"
            }`}
          >
            {torchOn ? <Flashlight className="h-6 w-6" /> : <FlashlightOff className="h-6 w-6" />}
          </span>
          Flash
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={scanningFile}
          aria-label="Scan QR from an image"
          className="flex flex-col items-center gap-1.5 text-[11px] font-medium text-white disabled:opacity-60"
        >
          <span className="grid h-14 w-14 place-items-center rounded-full bg-white/15">
            {scanningFile ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImageUp className="h-6 w-6" />}
          </span>
          Gallery
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
      </div>
    </div>
  );
}
