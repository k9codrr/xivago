import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError, apiValidationError } from "@/lib/api-response";

const bodySchema = z.object({ approve: z.boolean(), note: z.string().trim().max(200).optional() });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
    }
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const attachment = await prisma.forumAttachment.update({
      where: { id },
      data: {
        status: parsed.data.approve ? "APPROVED" : "REJECTED",
        moderationNote: parsed.data.note ?? (parsed.data.approve ? "Approved by admin" : "Rejected by admin"),
      },
    });

    return NextResponse.json({ attachment });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("admin/forum/attachments/moderate: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not update this attachment.");
  }
}
