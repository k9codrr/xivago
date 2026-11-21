import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError, apiValidationError } from "@/lib/api-response";
import { POLICY_VERSION, checkboxEventsSchema, hasCurrentConsent, recordConsent, requestMeta } from "@/lib/consent";

function authError(err: unknown) {
  if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
  if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
  return null;
}

/** Has the signed-in user accepted the current Terms + Privacy Policy? */
export async function GET() {
  try {
    const user = await requireUser();
    const me = await prisma.user.findUnique({ where: { id: user.id }, select: { consentVersion: true, ageConfirmedAt: true } });
    if (!me) return apiError(404, "NOT_FOUND", "Account not found.");
    return NextResponse.json({ needsConsent: !hasCurrentConsent(me), version: POLICY_VERSION });
  } catch (err) {
    const handled = authError(err);
    if (handled) return handled;
    console.error("consent GET: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not check consent.");
  }
}

const postSchema = z.object({
  accepted: z.literal(true),
  ageConfirmed: z.literal(true, { errorMap: () => ({ message: "You must be 18 or older to use xivago." }) }),
  source: z.enum(["LOGIN", "PROMPT"]),
  checkboxEvents: checkboxEventsSchema,
});

/** Record acceptance. A no-op when the user already accepted this version. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
    }
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const me = await prisma.user.findUnique({ where: { id: user.id }, select: { consentVersion: true, ageConfirmedAt: true } });
    if (!me) return apiError(404, "NOT_FOUND", "Account not found.");
    if (hasCurrentConsent(me)) return NextResponse.json({ ok: true, alreadyAccepted: true });

    await prisma.$transaction((tx) =>
      recordConsent(tx, {
        userId: user.id,
        source: parsed.data.source,
        checkboxEvents: parsed.data.checkboxEvents,
        ageConfirmed: true,
        ...requestMeta(req.headers),
      }),
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    const handled = authError(err);
    if (handled) return handled;
    console.error("consent POST: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not save your consent. Please try again.");
  }
}
