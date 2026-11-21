import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError, apiValidationError } from "@/lib/api-response";
import { commentUrl } from "@/lib/notifications";

const querySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});

/**
 * Comment notifications written before deep links existed point at the feed
 * (or a community). Send them to the post, and to the comment when it's known.
 */
function withCommentLink<T extends { type: string; url: string | null; data: unknown; entityId: string | null }>(n: T) {
  const { entityId, ...rest } = n;
  if (n.url?.startsWith("/forum/")) return rest;
  const data = (n.data ?? {}) as { postId?: string; commentId?: string };
  if (n.type === "comment_reaction" && data.postId) return { ...rest, url: commentUrl(data.postId, entityId) };
  if (n.type === "post_comment" && entityId) return { ...rest, url: commentUrl(entityId, data.commentId) };
  return rest;
}

/** GET /api/notifications -- the signed-in user's inbox, newest first, cursor-paginated. */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
    if (!parsed.success) return apiValidationError(parsed.error);
    const { cursor, limit } = parsed.data;

    const [rows, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          url: true,
          entityId: true,
          data: true,
          readAt: true,
          createdAt: true,
          actor: { select: { id: true, name: true, avatarUrl: true } },
        },
      }),
      prisma.notification.count({ where: { userId: user.id, readAt: null } }),
    ]);

    const hasMore = rows.length > limit;
    const notifications = (hasMore ? rows.slice(0, limit) : rows).map(withCommentLink);

    return NextResponse.json({
      notifications,
      nextCursor: hasMore ? notifications[notifications.length - 1]!.id : null,
      unreadCount,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("notifications GET: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not load notifications.");
  }
}
