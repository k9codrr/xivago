import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError, apiValidationError } from "@/lib/api-response";
import { expireStaleBoosts } from "@/lib/boost";
import { RECOMMENDATION_LIMIT, recommendDemands, recommendMixed } from "@/lib/recommendations";

const querySchema = z.object({
  // "demands": offers & requests only (feed strips). "mixed": those plus feed posts (Explore).
  kind: z.enum(["demands", "mixed"]).default("demands"),
  seed: z.string().trim().regex(/^[a-z0-9:-]{4,48}$/i).default("default"),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  limit: z.coerce.number().int().min(1).max(RECOMMENDATION_LIMIT).default(RECOMMENDATION_LIMIT),
  // Comma-separated ids already shown on the page.
  exclude: z
    .string()
    .max(2000)
    .transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 80))
    .optional(),
});

/**
 * GET /api/recommendations/posts?kind=demands|mixed&seed=..[&lat&lng&exclude]
 * At most 10 personalised picks; see lib/recommendations.ts for the signals.
 */
export async function GET(req: NextRequest) {
  try {
    const viewer = await requireUser();
    const parsed = querySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
    if (!parsed.success) return apiValidationError(parsed.error);
    const { kind, seed, lat, lng, limit, exclude } = parsed.data;
    await expireStaleBoosts();

    const opts = { viewerId: viewer.id, seed, lat, lng, limit, excludeIds: exclude };
    if (kind === "mixed") return NextResponse.json({ items: await recommendMixed(opts) });
    const demands = await recommendDemands(opts);
    return NextResponse.json({ items: demands.map((demand) => ({ type: "demand" as const, demand })) });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("recommendations/posts GET: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not load recommendations.");
  }
}
