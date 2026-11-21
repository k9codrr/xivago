import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@slotbook/db";
import { requireUser, UnauthorizedError } from "@/lib/guards";
import { apiError } from "@/lib/api-response";
import { DEMAND_CARD_SELECT } from "@/lib/demand-access";
import { maskDemandAuthor } from "@/lib/demand-privacy";

export async function GET() {
  try {
    const user = await requireUser();

    const bookmarks = await prisma.bookmark.findMany({
      where: { userId: user.id },
      include: { demand: { select: DEMAND_CARD_SELECT } },
      orderBy: { createdAt: "desc" },
    });

    const demands = bookmarks.map((b) => ({
      ...maskDemandAuthor(b.demand, user),
      bookmarkedAt: b.createdAt,
    }));

    return NextResponse.json({ demands });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    }
    console.error("GET /api/bookmarks error:", err);
    return apiError(500, "INTERNAL_ERROR", "Could not fetch bookmarks.");
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const { demandId } = body;

    if (!demandId || typeof demandId !== "string") {
      return apiError(400, "INVALID_INPUT", "demandId is required.");
    }

    const bookmark = await prisma.bookmark.upsert({
      where: {
        userId_demandId: {
          userId: user.id,
          demandId,
        },
      },
      create: {
        userId: user.id,
        demandId,
      },
      update: {},
    });

    return NextResponse.json({ success: true, bookmark });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    }
    console.error("POST /api/bookmarks error:", err);
    return apiError(500, "INTERNAL_ERROR", "Could not save bookmark.");
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const demandId = searchParams.get("demandId");

    if (!demandId) {
      return apiError(400, "INVALID_INPUT", "demandId parameter required.");
    }

    await prisma.bookmark.deleteMany({
      where: {
        userId: user.id,
        demandId,
      },
    });
    // Un-saving takes it out of every collection too (Instagram behaviour).
    await prisma.bookmarkCollectionItem.deleteMany({ where: { demandId, collection: { userId: user.id } } });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    }
    console.error("DELETE /api/bookmarks error:", err);
    return apiError(500, "INTERNAL_ERROR", "Could not delete bookmark.");
  }
}
