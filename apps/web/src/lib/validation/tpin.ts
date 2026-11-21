import { z } from "zod";

export const TPIN_LENGTH = 6;

const tpinFormat = z.string().regex(new RegExp(`^\\d{${TPIN_LENGTH}}$`), `T-PIN must be ${TPIN_LENGTH} digits.`);

/** Same digit throughout, or a straight run up or down, e.g. 111111, 123456, 987654. */
export function isWeakTpin(pin: string): boolean {
  const digits = [...pin].map(Number);
  const steps = new Set(digits.slice(1).map((d, i) => d - digits[i]!));
  return steps.size === 1 && [0, 1, -1].includes([...steps][0]!);
}

/** A T-PIN being chosen. Entering an existing one only needs `tpinFormat`. */
export const newTpinSchema = tpinFormat.refine((pin) => !isWeakTpin(pin), "That T-PIN is too easy to guess.");

export const tpinCreateSchema = z.object({ tpin: newTpinSchema });

export const tpinResetSchema = z
  .object({
    tpin: newTpinSchema,
    code: z.string().regex(/^\d{6}$/).optional(),
    password: z.string().min(1).max(200).optional(),
  })
  .refine((d) => Boolean(d.code) !== Boolean(d.password), "Provide either a code or your password.");

/** Sent with every credit payment: the T-PIN, and the amount the user was shown. */
export const creditAuthSchema = z.object({
  tpin: tpinFormat,
  expectedCredits: z.number().int().positive(),
});

export type CreditAuth = z.infer<typeof creditAuthSchema>;
