import { NextRequest, NextResponse } from "next/server";
import { prisma, ensureUsernames, isUsernameAvailable, Prisma } from "@/lib/db";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError, apiValidationError } from "@/lib/api-response";
import { profileEditSchema } from "@/lib/validation/profile";
import { normalizeProfileCategories } from "@/lib/category-selection";
import { z } from "zod";
import { requestMeta } from "@/lib/consent";
import { AccountDeletionError, deleteAccount } from "@/lib/account-deletion";

const OWN_PROFILE_SELECT = {
  id: true,
  email: true,
  name: true,
  username: true,
  role: true,
  bio: true,
  avatarUrl: true,
  companyName: true,
  companyLogo: true,
  website: true,
  phone: true,
  services: true,
  location: true,
  categorySubIds: true,
  categoryProviderIds: true,
  categoryProblemIds: true,
  creditBalance: true,
  isVerified: true,
  createdAt: true,
  headline: true,
  accountType: true,
  interestCategoryIds: true,
  onboarding: true,
  metaLink: { select: { notifPrefs: true, whatsappId: true } },
  subscription: { select: { plan: true, status: true, currentPeriodEnd: true } },
} as const;

export async function GET() {
  try {
    const user = await requireUser();
    const profile = await prisma.user.findUnique({
      where: { id: user.id },
      select: OWN_PROFILE_SELECT,
    });
    if (!profile) return apiError(404, "NOT_FOUND", "Profile not found.");
    // Accounts from before handles existed get one the first time they look
    if (!profile.username) profile.username = (await ensureUsernames(prisma, [user.id])).get(user.id) ?? null;
    return NextResponse.json({ profile });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("users/me GET: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not load your profile.");
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser();

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
    }

    // notifPrefs isn't part of profileEditSchema (it's not a User column --
    // it lives on MetaAccountLink), so it's plucked out and validated
    // separately before the rest of the body goes through the normal
    // profile schema.
    const { notifPrefs, ...profileBody } = body as { notifPrefs?: unknown };

    const parsed = profileEditSchema.safeParse(profileBody);
    if (!parsed.success) return apiValidationError(parsed.error);
    const data = parsed.data;
    // Category picks are optional in the payload; older clients that don't
    // send them leave the stored picks untouched.
    if (data.username !== undefined && !(await isUsernameAvailable(prisma, data.username, user.id))) {
      return apiError(409, "USERNAME_TAKEN", "That username is taken. Try another one.");
    }
    const hasCategoryPicks =
      data.categorySubIds !== undefined || data.categoryProviderIds !== undefined || data.categoryProblemIds !== undefined;

    const [updated] = await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          name: data.name,
          ...(data.username !== undefined ? { username: data.username } : {}),
          bio: data.bio ?? null,
          companyName: data.companyName ?? null,
          companyLogo: data.companyLogo ?? null,
          avatarUrl: data.avatarUrl ?? null,
          website: data.website ?? null,
          services: data.services,
          location: data.location ?? null,
          ...(hasCategoryPicks ? normalizeProfileCategories(data) : {}),
        },
        select: OWN_PROFILE_SELECT,
      }),
      ...(notifPrefs && typeof notifPrefs === "object"
        ? [
            prisma.metaAccountLink.upsert({
              where: { userId: user.id },
              update: { notifPrefs: notifPrefs as Prisma.InputJsonValue },
              create: { userId: user.id, notifPrefs: notifPrefs as Prisma.InputJsonValue },
            }),
          ]
        : []),
    ]);

    return NextResponse.json({ profile: updated });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return apiError(409, "USERNAME_TAKEN", "That username is taken. Try another one.");
    }
    console.error("users/me PATCH: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not save your profile.");
  }
}

const deleteSchema = z.object({
  // The user types DELETE in the confirmation dialog.
  confirm: z.literal("DELETE"),
  reason: z.string().max(500).optional(),
});

/**
 * Permanently delete the signed-in user's account and everything they posted.
 * Only a deletion log row survives -- see lib/account-deletion.ts.
 */
export async function DELETE(req: NextRequest) {
  try {
    const user = await requireUser();

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
    }
    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const result = await deleteAccount({ userId: user.id, reason: parsed.data.reason, ...requestMeta(req.headers) });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    if (err instanceof AccountDeletionError) {
      if (err.code === "ADMIN_ACCOUNT") {
        return apiError(403, "ADMIN_ACCOUNT", "Admin accounts can't be deleted from the app. Remove the admin role first.");
      }
      return apiError(404, "NOT_FOUND", "Account not found.");
    }
    console.error("users/me DELETE: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not delete your account. Please try again.");
  }
}
