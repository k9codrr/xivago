import { z } from "zod";

const score = z.number().int().min(1).max(5);

export const ratingCreateSchema = z.object({
  bidId: z.string().cuid(),
  responsiveness: score,
  quality: score,
  timeliness: score,
  value: score,
  comment: z.string().trim().max(500).optional(),
});
export type RatingCreateInput = z.infer<typeof ratingCreateSchema>;

export const ratingSummaryQuerySchema = z.object({
  userId: z.string().cuid(),
});
