import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { env } from "@/lib/env";
import { runFeaturedCycleJob } from "@/lib/featured";

/** Hourly: close due auctions, end cycles, pull broken placements, notify, open the next window. */
export async function GET(req: NextRequest) {
  if (!env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return apiError(401, "UNAUTHORIZED", "Missing or invalid cron secret.");
  }
  const result = await runFeaturedCycleJob();
  return NextResponse.json({ ok: true, ...result, ranAt: new Date().toISOString() });
}
