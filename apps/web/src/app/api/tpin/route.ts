import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError, apiValidationError } from "@/lib/api-response";
import { hashTpin, verifiedPhoneFor } from "@/lib/credit-payment";
import { tpinCreateSchema } from "@/lib/validation/tpin";

function handleError(err: unknown, action: string) {
  if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
  if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
  console.error(`tpin: ${action} failed`, err);
  return apiError(500, "INTERNAL_ERROR", "Something went wrong. Please try again.");
}

/** What the payment drawer needs to know before it opens. */
export async function GET() {
  try {
    const user = await requireUser();
    const [me, pin, phone] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { creditBalance: true } }),
      prisma.transactionPin.findUnique({ where: { userId: user.id }, select: { lockedUntil: true } }),
      verifiedPhoneFor(user.id),
    ]);
    const locked = pin?.lockedUntil && pin.lockedUntil > new Date() ? pin.lockedUntil : null;
    return NextResponse.json({
      balance: me.creditBalance,
      isSet: Boolean(pin),
      lockedUntil: locked,
      canResetWithOtp: Boolean(phone),
    });
  } catch (err) {
    return handleError(err, "status");
  }
}

/** First-time setup only. Replacing a T-PIN goes through /api/tpin/reset. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const parsed = tpinCreateSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return parsed.error.issues[0]?.code === "custom"
        ? apiError(400, "WEAK_TPIN", parsed.error.issues[0].message)
        : apiValidationError(parsed.error);
    }

    const pinHash = await hashTpin(parsed.data.tpin);
    const { count } = await prisma.transactionPin.createMany({
      data: [{ userId: user.id, pinHash }],
      skipDuplicates: true,
    });
    if (count === 0) return apiError(409, "TPIN_ALREADY_SET", "You already have a T-PIN.");
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    return handleError(err, "create");
  }
}
