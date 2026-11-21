import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError, apiValidationError } from "@/lib/api-response";
import { getBoostSettings } from "@/lib/boost";
import { boostSettingsSchema } from "@/lib/validation/boost";

function handle(err: unknown, what: string) {
  if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
  if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
  console.error(`admin/boost-settings ${what}: unexpected error`, err);
  return apiError(500, "INTERNAL_ERROR", "Could not update boost settings.");
}

/** Current pricing plus how many posts are featured right now. */
export async function GET() {
  try {
    await requireAdmin();
    const settings = await getBoostSettings();
    const activeBoosts = await prisma.demand.count({
      where: { isPriority: true, priorityExpiresAt: { gt: new Date() }, status: "OPEN" },
    });
    return NextResponse.json({ settings, activeBoosts });
  } catch (err) {
    return handle(err, "GET");
  }
}

/** Replace all values at once. Only affects boosts bought after the change. */
export async function PUT(req: NextRequest) {
  try {
    await requireAdmin();
    const parsed = boostSettingsSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return apiValidationError(parsed.error);
    await getBoostSettings(); // make sure the row exists
    const settings = await prisma.boostSettings.update({ where: { id: "global" }, data: parsed.data });
    return NextResponse.json({ settings });
  } catch (err) {
    return handle(err, "PUT");
  }
}
