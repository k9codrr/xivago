import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError } from "@/lib/api-response";
import { fetchPaymentDetails } from "@slotbook/payments";
import { getRazorpayCreds, isRazorpayConfigured } from "@/lib/razorpay-creds";

/** How the customer paid (UPI ID / card / bank) and every refund with its ARN/RRN, live from Razorpay. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const payment = await prisma.payment.findUnique({ where: { id }, select: { razorpayPaymentId: true } });
    if (!payment) return apiError(404, "NOT_FOUND", "Payment not found.");
    if (!payment.razorpayPaymentId) {
      return apiError(409, "NOT_PAID", "This payment never reached Razorpay, so there are no details.");
    }
    if (!isRazorpayConfigured()) return apiError(503, "PAYMENTS_NOT_CONFIGURED", "Razorpay isn't set up here.");
    return NextResponse.json(await fetchPaymentDetails(getRazorpayCreds(), payment.razorpayPaymentId));
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("admin/payments/details: unexpected error", err);
    const detail = (err as { error?: { description?: string } })?.error?.description;
    return apiError(502, "RAZORPAY_ERROR", detail ? `Razorpay: ${detail}` : "Could not load details from Razorpay.");
  }
}
