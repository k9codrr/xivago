import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError, apiValidationError } from "@/lib/api-response";
import { PRICE_UNITS } from "@/lib/price-units";
import { MAX_SERVICE_AREAS, SERVICE_AREA_TYPES, serviceAreaSchema } from "@/lib/service-area";
import { COMPLETION_CODES } from "@/lib/completion-timeline";

const DAY = 24 * 60 * 60 * 1000;

/**
 * Everything an admin can change on a post. Every field is optional; only
 * what's sent is updated. `featuredDays` (re)starts the Featured flag for that
 * many days from now (0 turns it off); `extendDays` pushes the end date out.
 */
const adminDemandPatchSchema = z
  .object({
    status: z.enum(["OPEN", "EXPIRED", "FILLED", "CANCELLED"]).optional(),
    postType: z.enum(["PROMOTE", "REQUIREMENT"]).optional(),
    summary: z.string().trim().min(1).max(500).optional(),
    budget: z.coerce.number().int().positive().nullable().optional(),
    priceUnit: z.enum(PRICE_UNITS).nullable().optional(),
    serviceAreaType: z.enum(SERVICE_AREA_TYPES).nullable().optional(),
    serviceAreas: z.array(serviceAreaSchema).max(MAX_SERVICE_AREAS).optional(),
    serviceRadiusKm: z.coerce.number().int().min(1).max(500).nullable().optional(),
    serviceOnline: z.boolean().optional(),
    completionTimeline: z.enum(COMPLETION_CODES).nullable().optional(),
    maxSlots: z.coerce.number().int().min(1).max(100).optional(),
    shareContact: z.boolean().optional(),
    tags: z.array(z.string().trim().toLowerCase().min(1).max(80)).max(5).optional(),
    customProviderName: z.string().trim().max(40).nullable().optional(),
    locationName: z.string().trim().max(200).nullable().optional(),
    timelineEnd: z.coerce.date().optional(),
    extendDays: z.coerce.number().int().min(1).max(365).optional(),
    featuredDays: z.coerce.number().int().min(0).max(365).optional(),
  })
  .strict();

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
    }
    const parsed = adminDemandPatchSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);
    const d = parsed.data;

    const current = await prisma.demand.findUnique({ where: { id }, select: { timelineEnd: true } });
    if (!current) return apiError(404, "NOT_FOUND", "Post not found.");

    const now = Date.now();
    let timelineEnd = d.timelineEnd;
    if (d.extendDays) {
      const base = Math.max((timelineEnd ?? current.timelineEnd).getTime(), now);
      timelineEnd = new Date(base + d.extendDays * DAY);
    }
    const featuredEnd = d.featuredDays ? new Date(now + d.featuredDays * DAY) : null;
    // A featured post must stay live at least as long as it's featured.
    if (featuredEnd && (timelineEnd ?? current.timelineEnd) < featuredEnd) timelineEnd = featuredEnd;

    const updated = await prisma.demand.update({
      where: { id },
      data: {
        ...(d.status ? { status: d.status } : {}),
        ...(d.postType ? { postType: d.postType } : {}),
        ...(d.summary ? { summary: d.summary } : {}),
        ...(d.budget !== undefined ? { budgetMin: d.budget, budgetMax: d.budget } : {}),
        ...(d.priceUnit !== undefined ? { priceUnit: d.priceUnit } : {}),
        ...(d.serviceAreaType !== undefined ? { serviceAreaType: d.serviceAreaType } : {}),
        ...(d.serviceAreas !== undefined ? { serviceAreas: d.serviceAreas } : {}),
        ...(d.serviceRadiusKm !== undefined ? { serviceRadiusKm: d.serviceRadiusKm } : {}),
        ...(d.serviceOnline !== undefined ? { serviceOnline: d.serviceOnline } : {}),
        ...(d.completionTimeline !== undefined ? { completionTimeline: d.completionTimeline } : {}),
        ...(d.maxSlots !== undefined ? { maxSlots: d.maxSlots } : {}),
        ...(d.shareContact !== undefined ? { shareContact: d.shareContact } : {}),
        ...(d.tags !== undefined ? { tags: Array.from(new Set(d.tags)) } : {}),
        ...(d.customProviderName !== undefined ? { customProviderName: d.customProviderName || null } : {}),
        ...(d.locationName !== undefined ? { locationName: d.locationName || null } : {}),
        ...(timelineEnd ? { timelineEnd } : {}),
        // Extending a closed-by-time post re-opens it.
        ...(timelineEnd && timelineEnd.getTime() > now && !d.status ? { status: "OPEN" as const } : {}),
        ...(d.featuredDays !== undefined
          ? { isPriority: d.featuredDays > 0, priorityExpiresAt: featuredEnd }
          : {}),
      },
      select: { id: true },
    });

    return NextResponse.json({ ok: true, id: updated.id });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("admin/demands PATCH: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not update this post.");
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;

    // Hard delete, per section 3.12's literal "delete" (as opposed to the
    // author-facing soft "close" at PATCH /api/demands/[id]/close). Bids/
    // Conversations/Messages cascade via onDelete: Cascade in the schema.
    await prisma.demand.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("admin/demands DELETE: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not delete this post.");
  }
}
