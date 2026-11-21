import { z } from "zod";

const credits = z.coerce.number().int().min(1).max(100_000);
const days = z.coerce.number().int().min(1).max(365);

export const boostSettingsSchema = z
  .object({
    pricePerDay: credits,
    minDays: days,
    maxDays: days,
    extendPricePerDay: credits,
    extendMinDays: days,
    extendMaxDays: days,
  })
  .superRefine((v, ctx) => {
    if (v.minDays > v.maxDays) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["maxDays"], message: "Maximum days must be at least the minimum." });
    }
    if (v.extendMinDays > v.extendMaxDays) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["extendMaxDays"],
        message: "Maximum extension days must be at least the minimum.",
      });
    }
  });

export const boostRequestSchema = z.object({
  days: z.coerce.number().int().min(1).max(365),
  auth: z.unknown().optional(),
});
