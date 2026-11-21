import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError, apiValidationError } from "@/lib/api-response";
import { forumVoteSchema } from "@/lib/validation/forum";

/** Single-choice vote: re-voting changes your pick, enforced by the
 * `@@unique([pollId, userId])` constraint on ForumPollVote via upsert. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id: postId } = await params;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
    }
    const parsed = forumVoteSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const option = await prisma.forumPollOption.findUnique({
      where: { id: parsed.data.optionId },
      select: { id: true, pollId: true, poll: { select: { postId: true, closesAt: true } } },
    });
    if (!option || option.poll.postId !== postId) {
      return apiError(404, "NOT_FOUND", "This poll option doesn't exist.");
    }
    if (option.poll.closesAt && option.poll.closesAt <= new Date()) {
      return apiError(409, "POLL_CLOSED", "Voting has closed on this poll.");
    }

    await prisma.forumPollVote.upsert({
      where: { pollId_userId: { pollId: option.pollId, userId: user.id } },
      update: { optionId: option.id },
      create: { pollId: option.pollId, optionId: option.id, userId: user.id },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("forum/[id]/vote POST: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not record your vote.");
  }
}
