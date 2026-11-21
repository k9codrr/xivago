import { NextResponse } from "next/server";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError } from "@/lib/api-response";
import { createRefundRequest, RefundError } from "@/lib/payment-refund";

/** POST { reason } — ask for this top-up to go back to the bank. An admin reviews it. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as { reason?: unknown };
    const request = await createRefundRequest(user.id, id, typeof body.reason === "string" ? body.reason : "");
    return NextResponse.json({ request }, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    if (err instanceof RefundError) return apiError(err.status, err.code, err.message);
    console.error("payments/refund-request POST: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not send your request.");
  }
}
