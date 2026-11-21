import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOptionalUser, requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError, apiValidationError } from "@/lib/api-response";
import { forumCommentCreateSchema } from "@/lib/validation/forum";
import { isTextClean } from "@/lib/moderation";
import { getReactionSummaries } from "@/lib/forum";
import { notifyPostComment } from "@/lib/notifications";

const COMMENT_SELECT = {
  id: true,
  text: true,
  createdAt: true,
  senderId: true,
  sender: { select: { id: true, name: true, avatarUrl: true, companyName: true, role: true } },
} as const;

/** Comments are open to any logged-in user -- not PRO-gated, see DECISIONS.md #44. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getOptionalUser();
  const { id: messageId } = await params;

  const post = await prisma.forumMessage.findUnique({ where: { id: messageId }, select: { deletedAt: true } });
  if (!post || post.deletedAt) return apiError(404, "NOT_FOUND", "This post doesn't exist.");

  // `focus` = a comment a notification links to. Load at least up to it, even
  // past the usual 200, so the page can scroll to it.
  let take = 200;
  const focusId = req.nextUrl.searchParams.get("focus");
  if (focusId) {
    const focus = await prisma.forumComment.findFirst({
      where: { id: focusId, messageId, deletedAt: null },
      select: { createdAt: true },
    });
    if (focus) {
      const upToFocus = await prisma.forumComment.count({
        where: { messageId, deletedAt: null, createdAt: { lte: focus.createdAt } },
      });
      take = Math.max(take, upToFocus + 20);
    }
  }

  const comments = await prisma.forumComment.findMany({
    where: { messageId, deletedAt: null },
    select: COMMENT_SELECT,
    orderBy: { createdAt: "asc" },
    take,
  });

  const reactions = await getReactionSummaries(
    "COMMENT",
    comments.map((c) => c.id),
    viewer?.id ?? null,
  );

  const shaped = comments.map((c) => ({
    ...c,
    reactions: reactions.get(c.id) ?? { counts: {}, total: 0, myReaction: null },
    isMine: viewer?.id === c.senderId,
  }));

  return NextResponse.json({ comments: shaped });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id: messageId } = await params;

    const post = await prisma.forumMessage.findUnique({ where: { id: messageId }, select: { deletedAt: true } });
    if (!post || post.deletedAt) return apiError(404, "NOT_FOUND", "This post doesn't exist.");

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
    }
    const parsed = forumCommentCreateSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    if (!isTextClean(parsed.data.text)) {
      return apiError(422, "TEXT_MODERATION_FAILED", "This comment may violate our content guidelines.");
    }

    const comment = await prisma.forumComment.create({
      data: { messageId, senderId: user.id, text: parsed.data.text },
      select: COMMENT_SELECT,
    });
    void notifyPostComment(messageId, user.id, parsed.data.text, comment.id);

    return NextResponse.json(
      { comment: { ...comment, reactions: { counts: {}, total: 0, myReaction: null }, isMine: true } },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("forum/[id]/comments POST: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not post your comment.");
  }
}
