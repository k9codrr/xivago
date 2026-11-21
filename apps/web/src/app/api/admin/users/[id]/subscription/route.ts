import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError, apiValidationError } from "@/lib/api-response";

const bodySchema = z.object({ plan: z.enum(["FREE", "PRO"]) });

/** Admin manually grant/revoke PRO, per section 3.11: "Admin can manually grant/revoke PRO." */
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

    const subscription = await prisma.subscription.upsert({
      where: { userId: id },
      update: {
        plan: parsed.data.plan,
        status: "ACTIVE",
        // A year out is a reasonable "admin comp" horizon; real subscriber
        // periods are always driven by the Razorpay webhook, not this field.
        currentPeriodEnd: parsed.data.plan === "PRO" ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) : null,
      },
      create: {
        userId: id,
        plan: parsed.data.plan,
        status: "ACTIVE",
        currentPeriodEnd: parsed.data.plan === "PRO" ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) : null,
      },
    });

    return NextResponse.json({ subscription });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("admin/users/subscription: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not update this subscription.");
  }
}
