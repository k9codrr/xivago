"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export function MaskedBio({ bio }: { bio: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-1.5">
      <div className={cn("relative overflow-hidden", !expanded && "max-h-[96px]")}>
        <p className="whitespace-pre-wrap text-[15px] leading-6 text-neutral-400">{bio}</p>
        {!expanded && (
          <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/70 to-transparent" />
        )}
      </div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-1 text-sm font-semibold text-sapphire"
      >
        {expanded ? "Show less" : "Read more"}
      </button>
    </div>
  );
}