import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiValidationError } from "@/lib/api-response";
import { featuredTrackSchema } from "@/lib/validation/featured";

/** Impression / click counters for the seller dashboard. Clients dedupe per session. */
export async function POST(req: NextRequest) {
  const parsed = featuredTrackSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return apiValidationError(parsed.error);
  const { placementId, event } = parsed.data;

  await prisma.featuredPlacement.updateMany({
    where: { id: placementId, status: "ACTIVE" },
    data: event === "impression" ? { impressions: { increment: 1 } } : { clicks: { increment: 1 } },
  });
  return NextResponse.json({ ok: true });
}
