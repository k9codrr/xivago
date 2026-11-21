/** Client-safe labels for the trust & badge system (see lib/trust.ts). */

export type TrustTierCode = "NEW" | "BRONZE" | "SILVER" | "GOLD";
export type TrustRoleCode = "VENDOR" | "SEEKER";
export type BadgeCode = "VERIFIED" | "FAST_RESPONDER" | "ON_TIME" | "REPEAT_CLIENTS";

export const TIER_ORDER: TrustTierCode[] = ["NEW", "BRONZE", "SILVER", "GOLD"];

export const TIER_LABEL: Record<TrustTierCode, string> = {
  NEW: "New",
  BRONZE: "Bronze",
  SILVER: "Silver",
  GOLD: "Gold",
};

/** Text + tint classes per tier, for chips and the small name mark. */
export const TIER_STYLE: Record<TrustTierCode, string> = {
  NEW: "bg-white/10 text-neutral-300",
  BRONZE: "bg-[#CD7F32]/15 text-[#E0A06A]",
  SILVER: "bg-[#C0C0C0]/15 text-[#D8D8DE]",
  GOLD: "bg-amber-400/15 text-amber-300",
};

export const ROLE_LABEL: Record<TrustRoleCode, string> = {
  VENDOR: "Provider",
  SEEKER: "Seeker",
};

export const BADGE_LABEL: Record<BadgeCode, string> = {
  VERIFIED: "Verified",
  FAST_RESPONDER: "Fast Responder",
  ON_TIME: "On-Time",
  REPEAT_CLIENTS: "Repeat Clients",
};

export function tierRank(t: TrustTierCode): number {
  return TIER_ORDER.indexOf(t);
}

/** Highest tier across roles (used where a single mark is shown). */
export function topTier(rows: Array<{ tier: TrustTierCode }> | undefined | null): TrustTierCode {
  return (rows ?? []).reduce<TrustTierCode>((best, r) => (tierRank(r.tier) > tierRank(best) ? r.tier : best), "NEW");
}

export function tierFor(rows: Array<{ role: TrustRoleCode; tier: TrustTierCode }> | undefined | null, role: TrustRoleCode): TrustTierCode {
  return rows?.find((r) => r.role === role)?.tier ?? "NEW";
}
