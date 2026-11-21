import { NextResponse } from "next/server";
import { requireAdmin, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError } from "@/lib/api-response";
import { rejectRefundRequest, RefundError } from "@/lib/payment-refund";

/** POST { note } — decline a refund request; the note is shown to the customer. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as { note?: unknown };
    await rejectRefundRequest(admin.id, id, typeof body.note === "string" ? body.note : "");
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    if (err instanceof RefundError) return apiError(err.status, err.code, err.message);
    console.error("admin/refund-requests/reject: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not decline the request.");
  }
}
