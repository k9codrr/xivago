import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma, applyCreditDelta, InsufficientCreditsError } from "@/lib/db";
import { requireAdmin, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError, apiValidationError } from "@/lib/api-response";
import { notifyAdminCreditAdjustment } from "@/lib/notifications";

const bodySchema = z.object({
  amount: z.number().int().refine((n) => n !== 0, "Amount must be non-zero"),
  note: z.string().trim().max(200).optional(),
});

/** Admin grant/deduct, per section 3.12/3.10 -- goes through applyCreditDelta like every other credit mutation, so the ledger and balance never drift. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
    }
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    try {
      const { balance } = await applyCreditDelta(prisma, {
        userId: id,
        amount: parsed.data.amount,
        type: "GRANT",
        note: parsed.data.note ?? "admin-adjustment",
      });
      void notifyAdminCreditAdjustment(id, parsed.data.amount, balance);
      return NextResponse.json({ balance });
    } catch (err) {
      if (err instanceof InsufficientCreditsError) {
        return apiError(409, "INSUFFICIENT_CREDITS", "This deduction would take the balance below zero.");
      }
      throw err;
    }
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("admin/users/credits: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not update credits.");
  }
}
