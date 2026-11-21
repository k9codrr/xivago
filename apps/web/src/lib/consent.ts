import "server-only";
import { z } from "zod";
import { prisma, type Prisma } from "@/lib/db";

/**
 * Version of the Terms of Service + Privacy Policy a user agrees to. Bump it
 * (and the "Last updated" date on /terms and /privacy) whenever either page
 * changes in a way users must re-accept: every user then sees the consent
 * screen again on their next visit, and a new ConsentLog row is written.
 */
export const POLICY_VERSION = "2026-11-15";

export const CONSENT_SOURCES = ["SIGNUP", "LOGIN", "PROMPT"] as const;
export type ConsentSource = (typeof CONSENT_SOURCES)[number];

/** Each tick / untick of the checkbox, with the device time it happened. */
export const checkboxEventsSchema = z
  .array(
    z.object({
      action: z.enum(["checked", "unchecked", "age_checked", "age_unchecked"]),
      at: z.string().datetime(),
    }),
  )
  .max(50)
  .optional();
export type CheckboxEvents = z.infer<typeof checkboxEventsSchema>;

/** Caller's IP and browser, for the consent / deletion audit trail. */
export function requestMeta(headers: Headers): { ipAddress: string | null; userAgent: string | null } {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || headers.get("x-real-ip") || headers.get("cf-connecting-ip") || null;
  return {
    ipAddress: ip ? ip.slice(0, 64) : null,
    userAgent: headers.get("user-agent")?.slice(0, 400) ?? null,
  };
}

/** Accepted the current policy version AND confirmed being 18 or older. */
export function hasCurrentConsent(user: { consentVersion: string | null; ageConfirmedAt: Date | null }): boolean {
  return user.consentVersion === POLICY_VERSION && user.ageConfirmedAt != null;
}

/**
 * Write one ConsentLog row and stamp the user with the current version.
 * The server clock (`createdAt`) is the authoritative acceptance time.
 */
export async function recordConsent(
  db: Prisma.TransactionClient | typeof prisma,
  input: {
    userId: string;
    source: ConsentSource;
    checkboxEvents?: CheckboxEvents;
    /** The "I am 18 or older" box was ticked (required by every caller). */
    ageConfirmed: true;
    ipAddress: string | null;
    userAgent: string | null;
  },
) {
  const now = new Date();
  await db.consentLog.create({
    data: {
      userId: input.userId,
      policyVersion: POLICY_VERSION,
      source: input.source,
      checkboxEvents: input.checkboxEvents?.length ? input.checkboxEvents : undefined,
      ageConfirmed: input.ageConfirmed,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      createdAt: now,
    },
  });
  await db.user.update({
    where: { id: input.userId },
    data: { consentVersion: POLICY_VERSION, consentAcceptedAt: now, ageConfirmedAt: now },
  });
}
