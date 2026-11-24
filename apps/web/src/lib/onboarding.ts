import { z } from "zod";
import { CATEGORIES_DATA } from "@/lib/categories";
import { usernameSchema } from "@/lib/validation/profile";

/**
 * Post-signup onboarding (app/onboarding). One flow for every kind of user:
 *
 *   Start (everyone)   S1 name + 18+ · S2 account type · S3 goal
 *   Buyer branch       B1 interests (skippable) · B2 business details (business only) · B3 city + privacy
 *   Provider branch    P1 specialities · P2 how you work + city · P3 credentials (skippable) · P4 business (business only)
 *   Finish (everyone)  F1 photo/username/bio (skippable) · F2 notifications + referral · F3 verify phone (skippable) · F4 done
 *
 * "Both" takes the provider branch, plus B1 interests first. The profile is
 * saved when the user leaves F2; F3/F4 happen on an already-onboarded account,
 * so skipping verification never loses anything.
 *
 * Required: name, 18+ confirmation, account type, goal, city, and either one
 * speciality (providers) or nothing more (buyers: interests are optional).
 * Business accounts also need the business name; providers a headline.
 */

/** Set once onboarding is saved, so middleware stops redirecting before the session token refreshes. */
export const ONBOARDED_COOKIE = "xv_onboarded";

