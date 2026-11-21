import { z } from "zod";

export const slotOrderSchema = z.object({
  demandId: z.string().cuid(),
});
export type SlotOrderInput = z.infer<typeof slotOrderSchema>;

export const creditsOrderSchema = z.object({
  credits: z.coerce.number().int().min(10, "Minimum 10 credits required").max(100000),
});
export type CreditsOrderInput = z.infer<typeof creditsOrderSchema>;

export const paymentVerifySchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});
export type PaymentVerifyInput = z.infer<typeof paymentVerifySchema>;
