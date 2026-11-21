import { cn } from "@/lib/utils";
import { TIER_LABEL, TIER_STYLE, type TrustTierCode } from "@/lib/trust-labels";

/** Small tier chip next to a name. Renders nothing for NEW. */
export function TierMark({ tier, className }: { tier: TrustTierCode | null | undefined; className?: string }) {
  if (!tier || tier === "NEW") return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide",
        TIER_STYLE[tier],
        className,
      )}
    >
      {TIER_LABEL[tier]}
    </span>
  );
}
