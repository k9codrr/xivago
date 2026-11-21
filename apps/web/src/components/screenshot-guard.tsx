"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Screenshot deterrent for request / offer details.
 *
 * A web page can't stop the OS from capturing the screen, so this does what a
 * browser allows:
 *  - blacks the screen out while the PrintScreen / macOS capture shortcuts are
 *    pressed, and wipes the clipboard after PrintScreen;
 *  - blacks it out while the window is unfocused or hidden (Snipping Tool,
 *    Xbox Game Bar and the mobile app switcher all take focus first);
 *  - hides the content from printing / "Save as PDF";
 *  - blocks text selection, copy, long-press callouts, right-click and drag.
 * Inside the native app shell (apps/mobile) it also turns on the OS-level
 * secure flag via @capacitor-community/privacy-screen -- Android FLAG_SECURE,
 * iOS secure-layer -- so screenshots and recordings come out black. That's
 * the only way to block hardware-button screenshots on phones.
 */

type PrivacyScreenModule = typeof import("@capacitor-community/privacy-screen");

function isNativeApp(): boolean {
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

let privacyModule: Promise<PrivacyScreenModule | null> | null = null;
/** Serialises enable/disable calls so a quick open -> close -> open can't finish out of order. */
let privacyQueue: Promise<unknown> = Promise.resolve();

/** Turns the OS-level secure flag on/off. No-op outside the native app shell. */
function setNativeSecure(on: boolean) {
  if (!isNativeApp()) return;
  privacyModule ??= import("@capacitor-community/privacy-screen").catch(() => null);
  privacyQueue = privacyQueue
    .then(() => privacyModule)
    .then((mod) => (on ? mod?.PrivacyScreen.enable() : mod?.PrivacyScreen.disable()))
    .catch(() => undefined);
}

/** Guards are reference-counted so nested / overlapping ones don't fight over the shared state. */
let activeGuards = 0;

function isCaptureShortcut(e: KeyboardEvent): boolean {
  if (e.key === "PrintScreen" || e.code === "PrintScreen") return true;
  // macOS: Cmd+Shift+3/4/5/6; Windows: Win+Shift+S (when the browser sees it)
  if (e.metaKey && e.shiftKey && ["3", "4", "5", "6", "s", "S"].includes(e.key)) return true;
  // Print / save as PDF
  if ((e.ctrlKey || e.metaKey) && (e.key === "p" || e.key === "P")) return true;
  return false;
}

export function useScreenshotGuard(active = true): boolean {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!active) return;
    activeGuards += 1;
    document.documentElement.classList.add("screenshot-guarded");
    if (activeGuards === 1) setNativeSecure(true);

    let revealTimer: ReturnType<typeof setTimeout> | undefined;
    const hideFor = (ms: number) => {
      setHidden(true);
      clearTimeout(revealTimer);
      revealTimer = setTimeout(() => {
        if (document.hasFocus() && document.visibilityState === "visible") setHidden(false);
      }, ms);
    };
    const wipeClipboard = () => {
      try {
        void navigator.clipboard?.writeText("").catch(() => undefined);
      } catch {
        /* clipboard not available */
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (isCaptureShortcut(e)) {
        e.preventDefault();
        hideFor(1500);
      } else if (e.metaKey && e.shiftKey) {
        hideFor(800); // capture chord being formed on macOS
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      // Windows only reports PrintScreen on keyup, after the capture -- clear what it grabbed
      if (e.key === "PrintScreen" || e.code === "PrintScreen") {
        wipeClipboard();
        hideFor(1500);
      }
    };
    const onBlur = () => {
      clearTimeout(revealTimer);
      setHidden(true);
    };
    const onFocus = () => hideFor(150);
    const onVisibility = () => (document.visibilityState === "hidden" ? onBlur() : onFocus());
    const block = (e: Event) => e.preventDefault();

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    window.addEventListener("beforeprint", onBlur);
    window.addEventListener("afterprint", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("copy", block);
    document.addEventListener("contextmenu", block);
    document.addEventListener("dragstart", block);

    return () => {
      clearTimeout(revealTimer);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("beforeprint", onBlur);
      window.removeEventListener("afterprint", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("copy", block);
      document.removeEventListener("contextmenu", block);
      document.removeEventListener("dragstart", block);
      activeGuards -= 1;
      if (activeGuards === 0) {
        document.documentElement.classList.remove("screenshot-guarded");
        setNativeSecure(false);
      }
    };
  }, [active]);

  return active && hidden;
}

/** Wraps protected content; renders a full-screen blackout while a capture is likely. */
export function ScreenshotGuard({
  children,
  className,
  active = true,
}: {
  children: ReactNode;
  className?: string;
  active?: boolean;
}) {
  const hidden = useScreenshotGuard(active);
  return (
    <div className={cn("screenshot-guard select-none [-webkit-touch-callout:none]", className)}>
      {children}
      {hidden &&
        (createPortal(
          <div
            aria-hidden
            className="fixed inset-0 z-[2147483647] flex flex-col items-center justify-center gap-3 bg-black px-8 text-center text-white"
          >
            <EyeOff className="h-8 w-8 text-white/80" />
            <p className="text-base font-semibold">Screenshots are not allowed</p>
            <p className="max-w-xs text-sm text-white/60">
              This post is protected and can&apos;t be captured.
            </p>
          </div>,
          document.body,
          // react-dom's bundled @types/react differs from the app's; the portal itself is fine
        ) as unknown as ReactNode)}
    </div>
  );
}
