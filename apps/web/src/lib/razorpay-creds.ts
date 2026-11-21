import "server-only";
import type { RazorpayCredentials } from "@slotbook/payments";
import { env } from "@/lib/env";

export function getRazorpayCreds(): RazorpayCredentials {
  return {
    keyId: env.RAZORPAY_KEY_ID,
    keySecret: env.RAZORPAY_KEY_SECRET,
    webhookSecret: env.RAZORPAY_WEBHOOK_SECRET,
  };
}

export function isRazorpayConfigured(): boolean {
  return Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
}
