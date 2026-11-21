import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError, apiValidationError } from "@/lib/api-response";

const bodySchema = z.object({ userId: z.string().trim().min(1).max(64) });

/**
 * Records that the signed-in user scanned someone's profile QR on Explore
 * (fired by use-qr-scanner.ts right before it navigates to /u/[id]).
 * One row per pair; re-scans bump the count. Feeds the Recommended row.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
    }
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    // Profile QRs encode the user id, but /u/[id] also resolves usernames.
    const key = parsed.data.userId;
    const target = await prisma.user.findFirst({
      where: { OR: [{ id: key }, { username: key.toLowerCase() }], isBanned: false },
      select: { id: true },
    });
    if (!target) return apiError(404, "NOT_FOUND", "User not found.");
    if (target.id === user.id) return new NextResponse(null, { status: 204 });

    await prisma.qrScan.upsert({
      where: { scannerId_scannedId: { scannerId: user.id, scannedId: target.id } },
      create: { scannerId: user.id, scannedId: target.id },
      update: { count: { increment: 1 }, lastScannedAt: new Date() },
    });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("qr-scans POST: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not record the scan.");
  }
}

/**
 * GET /api/qr-scans?since=<ISO>
 * Who scanned the viewer's QR after `since` -- polled by the "Your QR Code"
 * drawer while it's open so the code can light up the moment it's scanned.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const sinceRaw = new URL(req.url).searchParams.get("since");
    const since = sinceRaw ? new Date(sinceRaw) : new Date(Date.now() - 10_000);
    if (Number.isNaN(since.getTime())) return apiError(400, "INVALID_SINCE", "Bad timestamp.");
    const scans = await prisma.qrScan.findMany({
      where: { scannedId: user.id, lastScannedAt: { gt: since } },
      orderBy: { lastScannedAt: "desc" },
      take: 5,
      select: { lastScannedAt: true, scanner: { select: { id: true, name: true, avatarUrl: true } } },
    });
    return NextResponse.json({ scans: scans.map((s) => ({ at: s.lastScannedAt, by: s.scanner })) });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    console.error("qr-scans GET: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not check scans.");
  }
}
