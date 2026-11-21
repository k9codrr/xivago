import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/db";

export const itemSchema = z.union([
  z.object({ demandId: z.string().min(1) }),
  z.object({ postId: z.string().min(1) }),
]);

const isImage = (u: string) => !/\.(mp4|webm|mov)(\?|$)/i.test(u);

/** First few picture URLs for a collection's 2x2 cover, newest first. */
export function coversOf(
  items: Array<{
    demand: { mediaUrls: string[] } | null;
    post: { attachments: Array<{ url: string; contentType: string }> } | null;
  }>,
): string[] {
  const out: string[] = [];
  for (const it of items) {
    const url =
      it.demand?.mediaUrls.find(isImage) ??
      it.post?.attachments.find((a) => a.contentType.startsWith("image/"))?.url ??
      null;
    if (url) out.push(url);
    if (out.length === 4) break;
  }
  return out;
}

export const COVER_ITEMS_SELECT = {
  orderBy: { createdAt: "desc" },
  take: 12,
  select: {
    demand: { select: { mediaUrls: true } },
    post: { select: { attachments: { where: { status: "APPROVED" }, select: { url: true, contentType: true }, take: 1 } } },
  },
} as const;

/**
 * Adds items to a collection. Anything not yet saved gets saved too (as on
 * Instagram, putting something in a collection saves it).
 */
export async function addItems(userId: string, collectionId: string, items: z.infer<typeof itemSchema>[]) {
  for (const it of items) {
    if ("demandId" in it) {
      const exists = await prisma.demand.findUnique({ where: { id: it.demandId }, select: { id: true } });
      if (!exists) continue;
      await prisma.bookmark.upsert({
        where: { userId_demandId: { userId, demandId: it.demandId } },
        create: { userId, demandId: it.demandId },
        update: {},
      });
      await prisma.bookmarkCollectionItem.upsert({
        where: { collectionId_demandId: { collectionId, demandId: it.demandId } },
        create: { collectionId, demandId: it.demandId },
        update: {},
      });
    } else {
      const exists = await prisma.forumMessage.findFirst({ where: { id: it.postId, deletedAt: null }, select: { id: true } });
      if (!exists) continue;
      await prisma.forumBookmark.upsert({
        where: { userId_postId: { userId, postId: it.postId } },
        create: { userId, postId: it.postId },
        update: {},
      });
      await prisma.bookmarkCollectionItem.upsert({
        where: { collectionId_postId: { collectionId, postId: it.postId } },
        create: { collectionId, postId: it.postId },
        update: {},
      });
    }
  }
  await prisma.bookmarkCollection.update({ where: { id: collectionId }, data: { updatedAt: new Date() } });
}
