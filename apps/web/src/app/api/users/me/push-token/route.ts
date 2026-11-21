import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError, apiValidationError } from "@/lib/api-response";

/**
 * Register / unregister a push-notification device for the signed-in user.
 *
 * `token` is an FCM registration token for platform ios/android, or the
 * JSON-serialised PushSubscription for platform "web" (see the DeviceToken
 * model). Tokens are unique: re-registering a token from a different
 * account (shared device, sign-out/sign-in) moves it to the new user so the
 * previous account stops receiving that device's notifications.
 */
const registerSchema = z.object({
  token: z.string().min(1).max(4096),
  platform: z.enum(["ios", "android", "web"]),
});

const unregisterSchema = z.object({
  token: z.string().min(1).max(4096),
});

async function readJson(req: NextRequest): Promise<unknown | undefined> {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}

function handleError(err: unknown, label: string) {
  if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
  if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
  console.error(`users/me/push-token ${label}: unexpected error`, err);
  return apiError(500, "INTERNAL_ERROR", "Could not update push notification settings.");
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await readJson(req);
    if (body === undefined) return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");

    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);
    const { token, platform } = parsed.data;

    if (platform === "web") {
      try {
        const sub = JSON.parse(token) as { endpoint?: unknown };
        if (typeof sub.endpoint !== "string" || !sub.endpoint.startsWith("https://")) throw new Error();
      } catch {
        return apiError(400, "INVALID_SUBSCRIPTION", "Web push token must be a PushSubscription JSON.");
      }
    }

    await prisma.deviceToken.upsert({
      where: { token },
      update: { userId: user.id, platform, lastSeenAt: new Date() },
      create: { token, platform, userId: user.id },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err, "POST");
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await readJson(req);
    if (body === undefined) return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");

    const parsed = unregisterSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    // Scoped to the caller so one user can't unregister someone else's device.
    await prisma.deviceToken.deleteMany({ where: { token: parsed.data.token, userId: user.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err, "DELETE");
  }
}
