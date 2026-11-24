import { NextRequest, NextResponse } from "next/server";
import { prisma, ensureUsernames, isUsernameAvailable, Prisma } from "@/lib/db";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError, apiValidationError } from "@/lib/api-response";
import { normalizeProfileCategories } from "@/lib/category-selection";
import { getParentCategoryById } from "@/lib/categories";
import { ONBOARDED_COOKIE, roleForGoal, onboardingSchema, type OnboardingExtras } from "@/lib/onboarding";
import { recordConsent, requestMeta } from "@/lib/consent";

/** What the onboarding screens prefill from: anything the account already has. */
export async function GET() {
  try {
    const user = await requireUser();
    const me = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        name: true,
        username: true,
        avatarUrl: true,
        bio: true,
        companyName: true,
        companyLogo: true,
        website: true,
        location: true,
        phone: true,
        ageConfirmedAt: true,
        referredById: true,
        onboardedAt: true,
        metaLink: { select: { whatsappId: true } },
      },
    });
    if (!me) return apiError(404, "NOT_FOUND", "Account not found.");
    const username = me.username ?? (await ensureUsernames(prisma, [user.id])).get(user.id) ?? null;
    const phoneVerified = Boolean(me.phone) && me.metaLink?.whatsappId === me.phone?.replace(/^\+/, "");
    return NextResponse.json({
      // Placeholder names from phone / Facebook signups aren't worth prefilling.
      name: me.name === "xivago user" ? "" : me.name,
      username,
      avatarUrl: me.avatarUrl,
      bio: me.bio,
      companyName: me.companyName,
      companyLogo: me.companyLogo,
      website: me.website,
      location: me.location,
      phone: me.phone,
      phoneVerified,
      ageConfirmed: me.ageConfirmedAt != null,
      hasReferrer: me.referredById != null,
      onboarded: me.onboardedAt != null,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("onboarding GET: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not load your details.");
  }
}

/** Saves the whole flow at once and marks the account onboarded. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
    }
    const parsed = onboardingSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);
    const d = parsed.data;

    if (d.username && !(await isUsernameAvailable(prisma, d.username, user.id))) {
      return apiError(409, "USERNAME_TAKEN", "That username is taken. Try another one.");
    }

    const provides = d.goal !== "BUY";
    const buys = d.goal !== "PROVIDE";
    const business = d.accountType === "BUSINESS";
    const interests = buys ? d.interestCategoryIds.filter((id) => getParentCategoryById(id)) : [];
    const offer = provides
      ? normalizeProfileCategories({ categorySubIds: d.categorySubIds, categoryProviderIds: d.categoryProviderIds })
      : null;

    const extras: OnboardingExtras = {
      goal: d.goal,
      ...(business ? { jobTitle: d.jobTitle, teamSize: d.teamSize, gstin: d.gstin, yearStarted: d.yearStarted } : {}),
      ...(provides
        ? {
            experience: d.experience,
            languages: d.languages,
            workModes: d.workModes,
            startingPrice: d.startingPrice,
            priceUnit: d.startingPrice != null ? d.priceUnit : undefined,
            licenceNumber: d.licenceNumber,
            workPhotos: d.workPhotos,
          }
        : {}),
      shareContactDefault: d.shareContactDefault,
      marketingEmails: d.marketingEmails,
      completedAt: new Date().toISOString(),
    };

    const current = await prisma.user.findUnique({
      where: { id: user.id },
      select: { ageConfirmedAt: true, metaLink: { select: { notifPrefs: true } } },
    });
    const prefs = (current?.metaLink?.notifPrefs ?? {}) as Record<string, unknown>;

    await prisma.$transaction(async (tx) => {
      // 18+ is normally confirmed at signup; record it here if it wasn't.
      if (!current?.ageConfirmedAt) {
        await recordConsent(tx, { userId: user.id, source: "PROMPT", ageConfirmed: true, ...requestMeta(req.headers) });
      }
      await tx.user.update({
        where: { id: user.id },
        data: {
          name: d.name,
          role: roleForGoal(d.goal),
          accountType: d.accountType,
          location: d.location,
          interestCategoryIds: interests,
          ...(business ? { companyName: d.companyName ?? null, companyLogo: d.companyLogo ?? null } : {}),
          ...(offer ? { ...offer, headline: d.headline ?? null } : {}),
          ...(d.website ? { website: d.website } : {}),
          ...(d.avatarUrl ? { avatarUrl: d.avatarUrl } : {}),
          ...(d.username ? { username: d.username } : {}),
          ...(d.bio ? { bio: d.bio } : {}),
          onboarding: extras as unknown as Prisma.InputJsonValue,
          onboardedAt: new Date(),
        },
      });
      // WhatsApp alerts: chat messages + responses. Opt-out model, so only false is stored meaningfully.
      const nextPrefs = { ...prefs, chatMessages: d.whatsappAlerts, demandMatches: d.whatsappAlerts };
      await tx.metaAccountLink.upsert({
        where: { userId: user.id },
        update: { notifPrefs: nextPrefs as Prisma.InputJsonValue },
        create: { userId: user.id, notifPrefs: nextPrefs as Prisma.InputJsonValue },
      });
    });

    const res = NextResponse.json({ ok: true });
    // Lets middleware stop redirecting before the session token is refreshed.
    res.cookies.set(ONBOARDED_COOKIE, user.id, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
    return res;
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return apiError(409, "USERNAME_TAKEN", "That username is taken. Try another one.");
    }
    console.error("onboarding POST: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not save your profile. Try again.");
  }
}
