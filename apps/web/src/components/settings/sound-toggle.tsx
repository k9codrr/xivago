"use client";

import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { playSound, setSoundsEnabled, soundsEnabled } from "@/lib/sounds";
import { cn } from "@/lib/utils";

/** Turns the app's UI sounds (send, success, credits, scan…) on or off for this device. */
export function SoundToggle() {
  const [on, setOn] = useState(true);
  useEffect(() => setOn(soundsEnabled()), []);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => {
        const next = !on;
        setSoundsEnabled(next);
        setOn(next);
        if (next) playSound("success");
      }}
      className="flex w-full items-center gap-3 rounded-2xl bg-neutral-900 px-4 py-3.5 text-left"
    >
      <span className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.08]">
        {on ? <Volume2 className="h-[18px] w-[18px]" /> : <VolumeX className="h-[18px] w-[18px] text-neutral-500" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium">Sounds</span>
        <span className="block text-[13px] text-neutral-500">Message sent, posted, credits added, QR scanned</span>
      </span>
      <span className={cn("relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors", on ? "bg-[#34C759]" : "bg-neutral-700")}>
        <span className={cn("absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow transition-transform", on ? "translate-x-[22px]" : "translate-x-[2px]")} />
      </span>
    </button>
  );
}
