import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError } from "@/lib/api-response";
import { findOrCreateDirectConversation, NotProError, SelfMessageError } from "@/lib/direct-conversation";

/**
 * Finds the most recent existing conversation between the viewer and the
 * given profile's user, across any demand. If none exists, opens a new
 * demand-less ("direct") conversation -- a normal chat for PRO viewers, a
 * message request for everyone else -- backs the "Message" button on a
 * public profile.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id: otherUserId } = await params;

    const conversation = await prisma.conversation.findFirst({
      where: {
        OR: [
          { buyerId: user.id, bidderId: otherUserId },
          { buyerId: otherUserId, bidderId: user.id },
        ],
      },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    });
    if (conversation) return NextResponse.json({ conversation });

    const direct = await findOrCreateDirectConversation(user.id, otherUserId);
    if (!direct) return apiError(404, "NOT_FOUND", "This user doesn't exist.");

    return NextResponse.json({ conversation: direct });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    if (err instanceof SelfMessageError) return apiError(400, "INVALID_TARGET", err.message);
    if (err instanceof NotProError) {
      return apiError(
        404,
        "NO_CONVERSATION",
        "You'll be able to chat once you're connected through a request — or upgrade to PRO to message anyone.",
      );
    }
    console.error("users/conversation: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not look up this conversation.");
  }
}
