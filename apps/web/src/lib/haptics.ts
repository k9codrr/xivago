"use client";

/**
 * Shared haptic feedback engine.
 *
 * - Inside the Capacitor native shell → uses @capacitor/haptics (Taptic Engine / Android vibrator).
 * - In a regular browser → falls back to navigator.vibrate() where supported (Android Chrome).
 * - Everywhere else → silently no-ops. Haptics must never throw or block UI.
 */

export type HapticType =
  | "light" // small taps: tabs, chips, toggles
  | "medium" // standard button presses
  | "heavy" // primary navigation, big gestures
  | "selection" // scrubbing / picking between options
  | "success" // an action completed
  | "warning" // needs attention
  | "error"; // an action failed

type CapacitorHaptics = typeof import("@capacitor/haptics");

let capacitorModule: Promise<CapacitorHaptics | null> | null = null;

function loadCapacitor(): Promise<CapacitorHaptics | null> {
  if (!capacitorModule) {
    capacitorModule = import("@capacitor/haptics").catch(() => null);
  }
  return capacitorModule;
}

function isNative(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

// Durations match @capacitor/haptics' own web implementation — anything
// much shorter than ~20ms is imperceptible on most Android vibrators.
const WEB_PATTERNS: Record<HapticType, number | number[]> = {
  light: 20,
  medium: 43,
  heavy: 61,
  selection: 15,
  success: [35, 65, 21],
  warning: [22, 61, 35],
  error: [61, 83, 61, 83, 61],
};

function vibrateWeb(type: HapticType) {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(WEB_PATTERNS[type]);
    }
  } catch {
    // ignore
  }
}

const TAP_TYPES: ReadonlySet<HapticType> = new Set(["light", "medium", "heavy", "selection"]);
const TAP_DEDUPE_MS = 80;
let lastTapAt = 0;

export async function haptic(type: HapticType = "light"): Promise<void> {
  if (typeof window === "undefined") return;

  // The global tap handler (GlobalHaptics) already fired a tap for this
  // press — skip component-level tap calls so one press = one buzz.
  // Outcome feedback (success/warning/error) always goes through.
  if (TAP_TYPES.has(type)) {
    const now = Date.now();
    if (now - lastTapAt < TAP_DEDUPE_MS) return;
    lastTapAt = now;
  }

  // Capacitor's web shim needs selectionStart() before selectionChanged(),
  // so handle selection ourselves outside the native shell.
  if (type === "selection" && !isNative()) {
    vibrateWeb(type);
    return;
  }

  // Always go through @capacitor/haptics (like the original bottom nav did):
  // it talks to the native bridge when present and falls back to its own
  // navigator.vibrate() implementation otherwise. Don't gate on
  // isNativePlatform() — it can be false when the shell loads a remote URL.
  try {
    const mod = await loadCapacitor();
    if (!mod) return vibrateWeb(type);
    const { Haptics, ImpactStyle, NotificationType } = mod;

    switch (type) {
      case "light":
        return await Haptics.impact({ style: ImpactStyle.Light });
      case "medium":
        return await Haptics.impact({ style: ImpactStyle.Medium });
      case "heavy":
        return await Haptics.impact({ style: ImpactStyle.Heavy });
      case "selection":
        return await Haptics.selectionChanged();
      case "success":
        return await Haptics.notification({ type: NotificationType.Success });
      case "warning":
        return await Haptics.notification({ type: NotificationType.Warning });
      case "error":
        return await Haptics.notification({ type: NotificationType.Error });
    }
  } catch {
    // Plugin unavailable/failed — try the raw Vibration API, never throw
    vibrateWeb(type);
  }
}
