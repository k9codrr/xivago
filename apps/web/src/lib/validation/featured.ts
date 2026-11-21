import { z } from "zod";

export const featuredBidSchema = z.object({
  demandId: z.string().min(1),
  /** AUCTION: the sealed bid in credits. Ignored for FIXED niches (price comes from the niche). */
  amount: z.coerce.number().int().positive().max(1_000_000).optional(),
  /** FIXED: buy the hero slot instead of a ranked one. */
  wantsHero: z.boolean().optional().default(false),
});

export const featuredTrackSchema = z.object({
  placementId: z.string().min(1),
  event: z.enum(["impression", "click"]),
});

export const featuredSettingsPatchSchema = z
  .object({
    enabled: z.boolean(),
    cycleDays: z.coerce.number().int().min(1).max(30),
    slotsPerNiche: z.coerce.number().int().min(1).max(50),
    priceStep: z.coerce.number().int().min(0).max(10_000),
    maxConsecutiveWins: z.coerce.number().int().min(0).max(52),
    heroRotateTopN: z.coerce.number().int().min(1).max(10),
  })
  .partial();

export const featuredNichePatchSchema = z
  .object({
    mode: z.enum(["FIXED", "AUCTION"]),
    isActive: z.boolean(),
    reservePrice: z.coerce.number().int().min(1).max(1_000_000),
    heroPrice: z.coerce.number().int().min(1).max(1_000_000),
    rankedPrice: z.coerce.number().int().min(1).max(1_000_000),
  })
  .partial();
