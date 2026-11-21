import { apiError } from "@/lib/api-response";

// Sending and receiving credits is paused. To restore: delete this stub and uncomment below.
const paused = () => apiError(410, "CREDIT_TRANSFER_PAUSED", "Sending and receiving credits is currently unavailable.");

export const GET = paused;
export const POST = paused;

// --- Original implementation, commented out while credit sending/receiving is paused ---

// import { NextRequest, NextResponse } from "next/server";
// import { prisma, applyCreditDelta, InsufficientCreditsError } from "@/lib/db";
// import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
// import { apiError, apiValidationError } from "@/lib/api-response";
// import { creditTransferConfirmSchema } from "@/lib/validation/credit-transfer";
// import { notifyCreditTransfer } from "@/lib/notifications";

// async function loadRequest(token: string) {
//   const request = await prisma.creditTransferRequest.findUnique({
//     where: { token },
//     select: {
//       id: true,
//       requesterId: true,
//       amount: true,
//       status: true,
//       expiresAt: true,
//       requester: { select: { id: true, name: true, avatarUrl: true, companyName: true } },
//     },
//   });
//   return request;
// }

// /** Public info for the sender's confirm screen -- requester identity + fixed
//  * amount, if any. Requires auth only so the sender's own id can be checked
//  * against the requester (no self-transfer) before they even see a confirm button. */
// export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
//   try {
//     await requireUser();
//     const { token } = await params;
//     const request = await loadRequest(token);
//     if (!request) return apiError(404, "NOT_FOUND", "This QR code isn't valid.");
//     if (request.status !== "PENDING" || request.expiresAt <= new Date()) {
//       return apiError(410, "GONE", "This QR code has expired or was already used.");
//     }

//     return NextResponse.json({
//       requester: request.requester,
//       amount: request.amount,
//     });
//   } catch (err) {
//     if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
//     if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
//     console.error("credits/transfer/[token] GET: unexpected error", err);
//     return apiError(500, "INTERNAL_ERROR", "Could not look up this transfer.");
//   }
// }

// /** Sender confirms and the transfer executes atomically: one ledger debit on
//  * the sender, one credit on the requester, both via the same `applyCreditDelta`
//  * used everywhere else credits move, inside one transaction with marking the
//  * token COMPLETED -- so a retry or a crash mid-way can never double-spend or
//  * credit one side without debiting the other. */
// export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
//   try {
//     const user = await requireUser();
//     const { token } = await params;

//     let body: unknown = {};
//     try {
//       body = await req.json();
//     } catch {
//       // empty body is fine when the request has a fixed amount
//     }
//     const parsed = creditTransferConfirmSchema.safeParse(body);
//     if (!parsed.success) return apiValidationError(parsed.error);

//     const request = await loadRequest(token);
//     if (!request) return apiError(404, "NOT_FOUND", "This QR code isn't valid.");
//     if (request.status !== "PENDING" || request.expiresAt <= new Date()) {
//       return apiError(410, "GONE", "This QR code has expired or was already used.");
//     }
//     if (request.requesterId === user.id) {
//       return apiError(400, "INVALID_TARGET", "You can't send credits to yourself.");
//     }

//     const amount = request.amount ?? parsed.data.amount;
//     if (!amount) {
//       return apiError(400, "AMOUNT_REQUIRED", "Enter how many credits to send.");
//     }
//     if (request.amount && parsed.data.amount && parsed.data.amount !== request.amount) {
//       return apiError(400, "AMOUNT_MISMATCH", "This request has a fixed amount.");
//     }

//     try {
//       const result = await prisma.$transaction(async (tx) => {
//         // Conditional on status: PENDING -- atomically claims this token so
//         // two concurrent confirms (e.g. a double-tap) can't both execute the
//         // transfer. Throws P2025 if another request already claimed it.
//         await tx.creditTransferRequest.update({
//           where: { id: request.id, status: "PENDING" },
//           data: { status: "COMPLETED" },
//         });
//         await applyCreditDelta(tx, {
//           userId: user.id,
//           amount: -amount,
//           type: "TRANSFER_OUT",
//           note: `transfer to ${request.requesterId}`,
//         });
//         return applyCreditDelta(tx, {
//           userId: request.requesterId,
//           amount,
//           type: "TRANSFER_IN",
//           note: `transfer from ${user.id}`,
//         });
//       });

//       void notifyCreditTransfer(user.id, request.requesterId, amount, request.id);

//       return NextResponse.json({ ok: true, amount, requesterNewBalance: result.balance });
//     } catch (err) {
//       if (err instanceof InsufficientCreditsError) {
//         return apiError(409, "INSUFFICIENT_CREDITS", "You don't have enough credits for this transfer.");
//       }
//       if (typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "P2025") {
//         return apiError(410, "GONE", "This QR code has expired or was already used.");
//       }
//       throw err;
//     }
//   } catch (err) {
//     if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
//     if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
//     console.error("credits/transfer/[token] POST: unexpected error", err);
//     return apiError(500, "INTERNAL_ERROR", "Could not complete this transfer.");
//   }
// }
