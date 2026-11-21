import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { getBoostSettings } from "@/lib/boost";

/** Public: per-day featured-boost pricing and day limits, for the post / boost drawers. */
export async function GET() {
  try {
    const { updatedAt: _updatedAt, ...settings } = await getBoostSettings();
    return NextResponse.json({ settings });
  } catch (err) {
    console.error("boost-settings GET: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not load boost pricing.");
  }
}
