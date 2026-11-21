import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError } from "@/lib/api-response";

export async function GET() {
  try {
    await requireAdmin();

    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);
    const startOfMonth = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));

    const [
      totalUsers,
      totalVendors,
      totalBusinesses,
      demandsToday,
      openDemands,
      slotsSoldTotal,
      slotsSoldToday,
      proSubscribers,
      openReports,
      pendingAttachments,
      mrrPaise,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: "VENDOR" } }),
      prisma.user.count({ where: { role: "BUSINESS" } }),
      prisma.demand.count({ where: { createdAt: { gte: startOfToday } } }),
      prisma.demand.count({ where: { status: "OPEN" } }),
      prisma.bid.count(),
      prisma.bid.count({ where: { createdAt: { gte: startOfToday } } }),
      prisma.subscription.count({ where: { plan: "PRO", status: "ACTIVE" } }),
      prisma.forumReport.count({ where: { status: "OPEN" } }),
      prisma.forumAttachment.count({ where: { status: "PENDING" } }),
      prisma.payment.aggregate({
        where: { type: "PLAN", status: "CAPTURED", createdAt: { gte: startOfMonth } },
        _sum: { amountPaise: true },
      }),
    ]);

    return NextResponse.json({
      users: { total: totalUsers, vendors: totalVendors, businesses: totalBusinesses },
      demands: { today: demandsToday, open: openDemands },
      slots: { total: slotsSoldTotal, today: slotsSoldToday },
      pro: { subscribers: proSubscribers, mrrPaise: mrrPaise._sum.amountPaise ?? 0 },
      moderation: { openReports, pendingAttachments },
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("admin/stats: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not load stats.");
  }
}
