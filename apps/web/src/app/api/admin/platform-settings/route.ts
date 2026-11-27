import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError, apiValidationError } from "@/lib/api-response";
import { getPlatformSettings } from "@/lib/platform-settings";

const schema = z.object({
  offerSlotsEnabled: z.boolean(),
});

function handle(err: unknown, what: string) {
  if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
  if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
  console.error(`admin/platform-settings ${what}: unexpected error`, err);
  return apiError(500, "INTERNAL_ERROR", "Could not update platform settings.");
}

export async function GET() {
  try {
    await requireAdmin();
    const settings = await getPlatformSettings();
    return NextResponse.json({ settings });
  } catch (err) {
    return handle(err, "GET");
  }
}

export async function PUT(req: NextRequest) {
  try {
    await requireAdmin();
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return apiValidationError(parsed.error);
    await getPlatformSettings();
    const settings = await prisma.platformSettings.update({
      where: { id: "global" },
      data: parsed.data,
      select: { offerSlotsEnabled: true },
    });
    return NextResponse.json({ settings });
  } catch (err) {
    return handle(err, "PUT");
  }
}
