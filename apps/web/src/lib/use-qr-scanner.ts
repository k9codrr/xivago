"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Html5Qrcode, Html5QrcodeSupportedFormats, type Html5QrcodeCameraScanConfig } from "html5-qrcode";
import { rememberPermission } from "@/lib/permissions";
import { celebrate } from "@/components/celebration";

interface UseQrScannerOptions {
  /** DOM id of the element the camera feed is rendered into. */
  readerId: string;
  /** DOM id of a hidden element used for decoding gallery images. */
  fileReaderId: string;
  /** Camera runs only while this is true. */
  active: boolean;
  /** Called right before navigating to a successfully scanned link. */
  onScanned?: () => void;
  /** Scan region; keep the reference stable (module constant), it restarts the camera when it changes. */
  qrbox?: Html5QrcodeCameraScanConfig["qrbox"];
}

const SCANNER_CONFIG = {
  verbose: false,
  formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
  // Native BarcodeDetector (Android Chrome etc.) is much faster and more forgiving than the JS decoder.
  experimentalFeatures: { useBarCodeDetectorIfSupported: true },
};

/** Origins whose profile QRs we accept: this one, plus the canonical app URL, so a QR
 * made on app.xivago.com still scans on a preview/LAN/localhost build and vice versa. */
function isAppOrigin(origin: string) {
  if (origin === window.location.origin) return true;
  try {
    return origin === new URL(process.env.NEXT_PUBLIC_APP_URL ?? "").origin;
  } catch {
    return false;
  }
}

let mountSeq = 0;

/** Scans a profile QR (see profile-qr-modal.tsx) and navigates to it. Only ever
 * follows app links matching a known route, and only by path within this app --
 * an arbitrary scanned URL is never opened, so this can't become an open
 * redirect / phishing vector. */
export function useQrScanner({ readerId, fileReaderId, active, onScanned, qrbox }: UseQrScannerOptions) {
  const router = useRouter();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const onScannedRef = useRef(onScanned);
  onScannedRef.current = onScanned;
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [scanningFile, setScanningFile] = useState(false);
  // The camera reports the same code ~10x a second; act once, and don't stack identical error toasts.
  const handledRef = useRef(false);
  const lastErrorRef = useRef({ text: "", at: 0 });

  function rejectScan(text: string, message: string) {
    const now = Date.now();
    if (lastErrorRef.current.text === text && now - lastErrorRef.current.at < 3000) return;
    lastErrorRef.current = { text, at: now };
    toast.error(message);
  }

  function handleDecoded(decodedText: string) {
    if (handledRef.current) return;
    let url: URL;
    try {
      url = new URL(decodedText.trim());
    } catch {
      rejectScan(decodedText, "That's not a xivago QR code.");
      return;
    }
    if (!isAppOrigin(url.origin)) {
      rejectScan(decodedText, "That's not a xivago QR code.");
      return;
    }
    // Credit transfer QRs are paused:
    // if (!/^\/u\/[^/]+$/.test(url.pathname) && !/^\/credits\/transfer\/[^/]+$/.test(url.pathname)) {
    if (!/^\/u\/[^/]+\/?$/.test(url.pathname)) {
      rejectScan(decodedText, "Unsupported QR code.");
      return;
    }

    handledRef.current = true;
    const path = url.pathname.replace(/\/$/, "");
    // Remember who was scanned (feeds Explore's Recommended row). Fire-and-forget:
    // keepalive lets it finish after navigation; a failure must never block the scan.
    const scannedId = decodeURIComponent(path.split("/")[2] ?? "");
    if (scannedId) {
      fetch("/api/qr-scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: scannedId }),
        keepalive: true,
      }).catch(() => {});
    }
    onScannedRef.current?.();
    // Lock-on animation + beep, then open the profile.
    void celebrate({ kind: "scan", title: "QR scanned", subtitle: "Opening profile…", duration: 1500 }).then(() => router.push(path));
  }
  const handleDecodedRef = useRef(handleDecoded);
  handleDecodedRef.current = handleDecoded;

  useEffect(() => {
    if (!active) return;
    const host = document.getElementById(readerId);
    if (!host) return;
    handledRef.current = false;

    let cancelled = false;
    let scanner: Html5Qrcode | null = null;
    let started: Promise<unknown> = Promise.resolve();
    // Each run renders into its own child element, so a previous run that is still
    // shutting down can never wipe this run's video (React dev runs effects twice).
    const mount = document.createElement("div");
    mount.id = `${readerId}-${++mountSeq}`;
    host.appendChild(mount);

    // Deferred a tick: React's dev double-invoke cancels the first run before it opens the camera.
    const timer = setTimeout(() => {
      const s = new Html5Qrcode(mount.id, SCANNER_CONFIG);
      scanner = s;
      scannerRef.current = s;
      started = s.start(
        { facingMode: "environment" },
        { fps: 10, ...(qrbox ? { qrbox } : {}) },
        (decodedText) => {
          if (!cancelled) handleDecodedRef.current(decodedText);
        },
        () => {
          /* per-frame "no QR found" -- expected constantly while scanning, not an error */
        },
      );
      started
        .then(() => {
          rememberPermission("camera", "granted");
          if (cancelled) return;
          try {
            setTorchSupported(s.getRunningTrackCameraCapabilities().torchFeature().isSupported());
          } catch {
            setTorchSupported(false);
          }
        })
        .catch((err: unknown) => {
          if (/NotAllowed|Permission/i.test(String(err))) rememberPermission("camera", "denied");
          // No camera, permission denied, or not a secure context (camera needs HTTPS or localhost).
          if (!cancelled) toast.error("Could not access the camera. You can still scan from an image.");
        });
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      setTorchSupported(false);
      setTorchOn(false);
      scannerRef.current = null;
      // Wait for an in-flight start() so a quick open/close never leaves the camera on.
      started
        .then(() => scanner?.stop())
        .catch(() => {})
        .finally(() => mount.remove());
    };
  }, [active, readerId, qrbox]);

  async function toggleTorch() {
    const scanner = scannerRef.current;
    if (!scanner?.isScanning) return;
    try {
      const next = !torchOn;
      await scanner.getRunningTrackCameraCapabilities().torchFeature().apply(next);
      setTorchOn(next);
    } catch {
      toast.error("Flash isn't available on this device.");
    }
  }

  async function scanFile(file: File) {
    setScanningFile(true);
    // A separate instance so the live camera scan keeps running untouched.
    const fileScanner = new Html5Qrcode(fileReaderId, SCANNER_CONFIG);
    try {
      const decodedText = await fileScanner.scanFile(file, false);
      handledRef.current = false;
      lastErrorRef.current = { text: "", at: 0 };
      handleDecoded(decodedText);
    } catch {
      toast.error("No QR code found in that image.");
    } finally {
      fileScanner.clear();
      setScanningFile(false);
    }
  }

  return { torchSupported, torchOn, toggleTorch, scanFile, scanningFile };
}
