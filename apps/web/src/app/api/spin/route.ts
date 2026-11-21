import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError } from "@/lib/api-response";
import { getSpinStatus, spinWheel, NoSpinAvailableError, SPIN_SEGMENTS } from "@/lib/spin";

function authError(err: unknown) {
  if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
  if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
  return null;
}

/** Spin & Win status: which spins are available, when the next one unlocks, and recent wins. */
export async function GET() {
  try {
    const user = await requireUser();
    const [status, wins, profile] = await Promise.all([
      getSpinStatus(prisma, user.id),
      prisma.spinWin.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, kind: true, amount: true, createdAt: true },
      }),
      prisma.user.findUnique({ where: { id: user.id }, select: { creditBalance: true } }),
    ]);
    return NextResponse.json({
      status,
      wins,
      balance: profile?.creditBalance ?? 0,
      segments: SPIN_SEGMENTS.map((s) => s.credits),
    });
  } catch (err) {
    const res = authError(err);
    if (res) return res;
    console.error("spin GET: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not load Spin & Win.");
  }
}

/** Uses one available spin. The server picks the prize; the client only animates to `segmentIndex`. */
export async function POST() {
  try {
    const user = await requireUser();
    return NextResponse.json(await spinWheel(user.id));
  } catch (err) {
    if (err instanceof NoSpinAvailableError) {
      return apiError(409, "NO_SPIN_AVAILABLE", "You don't have a spin right now.");
    }
    const res = authError(err);
    if (res) return res;
    console.error("spin POST: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not spin the wheel. Try again.");
  }
}
