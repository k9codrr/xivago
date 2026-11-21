import Razorpay from "razorpay";
import { createHmac, timingSafeEqual } from "node:crypto";

export interface RazorpayCredentials {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
}

let cachedClient: Razorpay | null = null;
let cachedKeySecret = "";

/**
 * Lazily constructs the Razorpay SDK client. Every core route imports
 * ONLY this package for anything Razorpay-related — never the `razorpay`
 * SDK directly — so signature verification and idempotency logic live in
 * exactly one place (§10).
 */
export function getRazorpayClient(creds: RazorpayCredentials): Razorpay {
  if (!cachedClient || cachedKeySecret !== creds.keySecret) {
    cachedClient = new Razorpay({ key_id: creds.keyId, key_secret: creds.keySecret });
    cachedKeySecret = creds.keySecret;
  }
  return cachedClient;
}

export interface CreateOrderInput {
  amountPaise: number;
  currency?: string;
  receipt: string;
  notes?: Record<string, string>;
}

export interface CreateOrderResult {
  razorpayOrderId: string;
  amountPaise: number;
  currency: string;
}

export async function createOrder(
  creds: RazorpayCredentials,
  input: CreateOrderInput,
): Promise<CreateOrderResult> {
  const client = getRazorpayClient(creds);
  const order = await client.orders.create({
    amount: input.amountPaise,
    currency: input.currency ?? "INR",
    receipt: input.receipt,
    notes: input.notes,
  });
  return {
    razorpayOrderId: order.id,
    amountPaise: Number(order.amount),
    currency: order.currency,
  };
}

/**
 * Constant-time HMAC-SHA256 compare, per §3.4/§10: signature is
 * HMAC-SHA256(`${orderId}|${paymentId}`, keySecret), and the comparison
 * MUST be constant-time to avoid a timing side-channel on payment forgery.
 */
export function verifyPaymentSignature(
  keySecret: string,
  orderId: string,
  paymentId: string,
  signature: string,
): boolean {
  const expected = createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex");
  return constantTimeEquals(expected, signature);
}

/**
 * Webhook signature verification (§3.4/§6): Razorpay signs the RAW request
 * body with `RAZORPAY_WEBHOOK_SECRET` and sends it in the
 * `X-Razorpay-Signature` header. The caller MUST pass the untouched raw
 * body string — re-serializing parsed JSON can produce a byte-for-byte
 * different string and break verification.
 */
export function verifyWebhookSignature(
  webhookSecret: string,
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  if (!signatureHeader) return false;
  const expected = createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
  return constantTimeEquals(expected, signatureHeader);
}

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  // timingSafeEqual throws if lengths differ, so check that (in non-secret-
  // dependent time — length alone isn't sensitive) before comparing.
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export interface CreateRefundInput {
  razorpayPaymentId: string;
  amountPaise?: number; // omit for a full refund
  notes?: Record<string, string>;
  /** "optimum" = instant where the bank supports it, else falls back to normal. */
  speed?: "normal" | "optimum";
}

export interface RefundResult {
  refundId: string;
  status: string;
  /** How Razorpay actually sent it; may be absent until processed. */
  speedProcessed?: "instant" | "normal";
}

/**
 * §3.4 step 5: if slot allocation fails after payment capture (demand
 * expired/filled mid-checkout), the payment MUST be automatically refunded
 * — money is never taken without a slot allocated.
 */
export async function createRefund(
  creds: RazorpayCredentials,
  input: CreateRefundInput,
): Promise<RefundResult> {
  const client = getRazorpayClient(creds);
  const refund = await client.payments.refund(input.razorpayPaymentId, {
    amount: input.amountPaise,
    notes: input.notes,
    ...(input.speed ? { speed: input.speed } : {}),
  });
  return {
    refundId: refund.id,
    status: refund.status ?? "processed",
    speedProcessed: (refund as { speed_processed?: "instant" | "normal" }).speed_processed,
  };
}

export interface PaymentMethodInfo {
  method: string; // upi | card | netbanking | wallet | emi | ...
  vpa: string | null;
  bank: string | null;
  wallet: string | null;
  cardLast4: string | null;
  cardNetwork: string | null;
  cardIssuer: string | null;
  email: string | null;
  contact: string | null;
  /** Bank reference for the original payment (UPI RRN, netbanking ref, card auth code). */
  paymentRrn: string | null;
}

