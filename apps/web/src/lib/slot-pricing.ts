/**
 * Slot pricing and demand post credit rules:
 * - Demand post creation costs 10 credits.
 * - Minimum 3 to maximum 100 bid slots per demand post.
 * - Slot bidding price: minimum 40 rupees (40 credits) per slot,
 *   else 0.1% of the set amount for that demand/promotion.
 *   1 credit = 1 Rupee (100 paise).
 */

export const DEMAND_POST_CREDIT_COST = 10;
export const MIN_BID_SLOTS = 3;
export const MAX_BID_SLOTS = 100;
export const MIN_BID_PRICE_RUPEES = 40;
export const BID_PRICE_PERCENTAGE = 0.001; // 0.1%

export interface SlotPriceInfo {
  rupees: number;
  credits: number;
  paise: number;
}

/**
 * Calculates slot bidding price in rupees, credits, and paise.
 * If budget is provided, takes 0.1% of the maximum budget (or min budget),
 * with a hard minimum floor of 40 rupees (40 credits).
 */
export function calculateSlotPrice(
  budgetMax?: number | null,
  budgetMin?: number | null
): SlotPriceInfo {
  const amount = budgetMax ?? budgetMin ?? 0;
  const percentAmount = Math.round(amount * BID_PRICE_PERCENTAGE);
  const rupees = Math.max(MIN_BID_PRICE_RUPEES, percentAmount);
  return {
    rupees,
    credits: rupees,
    paise: rupees * 100,
  };
}
