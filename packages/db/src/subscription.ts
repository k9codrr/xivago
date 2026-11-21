export interface SubscriptionLike {
  plan: "FREE" | "PRO";
  status: "ACTIVE" | "CANCELLED" | "PAST_DUE" | "HALTED";
  currentPeriodEnd: Date | null;
}

/**
 * "subscription.cancelled/halted -> status CANCELLED/HALTED -> plan falls
 * back to FREE at period end (keep ACTIVE until currentPeriodEnd passes)"
 * (section 3.11). Read literally: the `status` column flips to
 * CANCELLED/HALTED immediately when Razorpay reports the cancellation, but
 * the user keeps PRO access until the period they already paid for
 * actually ends -- so PRO-ness is NOT simply `status === "ACTIVE"`, it's
 * "PRO plan AND (still actively billing OR still within a paid period)".
 */
export function isPro(subscription: SubscriptionLike | null | undefined): boolean {
  if (!subscription) return false;
  if (subscription.plan !== "PRO") return false;
  if (subscription.status === "ACTIVE") return true;
  if (subscription.currentPeriodEnd && subscription.currentPeriodEnd > new Date()) return true;
  return false;
}
