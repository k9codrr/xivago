import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError, apiValidationError } from "@/lib/api-response";
import { forumReactSchema } from "@/lib/validation/forum";
import { upsertReaction, removeReaction } from "@/lib/forum";
import { notifyPostReaction } from "@/lib/notifications";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const post = await prisma.forumMessage.findUnique({ where: { id }, select: { deletedAt: true } });
    if (!post || post.deletedAt) return apiError(404, "NOT_FOUND", "This post doesn't exist.");

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
    }
    const parsed = forumReactSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    await upsertReaction("MESSAGE", id, user.id, parsed.data.emoji);
    void notifyPostReaction(id, user.id, parsed.data.emoji);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("forum/[id]/react POST: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not react to this post.");
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await removeReaction("MESSAGE", id, user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("forum/[id]/react DELETE: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not remove your reaction.");
  }
}
