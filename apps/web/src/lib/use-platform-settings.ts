"use client";

import { useEffect, useState } from "react";

let cachedOfferSlotsEnabled: boolean | null = null;
let inflight: Promise<boolean> | null = null;

async function fetchSetting(): Promise<boolean> {
  try {
    const res = await fetch("/api/platform-settings");
    if (!res.ok) return true;
    const data = (await res.json()) as { offerSlotsEnabled?: boolean };
    return typeof data.offerSlotsEnabled === "boolean" ? data.offerSlotsEnabled : true;
  } catch {
    return true;
  }
}

export function useOfferSlotsEnabled(): boolean {
  const [enabled, setEnabled] = useState<boolean>(cachedOfferSlotsEnabled ?? true);

  useEffect(() => {
    if (cachedOfferSlotsEnabled !== null) {
      setEnabled(cachedOfferSlotsEnabled);
      return;
    }
    inflight ??= fetchSetting().then((val) => {
      cachedOfferSlotsEnabled = val;
      inflight = null;
      return val;
    });
    void inflight.then((val) => setEnabled(val));
  }, []);

  return enabled;
}
