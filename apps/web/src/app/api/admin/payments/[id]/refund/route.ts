import { NextResponse } from "next/server";
import { requireAdmin, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError } from "@/lib/api-response";
import { getRefundQuote, refundPayment, RefundError } from "@/lib/payment-refund";

type Ctx = { params: Promise<{ id: string }> };

function handle(err: unknown, where: string) {
  if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
  if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
  if (err instanceof RefundError) return apiError(err.status, err.code, err.message);
  console.error(`admin/payments/refund ${where}: unexpected error`, err);
  return apiError(500, "INTERNAL_ERROR", "Could not process the refund.");
}

/** GET ?instant=1 — what the customer would get back: unspent share minus gateway fee + GST (+ instant fee). */
export async function GET(req: Request, { params }: Ctx) {
  try {
    await requireAdmin();
    const { id } = await params;
    const instant = new URL(req.url).searchParams.get("instant") === "1";
    return NextResponse.json({ quote: await getRefundQuote(id, { instant }) });
  } catch (err) {
    return handle(err, "GET");
  }
}

/** POST { instant?: boolean } — refund via Razorpay and take back the unspent credits. */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as { instant?: unknown };
    return NextResponse.json({ refund: await refundPayment(id, admin.id, { instant: body.instant === true }) });
  } catch (err) {
    return handle(err, "POST");
  }
}
