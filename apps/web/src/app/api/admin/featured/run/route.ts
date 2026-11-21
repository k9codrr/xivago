import { NextResponse } from "next/server";
import { requireAdmin, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError } from "@/lib/api-response";
import { runFeaturedCycleJob } from "@/lib/featured";

/** Run the hourly cycle job now (useful locally where Vercel cron doesn't fire). */
export async function POST() {
  try {
    await requireAdmin();
    return NextResponse.json(await runFeaturedCycleJob());
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("admin/featured/run POST: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "The cycle job failed.");
  }
}
