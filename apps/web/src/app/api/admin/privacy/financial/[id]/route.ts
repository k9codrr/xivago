import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError } from "@/lib/api-response";

/**
 * Full retained financial record (payments, invoices, credit ledger,
 * withdrawal requests, subscription) of a deleted account.
 * `id` is the AccountDeletionLog id. Add ?download=1 to get it as a JSON file.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const record = await prisma.retainedFinancialRecord.findUnique({ where: { deletionLogId: id } });
    if (!record) return apiError(404, "NOT_FOUND", "No financial record for this deleted account.");

    if (req.nextUrl.searchParams.get("download") === "1") {
      return new NextResponse(JSON.stringify(record, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="financial-record-${record.userId}.json"`,
        },
      });
    }
    return NextResponse.json({ record });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("admin/privacy/financial GET: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not load the financial record.");
  }
}