export interface RefundInfo {
  id: string;
  amountPaise: number;
  status: string; // pending | processed | failed
  speedRequested: string | null;
  speedProcessed: string | null;
  /** ARN (cards), RRN (UPI) or UTR (bank transfer): what the customer's bank can trace. */
  arn: string | null;
  rrn: string | null;
  utr: string | null;
  createdAt: number; // unix seconds
}

/** Where the money came from and every refund on it — what a support agent needs. */
export async function fetchPaymentDetails(
  creds: RazorpayCredentials,
  razorpayPaymentId: string,
): Promise<{ method: PaymentMethodInfo; refunds: RefundInfo[] }> {
  const client = getRazorpayClient(creds);
  const [p, refundList] = await Promise.all([
    client.payments.fetch(razorpayPaymentId, { "expand[]": "card" }),
    client.payments.fetchMultipleRefund(razorpayPaymentId, { count: 100 }),
  ]);
  const raw = p as unknown as Record<string, unknown> & {
    card?: { last4?: string; network?: string; issuer?: string } | null;
    acquirer_data?: Record<string, string | null> | null;
  };
  const acq = raw.acquirer_data ?? {};
  const str = (v: unknown) => (typeof v === "string" && v ? v : null);

  return {
    method: {
      method: String(raw.method ?? "unknown"),
      vpa: str(raw.vpa),
      bank: str(raw.bank),
      wallet: str(raw.wallet),
      cardLast4: str(raw.card?.last4),
      cardNetwork: str(raw.card?.network),
      cardIssuer: str(raw.card?.issuer),
      email: str(raw.email),
      contact: str(raw.contact),
      paymentRrn: str(acq.rrn) ?? str(acq.bank_transaction_id) ?? str(acq.auth_code),
    },
    refunds: (refundList.items ?? []).map((r) => {
      const ra = r as unknown as Record<string, unknown> & { acquirer_data?: Record<string, string | null> | null };
      const a = ra.acquirer_data ?? {};
      return {
        id: String(ra.id),
        amountPaise: Number(ra.amount ?? 0),
        status: String(ra.status ?? "pending"),
        speedRequested: str(ra.speed_requested),
        speedProcessed: str(ra.speed_processed),
        arn: str(a.arn),
        rrn: str(a.rrn),
        utr: str(a.utr),
        createdAt: Number(ra.created_at ?? 0),
      };
    }),
  };
}

export interface PaymentCharges {
  status: string;
  amountPaise: number;
  /** Razorpay's fee for this payment, GST on the fee included (paise). */
  feePaise: number;
  /** The GST part of `feePaise` (paise). */
  taxPaise: number;
  amountRefundedPaise: number;
}

/** Reads a captured payment's gateway fee and GST so refunds can net them out. */
export async function fetchPaymentCharges(creds: RazorpayCredentials, razorpayPaymentId: string): Promise<PaymentCharges> {
  const client = getRazorpayClient(creds);
  const p = await client.payments.fetch(razorpayPaymentId);
  return {
    status: String(p.status),
    amountPaise: Number(p.amount ?? 0),
    feePaise: Number(p.fee ?? 0),
    taxPaise: Number(p.tax ?? 0),
    amountRefundedPaise: Number(p.amount_refunded ?? 0),
  };
}

// ── Subscriptions (full route wiring lands in M7; the client helpers live
// here now so M7 doesn't need to touch this package again) ────────────────

export interface CreateSubscriptionInput {
  planId: string;
  customerEmail: string;
  customerName: string;
  totalCount?: number; // billing cycles; omit for until-cancelled
}

export interface CreateSubscriptionResult {
  razorpaySubId: string;
  status: string;
  shortUrl?: string;
}

export async function createSubscription(
  creds: RazorpayCredentials,
  input: CreateSubscriptionInput,
): Promise<CreateSubscriptionResult> {
  const client = getRazorpayClient(creds);
  const sub = await client.subscriptions.create({
    plan_id: input.planId,
    total_count: input.totalCount ?? 120, // ~10 years of monthly cycles = effectively "until cancelled"
    quantity: 1,
    notes: { customerEmail: input.customerEmail, customerName: input.customerName },
  });
  return {
    razorpaySubId: sub.id,
    status: sub.status,
    shortUrl: (sub as unknown as { short_url?: string }).short_url,
  };
}

export async function cancelSubscription(
  creds: RazorpayCredentials,
  razorpaySubId: string,
  cancelAtCycleEnd = true,
): Promise<{ status: string }> {
  const client = getRazorpayClient(creds);
  const result = await client.subscriptions.cancel(razorpaySubId, cancelAtCycleEnd);
  return { status: result.status };
}
