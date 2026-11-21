import { NextRequest, NextResponse } from "next/server";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError, apiValidationError } from "@/lib/api-response";
import { checkInAnswerSchema, checkInQuerySchema } from "@/lib/validation/trust";
import { answerCheckIn, getCheckIn, CheckInAccessError } from "@/lib/deal-checkin";

function handleError(err: unknown, label: string) {
  if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
  if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
  if (err instanceof CheckInAccessError) return apiError(403, "FORBIDDEN", err.message);
  console.error(`deals/checkin ${label}: unexpected error`, err);
  return apiError(500, "INTERNAL_ERROR", "Could not load the project check-in.");
}

/** GET /api/deals/checkin?bidId=... -- is a check-in due for the caller on this slot? */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const parsed = checkInQuerySchema.safeParse({ bidId: req.nextUrl.searchParams.get("bidId") });
    if (!parsed.success) return apiValidationError(parsed.error);
    return NextResponse.json({ checkIn: await getCheckIn(user.id, parsed.data.bidId) });
  } catch (err) {
    return handleError(err, "GET");
  }
}

/** POST /api/deals/checkin -- answer ({ status, mood?, note? }) or snooze ({ snooze: true }). */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const parsed = checkInAnswerSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return apiValidationError(parsed.error);
    const { bidId, ...rest } = parsed.data;
    return NextResponse.json(
      await answerCheckIn(user.id, bidId, "snooze" in rest ? { snooze: true } : rest),
    );
  } catch (err) {
    return handleError(err, "POST");
  }
}
