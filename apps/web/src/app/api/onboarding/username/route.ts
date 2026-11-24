import { NextRequest, NextResponse } from "next/server";
import { prisma, isUsernameAvailable } from "@/lib/db";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError } from "@/lib/api-response";
import { usernameSchema } from "@/lib/validation/profile";

/** GET /api/onboarding/username?u=handle -> { available, username } or a format message. */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const parsed = usernameSchema.safeParse(req.nextUrl.searchParams.get("u") ?? "");
    if (!parsed.success) {
      return NextResponse.json({ available: false, message: parsed.error.issues[0]?.message ?? "Invalid username" });
    }
    const available = await isUsernameAvailable(prisma, parsed.data, user.id);
    return NextResponse.json({
      available,
      username: parsed.data,
      message: available ? null : "That username is taken. Try another one.",
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("onboarding/username: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not check that username.");
  }
}
