import { apiError } from "@/lib/api-response";

// Sending and receiving credits is paused. To restore: delete this stub and uncomment below.
const paused = () => apiError(410, "CREDIT_TRANSFER_PAUSED", "Sending and receiving credits is currently unavailable.");

export const POST = paused;

// --- Original implementation, commented out while credit sending/receiving is paused ---

// import { NextRequest, NextResponse } from "next/server";
// import { randomUUID } from "node:crypto";
// import { prisma } from "@/lib/db";
// import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
// import { apiError, apiValidationError } from "@/lib/api-response";
// import { creditTransferRequestCreateSchema } from "@/lib/validation/credit-transfer";

// const EXPIRY_MINUTES = 15;

// /** Requester side of a QR credit transfer: issues a short-lived token the
//  * sender's scanner resolves via GET /api/credits/transfer/[token]. */
// export async function POST(req: NextRequest) {
//   try {
//     const user = await requireUser();

//     let body: unknown = {};
//     try {
//       body = await req.json();
//     } catch {
//       // empty body is fine -- amount is optional (sender chooses)
//     }
//     const parsed = creditTransferRequestCreateSchema.safeParse(body);
//     if (!parsed.success) return apiValidationError(parsed.error);

//     const request = await prisma.creditTransferRequest.create({
//       data: {
//         requesterId: user.id,
//         amount: parsed.data.amount ?? null,
//         token: randomUUID(),
//         expiresAt: new Date(Date.now() + EXPIRY_MINUTES * 60000),
//       },
//     });

//     return NextResponse.json({
//       token: request.token,
//       amount: request.amount,
//       expiresAt: request.expiresAt,
//       url: `/credits/transfer/${request.token}`,
//     });
//   } catch (err) {
//     if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
//     if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
//     console.error("credits/transfer POST: unexpected error", err);
//     return apiError(500, "INTERNAL_ERROR", "Could not create a transfer request.");
//   }
// }
