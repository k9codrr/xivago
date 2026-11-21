import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError, apiValidationError } from "@/lib/api-response";
import { COVER_ITEMS_SELECT, addItems, coversOf, itemSchema } from "@/lib/bookmark-collections";

const MAX_COLLECTIONS = 100;

const createSchema = z.object({
  name: z.string().trim().min(1, "Give your collection a name.").max(60),
  items: z.array(itemSchema).max(200).optional(),
});

/**
 * GET /api/bookmarks/collections
 * Instagram-style Saved screen: an "All saved" tile plus each collection, with
 * up to four cover photos and an item count.
 */
export async function GET() {
  try {
    const user = await requireUser();
    const [collections, demandSaves, postSaves] = await Promise.all([
      prisma.bookmarkCollection.findMany({
        where: { userId: user.id },
        orderBy: { updatedAt: "desc" },
        select: { id: true, name: true, updatedAt: true, _count: { select: { items: true } }, items: COVER_ITEMS_SELECT },
      }),
      prisma.bookmark.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        select: { demand: { select: { mediaUrls: true } } },
        take: 12,
      }),
      prisma.forumBookmark.findMany({
        where: { userId: user.id, post: { deletedAt: null } },
        orderBy: { createdAt: "desc" },
        select: { post: { select: { attachments: { where: { status: "APPROVED" }, select: { url: true, contentType: true }, take: 1 } } } },
        take: 12,
      }),
    ]);
    const [demandCount, postCount] = await Promise.all([
      prisma.bookmark.count({ where: { userId: user.id } }),
      prisma.forumBookmark.count({ where: { userId: user.id, post: { deletedAt: null } } }),
    ]);

    return NextResponse.json({
      all: {
        count: demandCount + postCount,
        covers: coversOf([
          ...postSaves.map((p) => ({ demand: null, post: p.post })),
          ...demandSaves.map((d) => ({ demand: d.demand, post: null })),
        ]),
      },
      collections: collections.map((c) => ({
        id: c.id,
        name: c.name,
        count: c._count.items,
        covers: coversOf(c.items),
        updatedAt: c.updatedAt,
      })),
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("bookmarks/collections GET: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not load your collections.");
  }
}

/** POST { name, items? } -- new collection, optionally with saved items in it already. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const parsed = createSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return apiValidationError(parsed.error);
    const { name, items = [] } = parsed.data;

    const total = await prisma.bookmarkCollection.count({ where: { userId: user.id } });
    if (total >= MAX_COLLECTIONS) return apiError(400, "LIMIT", "You've reached the collection limit.");
    const clash = await prisma.bookmarkCollection.findUnique({ where: { userId_name: { userId: user.id, name } }, select: { id: true } });
    if (clash) return apiError(409, "NAME_TAKEN", "You already have a collection with that name.");

    const collection = await prisma.bookmarkCollection.create({ data: { userId: user.id, name }, select: { id: true, name: true } });
    if (items.length) await addItems(user.id, collection.id, items);
    return NextResponse.json({ collection });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("bookmarks/collections POST: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not create the collection.");
  }
}
