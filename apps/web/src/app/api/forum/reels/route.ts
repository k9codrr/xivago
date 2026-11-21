import { NextRequest, NextResponse } from "next/server";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError } from "@/lib/api-response";
import { getReels } from "@/lib/reels";

const MAX_EXCLUDE = 300;

/**
 * GET ?start=<postId>&v=<attachmentIndex>&exclude=<id,id,…>&limit=8
 * The next reels for the viewer, ranked by their niches (see lib/reels.ts).
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const q = req.nextUrl.searchParams;
    const exclude = (q.get("exclude") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(-MAX_EXCLUDE);
    const v = Number.parseInt(q.get("v") ?? "0", 10);

    const reels = await getReels({
      viewerId: user.id,
      startPostId: q.get("start") || undefined,
      startIndex: Number.isNaN(v) ? 0 : v,
      exclude,
      limit: Number.parseInt(q.get("limit") ?? "8", 10) || 8,
    });
    return NextResponse.json({ reels });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("forum/reels GET: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not load videos.");
  }
}
