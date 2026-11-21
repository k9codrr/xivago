import { NextResponse } from "next/server";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError } from "@/lib/api-response";
import { cancelRefundRequest, RefundError } from "@/lib/payment-refund";

/** DELETE — the user withdraws their own open refund request. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await cancelRefundRequest(user.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    if (err instanceof RefundError) return apiError(err.status, err.code, err.message);
    console.error("refund-requests DELETE: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not withdraw the request.");
  }
}
