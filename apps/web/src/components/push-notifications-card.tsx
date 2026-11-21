"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { disablePush, enablePush, getPushState, type PushState } from "@/lib/push-client";

/** Turns push on/off for *this device*. Takes effect immediately (no Save needed). */
export function PushNotificationsCard() {
  const [state, setState] = useState<PushState | "loading">("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getPushState()
      .then(setState)
      .catch(() => setState("unsupported"));
  }, []);

  if (state === "loading" || state === "unsupported") {
    return state === "unsupported" ? (
      <div className="px-4 py-3.5">
        <p className="text-[15px] font-medium text-neutral-900 dark:text-white">Push notifications</p>
        <p className="mt-0.5 text-[13px] leading-snug text-neutral-500 dark:text-neutral-400">
          Not available in this browser. On iPhone, add xivago to your Home Screen first.
        </p>
      </div>
    ) : null;
  }

  const enabled = state === "enabled";

  async function toggle() {
    setBusy(true);
    try {
      const next = enabled ? await disablePush() : await enablePush();
      setState(next);
      if (next === "enabled") toast.success("Push notifications turned on for this device.");
      else if (next === "denied") toast.error("Notifications are blocked. Allow them in your browser or phone settings.");
    } catch {
      toast.error("Could not update push notifications. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3.5">
      <div className="min-w-0">
        <p className="text-[15px] font-medium text-neutral-900 dark:text-white">Push on this device</p>
        <p className="mt-0.5 text-[13px] leading-snug text-neutral-500 dark:text-neutral-400">
          {state === "denied"
            ? "Blocked — allow notifications for xivago in your browser or phone settings."
            : "Instant alerts for new messages, responses to your requests and followers."}
        </p>
      </div>
      <Switch
        checked={enabled}
        onCheckedChange={() => void toggle()}
        disabled={busy || state === "denied"}
        aria-label="Push notifications on this device"
      />
    </div>
  );
}
