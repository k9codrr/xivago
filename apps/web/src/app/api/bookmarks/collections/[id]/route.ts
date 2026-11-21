import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError, apiValidationError } from "@/lib/api-response";
import { DEMAND_CARD_SELECT } from "@/lib/demand-access";
import { maskDemandAuthor } from "@/lib/demand-privacy";
import { FORUM_POST_SELECT, shapeForumPosts } from "@/lib/forum-post";
import { addItems, itemSchema } from "@/lib/bookmark-collections";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  add: z.array(itemSchema).max(200).optional(),
  remove: z.array(itemSchema).max(200).optional(),
});

async function own(userId: string, id: string) {
  const c = await prisma.bookmarkCollection.findUnique({ where: { id }, select: { id: true, userId: true, name: true } });
  return c && c.userId === userId ? c : null;
}

function handle(err: unknown, what: string) {
  if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
  if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
  console.error(`bookmarks/collections/[id] ${what}: unexpected error`, err);
  return apiError(500, "INTERNAL_ERROR", "Something went wrong with this collection.");
}

/** GET -- the collection's saved requests and feed posts, newest first. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const c = await own(user.id, id);
    if (!c) return apiError(404, "NOT_FOUND", "Collection not found.");

    const items = await prisma.bookmarkCollectionItem.findMany({
      where: { collectionId: id, OR: [{ demandId: { not: null } }, { post: { deletedAt: null } }] },
      orderBy: { createdAt: "desc" },
      take: 300,
      select: {
        createdAt: true,
        demand: { select: DEMAND_CARD_SELECT },
        post: { select: FORUM_POST_SELECT },
      },
    });

    const posts = await shapeForumPosts(
      items.flatMap((i) => (i.post ? [i.post] : [])),
      user.id,
    );
    const demands = items.flatMap((i) => (i.demand ? [maskDemandAuthor(i.demand, user)] : []));

    return NextResponse.json({ collection: { id: c.id, name: c.name }, demands, posts });
  } catch (err) {
    return handle(err, "GET");
  }
}

/** PATCH { name?, add?, remove? } -- rename, or put items in / take them out. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const c = await own(user.id, id);
    if (!c) return apiError(404, "NOT_FOUND", "Collection not found.");
    const parsed = patchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return apiValidationError(parsed.error);
    const { name, add, remove } = parsed.data;

    if (name && name !== c.name) {
      const clash = await prisma.bookmarkCollection.findUnique({ where: { userId_name: { userId: user.id, name } }, select: { id: true } });
      if (clash) return apiError(409, "NAME_TAKEN", "You already have a collection with that name.");
      await prisma.bookmarkCollection.update({ where: { id }, data: { name } });
    }
    if (add?.length) await addItems(user.id, id, add);
    if (remove?.length) {
      await prisma.bookmarkCollectionItem.deleteMany({
        where: {
          collectionId: id,
          OR: remove.map((r) => ("demandId" in r ? { demandId: r.demandId } : { postId: r.postId })),
        },
      });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handle(err, "PATCH");
  }
}

/** DELETE -- removes the collection only; the items stay saved under "All saved". */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const c = await own(user.id, id);
    if (!c) return apiError(404, "NOT_FOUND", "Collection not found.");
    await prisma.bookmarkCollection.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handle(err, "DELETE");
  }
}
