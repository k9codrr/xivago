"use client";

import { useCallback, useState } from "react";

/**
 * Client side of the consent flow. The checkbox records every tick / untick
 * with its time. On the login screen the user isn't signed in yet, so the
 * events wait in sessionStorage and <ConsentGate> sends them to
 * /api/consent right after sign-in.
 */
export type CheckboxEvent = {
  action: "checked" | "unchecked" | "age_checked" | "age_unchecked";
  at: string;
};

const PENDING_KEY = "xivago.pendingConsent";

/** Both boxes (Terms + Privacy, and "I am 18 or older") end up ticked in this event list. */
export function isFullConsent(events: CheckboxEvent[] | null | undefined): boolean {
  if (!events?.length) return false;
  const last = (kinds: CheckboxEvent["action"][]) => [...events].reverse().find((e) => kinds.includes(e.action))?.action;
  return last(["checked", "unchecked"]) === "checked" && last(["age_checked", "age_unchecked"]) === "age_checked";
}

export function useConsentCheckbox() {
  const [termsChecked, setTermsChecked] = useState(false);
  const [ageChecked, setAgeChecked] = useState(false);
  const [events, setEvents] = useState<CheckboxEvent[]>([]);

  const log = useCallback((action: CheckboxEvent["action"]) => {
    setEvents((prev) => [...prev, { action, at: new Date().toISOString() }].slice(-50));
  }, []);

  const toggle = useCallback(
    (next: boolean) => {
      setTermsChecked(next);
      log(next ? "checked" : "unchecked");
    },
    [log],
  );

  const toggleAge = useCallback(
    (next: boolean) => {
      setAgeChecked(next);
      log(next ? "age_checked" : "age_unchecked");
    },
    [log],
  );

  /** `checked` is true only when BOTH boxes are ticked. */
  return { checked: termsChecked && ageChecked, termsChecked, ageChecked, events, toggle, toggleAge };
}

export type ConsentState = ReturnType<typeof useConsentCheckbox>;

export function savePendingConsent(events: CheckboxEvent[]) {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(events));
  } catch {
    /* storage blocked: the in-app consent screen will ask instead */
  }
}

export function takePendingConsent(): CheckboxEvent[] | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PENDING_KEY);
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
