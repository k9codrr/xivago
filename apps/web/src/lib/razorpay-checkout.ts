"use client";

interface RazorpayOrderSuccessResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpaySubscriptionSuccessResponse {
  razorpay_subscription_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayCheckoutOptions {
  key: string;
  amount?: number; // paise -- omitted for subscription mode
  currency?: string;
  order_id?: string; // one-time payment mode (slots)
  subscription_id?: string; // subscription mode (PRO)
  name: string;
  description?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  handler: (response: RazorpayOrderSuccessResponse | RazorpaySubscriptionSuccessResponse) => void;
  modal?: { ondismiss?: () => void };
}

interface RazorpayInstance {
  open: () => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayInstance;
  }
}

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";
let loadPromise: Promise<void> | null = null;

function loadCheckoutScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = CHECKOUT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Razorpay Checkout."));
    document.body.appendChild(script);
  });

  return loadPromise;
}

/**
 * Opens Razorpay Checkout in one-time-payment mode (slot purchases) and
 * resolves with the client's success payload once the user completes
 * payment. This is ONLY the client-side handoff — the payment isn't
 * trusted until the server verifies the signature in
 * `POST /api/payments/verify` (§3.4/§10). Rejects if the user dismisses the
 * modal without paying.
 */
export async function openRazorpayCheckout(
  options: Omit<RazorpayCheckoutOptions, "handler" | "modal" | "subscription_id">,
): Promise<RazorpayOrderSuccessResponse> {
  const result = await openCheckoutInternal(options);
  return result as RazorpayOrderSuccessResponse;
}

/**
 * Opens Razorpay Checkout in subscription mode (PRO plan, §3.11) — same
 * underlying script, `subscription_id` instead of `order_id`/`amount`.
 */
export async function openRazorpaySubscriptionCheckout(
  options: Omit<RazorpayCheckoutOptions, "handler" | "modal" | "order_id" | "amount" | "currency">,
): Promise<RazorpaySubscriptionSuccessResponse> {
  const result = await openCheckoutInternal(options);
  return result as RazorpaySubscriptionSuccessResponse;
}

async function openCheckoutInternal(
  options: Omit<RazorpayCheckoutOptions, "handler" | "modal">,
): Promise<RazorpayOrderSuccessResponse | RazorpaySubscriptionSuccessResponse> {
  await loadCheckoutScript();
  if (!window.Razorpay) throw new Error("Razorpay Checkout failed to load.");

  return new Promise((resolve, reject) => {
    const instance = new window.Razorpay!({
      ...options,
      handler: (response) => resolve(response),
      modal: { ondismiss: () => reject(new Error("CHECKOUT_DISMISSED")) },
    });
    instance.open();
  });
}
