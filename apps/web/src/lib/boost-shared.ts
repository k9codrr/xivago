/**
 * Featured-boost pricing, shared by the server routes and the drawers.
 * Prices come from the BoostSettings row (admin → Boosting); these defaults
 * are only used until it has loaded.
 */
export interface BoostConfig {
  pricePerDay: number;
  minDays: number;
  maxDays: number;
  extendPricePerDay: number;
  extendMinDays: number;
  extendMaxDays: number;
}

export type BoostMode = "new" | "extend";

export const DEFAULT_BOOST_CONFIG: BoostConfig = {
  pricePerDay: 30,
  minDays: 3,
  maxDays: 30,
  extendPricePerDay: 30,
  extendMinDays: 3,
  extendMaxDays: 30,
};

export const DAY_MS = 24 * 60 * 60 * 1000;

export function boostLimits(config: BoostConfig, mode: BoostMode) {
  return mode === "extend"
    ? { pricePerDay: config.extendPricePerDay, minDays: config.extendMinDays, maxDays: config.extendMaxDays }
    : { pricePerDay: config.pricePerDay, minDays: config.minDays, maxDays: config.maxDays };
}

export function boostCost(config: BoostConfig, mode: BoostMode, days: number): number {
  return boostLimits(config, mode).pricePerDay * days;
}

/** Clamp a day count into the allowed range for this mode. */
export function clampBoostDays(config: BoostConfig, mode: BoostMode, days: number): number {
  const { minDays, maxDays } = boostLimits(config, mode);
  return Math.min(Math.max(Math.round(days) || minDays, minDays), maxDays);
}

/** A post that was featured before (running or ended) is extended; otherwise it's a new boost. */
export function boostModeFor(priorityExpiresAt: string | Date | null | undefined): BoostMode {
  return priorityExpiresAt ? "extend" : "new";
}

/** Is the boost live right now? */
export function isBoostActive(isPriority: boolean, priorityExpiresAt: string | Date | null | undefined, now = Date.now()) {
  return isPriority && priorityExpiresAt != null && new Date(priorityExpiresAt).getTime() > now;
}

/**
 * When the boost will end. An extension of a running boost adds days to its
 * current end; anything else starts now.
 */
export function boostEndsAt(days: number, currentEnd: string | Date | null | undefined, now = Date.now()): Date {
  const end = currentEnd ? new Date(currentEnd).getTime() : 0;
  return new Date(Math.max(end, now) + days * DAY_MS);
}
