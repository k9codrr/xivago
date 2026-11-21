import "server-only";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma, type InvoiceKind, type Prisma } from "@/lib/db";
import { apiError } from "@/lib/api-response";
import { creditAuthSchema } from "@/lib/validation/tpin";

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

/** A payment that was refused before any credits moved. */
export class CreditPaymentError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "CreditPaymentError";
  }

  toResponse() {
    return apiError(this.status, this.code, this.message, this.details);
  }
}

const COUNTERS = {
  pin: { attempts: "failedAttempts", lock: "lockedUntil" },
  reset: { attempts: "resetFailedAttempts", lock: "resetLockedUntil" },
} as const;

type PinRow = Prisma.TransactionPinGetPayload<object>;

function lockedError(until: Date, what: string) {
  const minutes = Math.max(1, Math.ceil((until.getTime() - Date.now()) / 60_000));
  return new CreditPaymentError(
    423,
    "TPIN_LOCKED",
    `Too many wrong ${what}. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    { lockedUntil: until.toISOString() },
  );
}

/**
 * Runs one guessable check under a 5-tries-then-15-minutes lock. The try is
 * counted before the slow bcrypt compare, so parallel requests can't all get
 * through on the same count.
 */
async function guardedCheck(
  userId: string,
  counter: keyof typeof COUNTERS,
  what: string,
  check: (row: PinRow) => Promise<boolean>,
) {
  const keys = COUNTERS[counter];
  const row = await prisma.transactionPin.findUnique({ where: { userId } });
  if (!row) throw new CreditPaymentError(403, "TPIN_NOT_SET", "Set a T-PIN to pay with credits.");

  const lock = row[keys.lock];
  if (lock && lock > new Date()) throw lockedError(lock, what);
  if (lock) {
    // Lock has run out: fresh tries. Only this exact lock clears, so a late request can't wipe a newer one.
    await prisma.transactionPin.updateMany({
      where: { userId, [keys.lock]: lock },
      data: { [keys.attempts]: 0, [keys.lock]: null },
    });
  }

  const counted = await prisma.transactionPin.update({
    where: { userId },
    data: { [keys.attempts]: { increment: 1 } } as Prisma.TransactionPinUpdateInput,
  });
  const attempts = counted[keys.attempts];

  if (attempts <= MAX_ATTEMPTS && (await check(counted))) {
    await prisma.transactionPin.update({
      where: { userId },
      data: { [keys.attempts]: 0, [keys.lock]: null } as Prisma.TransactionPinUpdateInput,
    });
    return;
  }

  if (attempts >= MAX_ATTEMPTS) {
    // The count stays high while locked, so requests already in flight can't earn new tries.
    const until = new Date(Date.now() + LOCK_MINUTES * 60_000);
    await prisma.transactionPin.update({
      where: { userId },
      data: { [keys.lock]: until } as Prisma.TransactionPinUpdateInput,
    });
    throw lockedError(until, what);
  }

  const attemptsLeft = MAX_ATTEMPTS - attempts;
  throw new CreditPaymentError(
    403,
    counter === "pin" ? "TPIN_INVALID" : "PASSWORD_INVALID",
    `Wrong ${what.replace(/s$/, "")}. ${attemptsLeft} attempt${attemptsLeft === 1 ? "" : "s"} left.`,
    { attemptsLeft },
  );
}

/**
 * Call right before debiting. Throws unless the request carries the user's
 * T-PIN and was confirmed for exactly the amount about to be charged.
 */
export async function authorizeCreditSpend(userId: string, auth: unknown, credits: number) {
  const parsed = creditAuthSchema.safeParse(auth);
  if (!parsed.success) throw new CreditPaymentError(400, "TPIN_REQUIRED", "Enter your T-PIN to pay with credits.");
  if (parsed.data.expectedCredits !== credits) {
    throw new CreditPaymentError(409, "AMOUNT_CHANGED", `The price is now ${credits} credits. Please review and try again.`, {
      credits,
    });
  }
  await guardedCheck(userId, "pin", "T-PIN attempts", (row) => bcrypt.compare(parsed.data.tpin, row.pinHash));
}

/** For account changes guarded by the T-PIN. Accounts without one have nothing to check. */
export async function checkTpinIfSet(userId: string, tpin: string | undefined) {
  const pin = await prisma.transactionPin.findUnique({ where: { userId }, select: { id: true } });
  if (!pin) return;
  if (!tpin) throw new CreditPaymentError(400, "TPIN_REQUIRED", "Enter your T-PIN to continue.");
  await guardedCheck(userId, "pin", "T-PIN attempts", (row) => bcrypt.compare(tpin, row.pinHash));
}

export function hashTpin(tpin: string) {
  return bcrypt.hash(tpin, 10);
}

/** Password proof for a T-PIN reset, under its own lock counter. */
export async function checkResetPassword(userId: string, password: string) {
  await guardedCheck(userId, "reset", "password attempts", async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { passwordHash: true } });
    return Boolean(user.passwordHash) && bcrypt.compare(password, user.passwordHash);
  });
}

/**
 * The number this user proved they own by logging in with an OTP. `User.phone`
 * is free text on the profile form, so it can't vouch for anything.
 */
export async function verifiedPhoneFor(userId: string): Promise<string | null> {
  const link = await prisma.metaAccountLink.findUnique({ where: { userId }, select: { whatsappId: true } });
  return link?.whatsappId ? `+${link.whatsappId}` : null;
}

export interface InvoiceItem {
  label: string;
  credits: number;
}

/** Writes the invoice inside the payment's transaction, after the debit. */
export async function createInvoice(
  tx: Prisma.TransactionClient,
  input: { userId: string; kind: InvoiceKind; title: string; items: InvoiceItem[]; demandId?: string | null },
) {
  const user = await tx.user.findUniqueOrThrow({
    where: { id: input.userId },
    select: { name: true, creditBalance: true },
  });
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = crypto.randomBytes(4).toString("hex").slice(0, 6).toUpperCase();

  return tx.invoice.create({
    data: {
      number: `XIV-${date}-${suffix}`,
      userId: input.userId,
      kind: input.kind,
      title: input.title.slice(0, 200),
      items: input.items as unknown as Prisma.InputJsonValue,
      totalCredits: input.items.reduce((sum, item) => sum + item.credits, 0),
      balanceAfter: user.creditBalance,
      billedToName: user.name,
      demandId: input.demandId ?? null,
    },
  });
}
