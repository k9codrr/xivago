import { z } from "zod";

export const checkInQuerySchema = z.object({
  bidId: z.string().cuid(),
});

export const checkInAnswerSchema = z.union([
  z.object({ bidId: z.string().cuid(), snooze: z.literal(true) }),
  z.object({
    bidId: z.string().cuid(),
    status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "PROBLEM"]),
    mood: z.number().int().min(1).max(5).nullish(),
    note: z.string().trim().max(500).nullish(),
  }),
]);
