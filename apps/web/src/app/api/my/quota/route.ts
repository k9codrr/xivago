import { NextResponse } from "next/server";
import { prisma, getMonthlyDemandQuota, isPro } from "@/lib/db";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError } from "@/lib/api-response";

export async function GET() {
  try {
    const user = await requireUser();
    const [quota, dbUser] = await Promise.all([
      getMonthlyDemandQuota(prisma, user.id),
      prisma.user.findUnique({ where: { id: user.id }, select: { subscription: true } }),
    ]);
    const unlimited = isPro(dbUser?.subscription);
    return NextResponse.json({ quota: { ...quota, unlimited } });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("my/quota: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not load your quota.");
  }
}
