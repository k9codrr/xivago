import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { env } from "@/lib/env";
import { runTrustJob } from "@/lib/trust";

/** Daily at 00:05 IST; the job itself only runs on the 1st, once per month. */
export async function GET(req: NextRequest) {
  if (!env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return apiError(401, "UNAUTHORIZED", "Missing or invalid cron secret.");
  }
  const result = await runTrustJob();
  return NextResponse.json({ ok: true, ...result, ranAt: new Date().toISOString() });
}
