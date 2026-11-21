import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError } from "@/lib/api-response";
import { FORUM_POST_SELECT, shapeForumPosts } from "@/lib/forum-post";

const PAGE_SIZE = 20;

/** GET ?cursor= — forum posts the signed-in user saved, newest save first. */
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const cursor = new URL(req.url).searchParams.get("cursor") || undefined;

    const rows = await prisma.forumBookmark.findMany({
      where: { userId: user.id, post: { deletedAt: null } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, post: { select: FORUM_POST_SELECT } },
    });

    const hasMore = rows.length > PAGE_SIZE;
    const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
    const posts = await shapeForumPosts(
      page.map((r) => r.post),
      user.id,
    );

    return NextResponse.json({ posts, nextCursor: hasMore ? page[page.length - 1]!.id : null });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("forum/bookmarks GET: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not load saved posts.");
  }
}
