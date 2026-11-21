import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError } from "@/lib/api-response";

/**
 * The forum moderation queue: attachments awaiting review (fail-closed
 * default, see DECISIONS.md #45) and open user reports. Report targets
 * are polymorphic (ForumReport.targetId, no @relation -- same pattern as
 * ForumReaction), so the referenced post/comment text is fetched
 * separately and joined in application code.
 */
export async function GET() {
  try {
    await requireAdmin();

    const [attachments, reports] = await Promise.all([
      prisma.forumAttachment.findMany({
        where: { status: "PENDING" },
        select: {
          id: true,
          url: true,
          contentType: true,
          moderationNote: true,
          createdAt: true,
          message: { select: { id: true, text: true, sender: { select: { id: true, name: true, email: true } } } },
        },
        orderBy: { createdAt: "asc" },
        take: 100,
      }),
      prisma.forumReport.findMany({
        where: { status: "OPEN" },
        select: { id: true, targetType: true, targetId: true, reason: true, createdAt: true, reporter: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
        take: 100,
      }),
    ]);

    const messageIds = reports.filter((r) => r.targetType === "MESSAGE").map((r) => r.targetId);
    const commentIds = reports.filter((r) => r.targetType === "COMMENT").map((r) => r.targetId);

    const [messages, comments] = await Promise.all([
      prisma.forumMessage.findMany({ where: { id: { in: messageIds } }, select: { id: true, text: true, deletedAt: true } }),
      prisma.forumComment.findMany({ where: { id: { in: commentIds } }, select: { id: true, text: true, deletedAt: true } }),
    ]);
    const messageById = new Map(messages.map((m) => [m.id, m]));
    const commentById = new Map(comments.map((c) => [c.id, c]));

    const shapedReports = reports.map((r) => ({
      ...r,
      target: r.targetType === "MESSAGE" ? messageById.get(r.targetId) : commentById.get(r.targetId),
    }));

    return NextResponse.json({ attachments, reports: shapedReports });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("admin/forum/pending: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not load the moderation queue.");
  }
}
