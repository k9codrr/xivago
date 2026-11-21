import type { CreditType, Prisma, PrismaClient } from "@prisma/client";

export class InsufficientCreditsError extends Error {
  constructor(required: number, balance: number) {
    super(`Insufficient credits: need ${required}, have ${balance}`);
    this.name = "InsufficientCreditsError";
  }
}

type TxClient = Prisma.TransactionClient | PrismaClient;

export interface ApplyCreditDeltaInput {
  userId: string;
  /** Positive to credit, negative to debit. Never zero. */
  amount: number;
  type: CreditType;
  demandId?: string | null;
  note?: string | null;
}

/**
 * THE ONLY function in the codebase that is allowed to mutate
 * `User.creditBalance`. Every grant, purchase, and boost debit MUST go
 * through this so the ledger (`CreditTransaction`) and the cached balance on
 * `User` never drift apart.
 *
 * Writes the ledger row and updates the balance atomically. If `db` is
 * already a transaction client, this participates in the caller's
 * transaction (e.g. slot-purchase allocation, which needs credits +
 * bids + payment status to commit or fail together). If `db` is the base
 * PrismaClient, a new transaction is opened here.
 *
 * Throws `InsufficientCreditsError` for debits that would take the balance
 * negative — credits can never go below zero.
 */
export async function applyCreditDelta(
  db: TxClient,
  input: ApplyCreditDeltaInput,
): Promise<{ balance: number }> {
  if (input.amount === 0) {
    throw new Error("applyCreditDelta: amount must be non-zero");
  }

  const run = async (tx: Prisma.TransactionClient) => {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: input.userId },
      select: { creditBalance: true },
    });

    const nextBalance = user.creditBalance + input.amount;
    if (nextBalance < 0) {
      throw new InsufficientCreditsError(-input.amount, user.creditBalance);
    }

    await tx.creditTransaction.create({
      data: {
        userId: input.userId,
        amount: input.amount,
        type: input.type,
        demandId: input.demandId ?? null,
        note: input.note ?? null,
      },
    });

    const updated = await tx.user.update({
      where: { id: input.userId },
      data: { creditBalance: nextBalance },
      select: { creditBalance: true },
    });

    return { balance: updated.creditBalance };
  };

  // Detect whether `db` is already inside a transaction. PrismaClient and
  // Prisma.TransactionClient share the same delegate shape but only the
  // top-level client exposes `$transaction`. We feature-detect rather than
  // relying on `instanceof`, since PrismaClient isn't reliably `instanceof`-able
  // across package boundaries in some bundler setups.
  if (typeof (db as PrismaClient).$transaction === "function") {
    return (db as PrismaClient).$transaction((tx) => run(tx));
  }
  return run(db as Prisma.TransactionClient);
}
