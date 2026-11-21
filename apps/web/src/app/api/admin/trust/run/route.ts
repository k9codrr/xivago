import { NextResponse } from "next/server";
import { requireAdmin, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError } from "@/lib/api-response";
import { runTrustJob } from "@/lib/trust";

/** Run the monthly trust rebuild now (skips the 1st-of-month / once-a-month guards). */
export async function POST() {
  try {
    await requireAdmin();
    return NextResponse.json(await runTrustJob({ force: true }));
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("admin/trust/run POST: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "The trust job failed.");
  }
}
