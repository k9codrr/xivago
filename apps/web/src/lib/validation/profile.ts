import { z } from "zod";
import { isValidIndianMobile, toE164IndianMobile } from "@/lib/phone";

const MAX_SERVICES = 15;
export const MAX_CATEGORY_SUBS = 10;
export const MAX_CATEGORY_PROVIDERS = 20;
export const MAX_CATEGORY_PROBLEMS = 50;

const categoryIdList = (max: number, label: string) =>
  z.array(z.string().trim().min(1).max(20)).max(max, `You can pick up to ${max} ${label}`).optional();

function normalizeWebsite(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

const emptyToUndefined = (v: unknown) => {
  if (typeof v !== "string") return v;
  const trimmed = v.trim();
  return trimmed === "" ? undefined : trimmed;
};

const websiteSchema = z.preprocess(
  (v) => {
    const cleaned = emptyToUndefined(v);
    return typeof cleaned === "string" ? normalizeWebsite(cleaned) : cleaned;
  },
  z
    .string()
    .url("Enter a valid website URL")
    .refine((v) => /^https?:\/\//i.test(v), "Website must be http or https")
    .optional(),
);

/**
 * Indian mobile numbers only for now (the WhatsApp OTP flow in M6 assumes
 * +91). Accepts "9876543210", "+919876543210", or with spaces/dashes, and
 * normalizes to E.164 (+91XXXXXXXXXX) — the format the WhatsApp Cloud API
 * requires as the `to` field.
 */
const phoneSchema = z
  .string()
  .refine(isValidIndianMobile, "Enter a valid 10-digit Indian mobile number")
  .transform(toE164IndianMobile);

export const phoneChangeSendSchema = z.object({ phone: phoneSchema });

export const phoneChangeVerifySchema = z.object({
  phone: phoneSchema,
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
  tpin: z.string().regex(/^\d{6}$/).optional(),
});

const optionalUrlSchema = z.preprocess(emptyToUndefined, z.string().url().optional());

const optionalTrimmedString = (max: number, label: string) =>
  z.preprocess(
    emptyToUndefined,
    z.string().max(max, `${label} must be ${max} characters or fewer`).optional(),
  );

/** "@username" handle: same rules as USERNAME_PATTERN in @slotbook/db. */
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .transform((v) => v.replace(/^@/, ""))
  .pipe(
    z
      .string()
      .min(3, "Username must be at least 3 characters")
      .max(30, "Username must be 30 characters or fewer")
      .regex(/^[a-z0-9_]+$/, "Use only letters, numbers and underscores"),
  );

export const profileEditSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(80),
  // Optional so older clients that don't send it leave the handle untouched.
  username: usernameSchema.optional(),
  bio: optionalTrimmedString(300, "Bio"),
  companyName: optionalTrimmedString(100, "Company name"),
  companyLogo: optionalUrlSchema,
  avatarUrl: optionalUrlSchema,
  website: websiteSchema,
  // No `phone`: it only changes through the verified flow in /api/users/me/phone.
  services: z
    .array(z.string().trim().min(1).max(40))
    .max(MAX_SERVICES, `You can list up to ${MAX_SERVICES} services`)
    .default([]),
  location: optionalTrimmedString(100, "Location"),
  // Taxonomy picks from lib/categories.ts; ids are checked and ancestors filled in server-side.
  categorySubIds: categoryIdList(MAX_CATEGORY_SUBS, "sub categories"),
  categoryProviderIds: categoryIdList(MAX_CATEGORY_PROVIDERS, "provider types"),
  categoryProblemIds: categoryIdList(MAX_CATEGORY_PROBLEMS, "problems"),
});
export type ProfileEditInput = z.infer<typeof profileEditSchema>;