export const ACCOUNT_TYPES = ["INDIVIDUAL", "BUSINESS"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const GOALS = ["BUY", "PROVIDE", "BOTH"] as const;
export type Goal = (typeof GOALS)[number];

export type StepId = "S1" | "S2" | "S3" | "B1" | "B2" | "B3" | "P1" | "P2" | "P3" | "P4" | "F1" | "F2" | "F3" | "F4";

/** The ordered screens a user with these answers sees. */
export function stepsFor(accountType: AccountType, goal: Goal | null): StepId[] {
  const start: StepId[] = ["S1", "S2", "S3"];
  const finish: StepId[] = ["F1", "F2", "F3", "F4"];
  if (!goal) return start;
  const business = accountType === "BUSINESS";
  if (goal === "BUY") return [...start, "B1", ...(business ? (["B2"] as StepId[]) : []), "B3", ...finish];
  const provider: StepId[] = ["P1", "P2", "P3", ...(business ? (["P4"] as StepId[]) : [])];
  if (goal === "BOTH") return [...start, "B1", ...provider, ...finish];
  return [...start, ...provider, ...finish];
}

/** Section a step belongs to, for the "Step 2 of 3 · …" header and progress bar. */
export function sectionOf(step: StepId): { key: "S" | "B" | "P" | "F"; label: string } {
  const key = step[0] as "S" | "B" | "P" | "F";
  const label = { S: "About you", B: "What you need", P: "Your work", F: "Finish" }[key];
  return { key, label };
}

/** Goal -> platform role. Role decides what the feed shows first; anyone can still post either way. */
export function roleForGoal(goal: Goal): "VENDOR" | "BUSINESS" {
  return goal === "BUY" ? "BUSINESS" : "VENDOR";
}

// ── Options ──────────────────────────────────────────────────────────────

/** Shorter chip labels for the main categories (B1, P1). Falls back to the taxonomy name. */
const SHORT_NAMES: Record<string, string> = {
  "15": "Financial Advisory",
  "17": "Immigration & Visa",
  "18": "IP & Patents",
  "20": "Career Coaching",
  "22": "B2B Experts",
  "25": "Software & Tech",
  "27": "Family & Parenting",
  "28": "Pets & Vet",
  "29": "Beauty & Styling",
  "30": "Creative & Media",
};

export const MAIN_CATEGORIES = CATEGORIES_DATA.map((c) => ({ id: c.id, label: SHORT_NAMES[c.id] ?? c.name }));

export const MAX_INTERESTS = 5;
export const MAX_SPECIALITIES = 3;
export const MAX_SERVICES_PER_SPECIALITY = 10;
export const MAX_WORK_PHOTOS = 6;

export const BUYER_TEAM_SIZES = ["1–10", "11–50", "51–200", "200+"] as const;
export const PROVIDER_TEAM_SIZES = ["Just me", "2–10", "11–50", "50+"] as const;
export const EXPERIENCE_OPTIONS = ["Under 1 yr", "1–3", "3–5", "5–10", "10+"] as const;
export const LANGUAGE_OPTIONS = [
  "English",
  "Hindi",
  "Bengali",
  "Marathi",
  "Telugu",
  "Tamil",
  "Gujarati",
  "Kannada",
  "Malayalam",
  "Punjabi",
  "Odia",
  "Urdu",
] as const;
export const WORK_MODES = [
  { id: "ONLINE", label: "Online" },
  { id: "AT_MY_PLACE", label: "At my place" },
  { id: "TRAVEL", label: "I travel to clients" },
] as const;
export const PRICE_UNITS = ["per session", "per hour", "per project", "per month"] as const;

/**
 * The licence a provider is asked for on P3 depends on their first speciality's
 * main category. Anything not listed gets the generic label.
 */
const LICENCE_BY_MAIN: Record<string, { label: string; placeholder: string }> = {
  "13": { label: "Medical council or RCI registration number", placeholder: "e.g. A12345" },
  "14": { label: "Bar Council enrolment number", placeholder: "e.g. D/1234/2015" },
  "15": { label: "SEBI RIA or ICAI membership number", placeholder: "e.g. INA000012345" },
  "16": { label: "RERA registration number", placeholder: "e.g. UPRERAAGT12345" },
  "18": { label: "Patent agent registration number", placeholder: "e.g. IN/PA-1234" },
  "28": { label: "Veterinary council registration number", placeholder: "e.g. VCI/1234" },
};
export const LICENSED_MAIN_IDS = new Set(Object.keys(LICENCE_BY_MAIN));

export function licenceFieldFor(subIds: string[]): { label: string; placeholder: string; licensed: boolean } {
  for (const id of subIds) {
    const hit = LICENCE_BY_MAIN[id.split(".")[0]!];
    if (hit) return { ...hit, licensed: true };
  }
  return { label: "Licence or registration number", placeholder: "If your work needs one", licensed: false };
}

// ── What we store in User.onboarding ─────────────────────────────────────

export interface OnboardingExtras {
  goal: Goal;
  jobTitle?: string;
  teamSize?: string;
  gstin?: string;
  yearStarted?: number;
  experience?: string;
  languages?: string[];
  workModes?: string[];
  startingPrice?: number;
  priceUnit?: string;
  licenceNumber?: string;
  workPhotos?: string[];
  /** Default for "Show my phone on requests" in the post form. */
  shareContactDefault?: boolean;
  marketingEmails?: boolean;
  completedAt: string;
}

// ── Validation (client + /api/onboarding) ────────────────────────────────

const optionalText = (max: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(max).optional());

const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const ids = (max: number) => z.array(z.string().trim().min(1).max(20)).max(max);

export const onboardingSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your full name").max(80),
    ageConfirmed: z.literal(true, { errorMap: () => ({ message: "You must be 18 or older to use xivago" }) }),
    accountType: z.enum(ACCOUNT_TYPES),
    goal: z.enum(GOALS),

    // Buyer
    interestCategoryIds: ids(MAX_INTERESTS).default([]),
    // Business (buyer B2 or provider P4)
    companyName: optionalText(100),
    jobTitle: optionalText(60),
    teamSize: optionalText(20),
    gstin: z.preprocess(
      (v) => (typeof v === "string" ? v.trim().toUpperCase() || undefined : v),
      z.string().regex(GSTIN, "Enter a valid 15-character GSTIN").optional(),
    ),
    companyLogo: z.preprocess((v) => (v === "" ? undefined : v), z.string().url().optional()),
    yearStarted: z.preprocess(
      (v) => (v === "" || v == null ? undefined : Number(v)),
      z.number().int().min(1900, "Enter a valid year").max(new Date().getFullYear(), "Enter a valid year").optional(),
    ),

    // Location: buyers on B3, providers on P2
    location: z.string().trim().min(2, "Enter your city").max(100),
    shareContactDefault: z.boolean().default(false),

    // Provider
    categorySubIds: ids(MAX_SPECIALITIES).default([]),
    categoryProviderIds: ids(MAX_SPECIALITIES * MAX_SERVICES_PER_SPECIALITY).default([]),
    headline: optionalText(60),
    experience: optionalText(20),
    languages: z.array(z.string().trim().min(1).max(30)).max(12).default([]),
    workModes: z.array(z.enum(["ONLINE", "AT_MY_PLACE", "TRAVEL"])).max(3).default([]),
    startingPrice: z.preprocess(
      (v) => (v === "" || v == null ? undefined : Number(String(v).replace(/[^\d]/g, ""))),
      z.number().int().min(0).max(10_000_000).optional(),
    ),
    priceUnit: optionalText(20),
    licenceNumber: optionalText(40),
    workPhotos: z.array(z.string().url()).max(MAX_WORK_PHOTOS).default([]),
    website: z.preprocess((v) => {
      if (typeof v !== "string" || !v.trim()) return undefined;
      const t = v.trim();
      return /^https?:\/\//i.test(t) ? t : `https://${t}`;
    }, z.string().url("Enter a valid link").optional()),

    // Finish
    avatarUrl: z.preprocess((v) => (v === "" ? undefined : v), z.string().url().optional()),
    username: usernameSchema.optional(),
    bio: optionalText(300),
    whatsappAlerts: z.boolean().default(true),
    marketingEmails: z.boolean().default(false),
  })
  .superRefine((d, ctx) => {
    const provides = d.goal !== "BUY";
    if (d.accountType === "BUSINESS" && !d.companyName) {
      ctx.addIssue({ code: "custom", path: ["companyName"], message: "Enter your business name" });
    }
    if (provides && d.categorySubIds.length === 0) {
      ctx.addIssue({ code: "custom", path: ["categorySubIds"], message: "Pick at least one speciality" });
    }
    if (provides && !d.headline) {
      ctx.addIssue({ code: "custom", path: ["headline"], message: "Add a one-line headline" });
    }
  });

export type OnboardingInput = z.input<typeof onboardingSchema>;
export type OnboardingData = z.output<typeof onboardingSchema>;
