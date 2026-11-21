import type { Prisma, PrismaClient, RatingDirection } from "@prisma/client";

type TxClient = Prisma.TransactionClient | PrismaClient;

export interface SubmitRatingInput {
  bidId: string;
  raterId: string;
  ratedUserId: string;
  direction: RatingDirection;
  responsiveness: number;
  quality: number;
  timeliness: number;
  value: number;
  comment?: string | null;
}

export class DuplicateRatingError extends Error {
  constructor() {
    super("You have already rated this engagement.");
    this.name = "DuplicateRatingError";
  }
}

const DIMENSIONS = ["responsiveness", "quality", "timeliness", "value"] as const;

function assertValidScore(label: string, value: number) {
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new Error(`${label} must be an integer between 1 and 5`);
  }
}

/**
 * Creates a Rating row. One rating per (bid, rater) — enforced by the
 * `@@unique([bidId, raterId])` constraint, surfaced here as a typed error
 * instead of a raw Prisma P2002.
 */
export async function submitRating(db: TxClient, input: SubmitRatingInput) {
  for (const dim of DIMENSIONS) {
    assertValidScore(dim, input[dim]);
  }

  try {
    return await db.rating.create({
      data: {
        bidId: input.bidId,
        raterId: input.raterId,
        ratedUserId: input.ratedUserId,
        direction: input.direction,
        responsiveness: input.responsiveness,
        quality: input.quality,
        timeliness: input.timeliness,
        value: input.value,
        comment: input.comment ?? null,
      },
    });
  } catch (err) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code?: string }).code === "P2002"
    ) {
      throw new DuplicateRatingError();
    }
    throw err;
  }
}

export type RatingBadge = "NEW" | "RISING" | "TOP_RATED";

export interface UserRatingSummary {
  ratingCount: number;
  overall: number | null;
  responsiveness: number | null;
  quality: number | null;
  timeliness: number | null;
  value: number | null;
  badge: RatingBadge;
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

/**
 * Aggregates a user's received ratings on the fly (volume doesn't justify a
 * denormalized column yet — see Phase 2 of the ratings plan). Pass
 * `direction` to split seeker-given vs vendor-given ratings; omit for the
 * combined score shown on the public profile.
 */
export async function getUserRatingSummary(
  db: TxClient,
  ratedUserId: string,
  direction?: RatingDirection,
): Promise<UserRatingSummary> {
  const agg = await db.rating.aggregate({
    where: { ratedUserId, ...(direction ? { direction } : {}) },
    _avg: { responsiveness: true, quality: true, timeliness: true, value: true },
    _count: { _all: true },
  });

  const ratingCount = agg._count._all;
  const { responsiveness, quality, timeliness, value } = agg._avg;

  const overall =
    responsiveness != null && quality != null && timeliness != null && value != null
      ? round1((responsiveness + quality + timeliness + value) / 4)
      : null;

  let badge: RatingBadge = "NEW";
  if (ratingCount >= 10 && overall != null && overall >= 4.5) {
    badge = "TOP_RATED";
  } else if (ratingCount >= 3 && overall != null && overall >= 4.0) {
    badge = "RISING";
  }

  return {
    ratingCount,
    overall,
    responsiveness: responsiveness != null ? round1(responsiveness) : null,
    quality: quality != null ? round1(quality) : null,
    timeliness: timeliness != null ? round1(timeliness) : null,
    value: value != null ? round1(value) : null,
    badge,
  };
}
