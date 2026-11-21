import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError, apiValidationError } from "@/lib/api-response";

const bodySchema = z.object({
  /** Specific notifications to mark read. Omit to mark everything read. */
  ids: z.array(z.string().min(1)).max(200).optional(),
});

/** POST /api/notifications/read -- mark some or all of the caller's notifications read. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();

    let body: unknown = {};
    try {
      body = await req.json();
    } catch {
      // empty body = mark all read
    }
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const { count } = await prisma.notification.updateMany({
      where: {
        userId: user.id,
        readAt: null,
        ...(parsed.data.ids ? { id: { in: parsed.data.ids } } : {}),
      },
      data: { readAt: new Date() },
    });

    return NextResponse.json({ ok: true, marked: count });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("notifications/read POST: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not update notifications.");
  }
}
