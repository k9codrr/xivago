import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@slotbook/db";
import { env } from "@/lib/env";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized cron request" }, { status: 401 });
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Find users registered 30+ days ago who have no active subscription
  const expiredUsers = await prisma.user.findMany({
    where: {
      createdAt: { lte: thirtyDaysAgo },
      role: { not: "ADMIN" },
      OR: [
        { subscription: null },
        { subscription: { status: { not: "ACTIVE" } } },
      ],
    },
    select: { id: true, email: true },
  });

  const ids = expiredUsers.map((u) => u.id);

  if (ids.length > 0) {
    await prisma.user.deleteMany({
      where: { id: { in: ids } },
    });
  }

  return NextResponse.json({
    success: true,
    deletedCount: ids.length,
    deletedUserIds: ids,
  });
}
