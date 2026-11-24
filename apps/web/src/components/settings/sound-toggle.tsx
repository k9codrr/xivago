"use client";

import { Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Switch row for the app's UI sounds (send, success, credits, scan…).
 * Controlled: the settings page applies the choice when the user taps Save.
 */
export function SoundToggle({ value: on, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-white/[0.04]"
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-gradient-to-br from-pink-500 to-rose-600 text-white">
        {on ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium text-white">Sounds</span>
        <span className="block truncate text-[12.5px] text-neutral-500">Sent, posted, credits added, QR scanned</span>
      </span>
      <span className={cn("relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors", on ? "bg-[#34C759]" : "bg-neutral-700")}>
        <span
          className={cn(
            "absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow transition-transform",
            on ? "translate-x-[22px]" : "translate-x-[2px]",
          )}
        />
      </span>
    </button>
  );
}
