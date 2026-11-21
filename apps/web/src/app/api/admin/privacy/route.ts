import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError } from "@/lib/api-response";

const PAGE_SIZE = 100;

/**
 * Admin privacy logs.
 *   ?type=consents  -> ConsentLog rows (newest first), with the user's current
 *                      name/email when the account still exists
 *   ?type=deletions -> AccountDeletionLog rows (newest first)
 * Optional ?q= filters consents by name/email/user id, deletions by user id,
 * email, phone or name (from the retained financial record).
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const type = req.nextUrl.searchParams.get("type") === "deletions" ? "deletions" : "consents";
    const q = req.nextUrl.searchParams.get("q")?.trim() || null;

    if (type === "deletions") {
      const deletions = await prisma.accountDeletionLog.findMany({
        where: q
          ? {
              OR: [
                { userId: q },
                { maskedEmail: { contains: q, mode: "insensitive" } },
                { financialRecord: { is: { email: { contains: q, mode: "insensitive" } } } },
                { financialRecord: { is: { phone: { contains: q } } } },
                { financialRecord: { is: { name: { contains: q, mode: "insensitive" } } } },
              ],
            }
          : undefined,
        orderBy: { deletedAt: "desc" },
        take: PAGE_SIZE,
        include: {
          financialRecord: {
            select: { id: true, name: true, email: true, phone: true, totals: true, retainUntil: true },
          },
        },
      });
      const total = await prisma.accountDeletionLog.count();
      return NextResponse.json({ deletions, total });
    }

    let userFilter: string[] | undefined;
    if (q) {
      const matches = await prisma.user.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        },
        select: { id: true },
        take: 200,
      });
      userFilter = [q, ...matches.map((m) => m.id)];
    }

    const consents = await prisma.consentLog.findMany({
      where: userFilter ? { userId: { in: userFilter } } : undefined,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
    });
    const users = await prisma.user.findMany({
      where: { id: { in: [...new Set(consents.map((c) => c.userId))] } },
      select: { id: true, name: true, email: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));
    const total = await prisma.consentLog.count();

    return NextResponse.json({
      consents: consents.map((c) => ({ ...c, user: byId.get(c.userId) ?? null })),
      total,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("admin/privacy GET: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not load privacy logs.");
  }
}
