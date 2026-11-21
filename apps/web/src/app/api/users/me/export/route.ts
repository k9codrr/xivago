import { NextResponse } from "next/server";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError } from "@/lib/api-response";
import { buildUserDataExport } from "@/lib/data-export";

export const dynamic = "force-dynamic";

/** Download a JSON copy of all the signed-in user's data (before deleting the account, or any time). */
export async function GET() {
  try {
    const user = await requireUser();
    const data = await buildUserDataExport(user.id);
    if (!data) return apiError(404, "NOT_FOUND", "Account not found.");

    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="xivago-my-data-${date}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("users/me/export: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not prepare your data. Please try again.");
  }
}
