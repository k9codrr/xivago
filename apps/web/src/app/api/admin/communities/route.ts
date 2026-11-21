import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError, apiValidationError } from "@/lib/api-response";
import { communityCreateSchema, slugify } from "@/lib/validation/community";
import { isTextClean } from "@/lib/moderation";

/** Only admins create communities. Everyone else can browse and join them. */
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const parsed = communityCreateSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return apiValidationError(parsed.error);
    const { name, description, coverImage } = parsed.data;

    if (!isTextClean(name) || (description && !isTextClean(description))) {
      return apiError(422, "TEXT_MODERATION_FAILED", "This content may violate our content guidelines.");
    }

    let slug = slugify(name);
    if (!slug) slug = `community-${Date.now()}`;
    const existing = await prisma.community.findUnique({ where: { slug }, select: { id: true } });
    if (existing) slug = `${slug}-${Date.now().toString(36)}`;

    const community = await prisma.$transaction(async (tx) => {
      const created = await tx.community.create({
        data: { name, slug, description: description || null, coverImage, creatorId: admin.id },
      });
      await tx.communityMember.create({ data: { communityId: created.id, userId: admin.id } });
      return created;
    });

    return NextResponse.json({ community }, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("admin/communities POST: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not create this community.");
  }
}
