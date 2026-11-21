import { NextResponse } from "next/server";
import { prisma, type Prisma } from "@/lib/db";
import { requireAdmin, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError } from "@/lib/api-response";

const PAGE_SIZE = 50;

/**
 * Admin invoice lookup. `q` matches any part of an invoice ID, invoice number,
 * customer (user) ID, post (demand) ID, customer email or name. The whole table
 * is searched; results come back a page at a time via `cursor` (the last id).
 */
export async function GET(req: Request) {
  try {
    await requireAdmin();

    const params = new URL(req.url).searchParams;
    const q = params.get("q")?.trim() ?? "";
    const cursor = params.get("cursor") || undefined;

    const contains = { contains: q, mode: "insensitive" } as const;
    const where: Prisma.InvoiceWhereInput = q
      ? {
          OR: [
            { id: contains },
            { number: contains },
            { userId: contains },
            { demandId: contains },
            { user: { email: contains } },
            { user: { name: contains } },
          ],
        }
      : {};

    const rows = await prisma.invoice.findMany({
      where,
      select: {
        id: true,
        number: true,
        kind: true,
        title: true,
        items: true,
        totalCredits: true,
        balanceAfter: true,
        demandId: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > PAGE_SIZE;
    const invoices = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
    const total = await prisma.invoice.count({ where });

    return NextResponse.json({ invoices, total, nextCursor: hasMore ? invoices[invoices.length - 1]!.id : null });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("admin/invoices GET: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not load invoices.");
  }
}
