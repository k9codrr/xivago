import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError } from "@/lib/api-response";

/**
 * Wallet summary for /checkout. Lives under /api/users/me so it stays
 * reachable for trial-expired users (see the payment allow-list in
 * middleware.ts) -- they land on /checkout and still need to see their balance.
 */

type SpendCategory = "POSTING" | "BOOSTS" | "SLOTS" | "OTHER";

function spendCategory(type: string, note: string | null): SpendCategory {
  if (note === "post-demand-fee") return "POSTING";
  if (note?.startsWith("priority-boost") || type === "FEATURED_HOLD") return "BOOSTS";
  if (note?.startsWith("slot-purchase")) return "SLOTS";
  return "OTHER";
}

export async function GET() {
  try {
    const user = await requireUser();

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [profile, monthDebits, recentCredits] = await Promise.all([
      prisma.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          creditBalance: true,
          subscription: { select: { plan: true, status: true, currentPeriodEnd: true } },
        },
      }),
      prisma.creditTransaction.findMany({
        where: { userId: user.id, amount: { lt: 0 }, createdAt: { gte: monthStart } },
        select: { amount: true, type: true, note: true },
      }),
      prisma.creditTransaction.findMany({
        where: { userId: user.id, amount: { gt: 0 } },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, amount: true, type: true, note: true },
      }),
    ]);
    if (!profile) return apiError(404, "NOT_FOUND", "Profile not found.");

    const spending: Record<SpendCategory, number> = { POSTING: 0, BOOSTS: 0, SLOTS: 0, OTHER: 0 };
    for (const t of monthDebits) spending[spendCategory(t.type, t.note)] += -t.amount;

    // Up to four distinct recent sources of incoming credits: one tile each
    // per ledger type (top-ups, grants, refunds…).
    const seen = new Set<string>();
    const sources: { key: string; type: string }[] = [];
    for (const t of recentCredits) {
      if (seen.has(t.type)) continue;
      seen.add(t.type);
      sources.push({ key: t.type, type: t.type });
      if (sources.length === 4) break;
    }

    return NextResponse.json({
      profile,
      spending,
      received: sources,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("users/me/wallet GET: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not load your wallet.");
  }
}
