import { z } from "zod";
import { countWords } from "@/lib/words";
import { COMPLETION_CODES, completionProfileFor } from "@/lib/completion-timeline";
import { PRICE_UNITS, priceUnitsFor } from "@/lib/price-units";
import { MAX_SERVICE_AREAS, SERVICE_AREA_TYPES, serviceAreaSchema } from "@/lib/service-area";

export const MAX_SUMMARY_WORDS = 60;
/** Every paid post stays live this long (longer only when it's featured for more days). */
export const POST_LIFETIME_DAYS = 7;
/** Requests pick their "Connect within" up to the post lifetime. */
export const MAX_TIMELINE_DAYS = POST_LIFETIME_DAYS;
/** Older app versions could send up to 30 days; anything past the lifetime is clamped, not rejected. */
const LEGACY_MAX_TIMELINE_DAYS = 30;
// How far ahead a "specific date" completion can be set.
export const MAX_COMPLETION_DAYS = 730;
export const MIN_TIMELINE_MINUTES = 30; // don't let someone set a 2-minute demand by mistake

export const TIMELINE_CHIPS = [
  { label: "24 hours", hours: 24 },
  { label: "3 days", hours: 72 },
  { label: "7 days", hours: 168 },
] as const;

function maxTimelineEnd(from: Date = new Date()): Date {
  return new Date(from.getTime() + LEGACY_MAX_TIMELINE_DAYS * 24 * 60 * 60 * 1000);
}

/** When a new post stops showing: the lifetime, stretched to cover every paid featured day. */
export function postLifetimeEnd(opts: { requested?: Date | null; boostEnd?: Date | null; now?: number }): Date {
  const now = opts.now ?? Date.now();
  const lifetime = new Date(now + POST_LIFETIME_DAYS * 24 * 60 * 60 * 1000);
  const base = opts.requested && opts.requested < lifetime ? opts.requested : lifetime;
  return opts.boostEnd && opts.boostEnd > base ? opts.boostEnd : base;
}

const summarySchema = z
  .string()
  .trim()
  .min(1, "Tell providers what you need")
  .max(500) // matches the @db.VarChar(500) column ceiling
  .refine(
    (v) => countWords(v) <= MAX_SUMMARY_WORDS,
    `Summary must be ${MAX_SUMMARY_WORDS} words or fewer`,
  );

const timelineEndSchema = z.coerce.date().refine(
  (date) => {
    const now = new Date();
    const min = new Date(now.getTime() + MIN_TIMELINE_MINUTES * 60 * 1000);
    return date >= min && date <= maxTimelineEnd(now);
  },
  `Timeline must be between ${MIN_TIMELINE_MINUTES} minutes and ${MAX_TIMELINE_DAYS} days from now`,
);

export const demandCreateSchema = z
  .object({
    postType: z.enum(["PROMOTE", "REQUIREMENT"]).default("PROMOTE"),
    requirementRoleId: z.string().trim().min(1).max(40).optional(),
    summary: summarySchema,
    budget: z.coerce
      .number({ required_error: "Add a budget", invalid_type_error: "Add a budget" })
      .int()
      .positive("Budget must be more than ₹0"),
    // Offers: how the price is charged (picked per category). Requests leave it out.
    priceUnit: z.enum(PRICE_UNITS).optional().nullable(),
    // Requests only: how long people have to connect. Offers always run POST_LIFETIME_DAYS.
    timelineEnd: timelineEndSchema.optional(),
    // Requests only: when the work should be done.
    completionTimeline: z.enum(COMPLETION_CODES, {
      required_error: "Pick a completion timeline",
      invalid_type_error: "Pick a completion timeline",
    }).optional().nullable(),
    completionDate: z.coerce.date().optional().nullable(),
    // Offers only: where the service is available.
    serviceAreaType: z.enum(SERVICE_AREA_TYPES).optional().nullable(),
    serviceAreas: z.array(serviceAreaSchema).max(MAX_SERVICE_AREAS, `Pick up to ${MAX_SERVICE_AREAS} areas`).default([]),
    serviceRadiusKm: z.coerce.number().int().min(1).max(500).optional().nullable(),
    serviceOnline: z.boolean().default(false),
    isPriority: z.boolean().default(false),
    // Featured days (admin-set min..max, checked in the route). Defaults to the minimum.
    boostDays: z.coerce.number().int().min(1).max(365).optional(),
    shareContact: z.boolean().default(false),
    maxSlots: z.coerce.number().int().min(3, "At least 3 response spots").max(100, "At most 100 response spots").default(3),
    categoryParentId: z.string().optional(),
    categorySubId: z.string().optional(),
    categoryName: z.string().optional(),
    subCategoryName: z.string().optional(),
    // Optional finer levels: provider "1.4.2" and problems "1.4.2.1" under categorySubId "1.4".
    categoryProviderId: z.string().trim().max(20).optional(),
    categoryProblemIds: z.array(z.string().trim().max(20)).max(10, "Pick up to 10 common needs").default([]),
    // Custom "Who you are" (offers) / "Who should solve it" (requests) when the list doesn't have it.
    customProviderName: z.string().trim().max(40, "Keep it to 40 characters").optional().nullable(),
    tags: z.array(z.string().trim().toLowerCase().max(80)).max(5, "Pick up to 5 tags").default([]),
    selectedTechInputs: z.record(z.any()).optional(),
    mediaUrls: z.array(z.string()).default([]),
    lat: z.coerce.number().min(-90).max(90).optional().nullable(),
    lng: z.coerce.number().min(-180).max(180).optional().nullable(),
    // Place picked in the drawer's location search (shown on the post).
    locationName: z.string().trim().max(200).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.postType === "PROMOTE") {
      if (data.priceUnit && !priceUnitsFor(data.categorySubId, data.categoryParentId).includes(data.priceUnit)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["priceUnit"], message: "That price type doesn't fit this category" });
      }
      if (data.serviceAreaType === "REGIONS" && data.serviceAreas.length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["serviceAreas"], message: "Pick at least one state, district or city" });
      }
      if (data.serviceAreaType === "NEARBY" && (data.lat == null || data.lng == null)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["lat"], message: "Set your location to serve people nearby" });
      }
      return; // offers have no connect-within or completion timeline
    }
    if (!data.timelineEnd) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["timelineEnd"], message: "Pick how long people have to connect" });
    }
    if (!data.completionTimeline) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["completionTimeline"], message: "Pick a completion timeline" });
      return;
    }
    const profile = completionProfileFor(data.categorySubId, data.categoryParentId);
    if (!profile.options.includes(data.completionTimeline)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["completionTimeline"],
        message: "That completion timeline doesn't fit this category",
      });
    }
    if (data.completionTimeline === "DATE") {
      const now = Date.now();
      const d = data.completionDate?.getTime();
      if (d == null || Number.isNaN(d)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["completionDate"], message: "Pick the date" });
      } else if (d < now || d > now + MAX_COMPLETION_DAYS * 86_400_000) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["completionDate"],
          message: "Pick a date between today and 2 years from now",
        });
      }
    }
  });
// Role is optional while the "Who are you looking for?" step is disabled in the post flow.
// .refine((data) => data.postType !== "REQUIREMENT" || Boolean(data.requirementRoleId), {
//   message: "Pick the role you're looking for",
//   path: ["requirementRoleId"],
// });
export type DemandCreateInput = z.infer<typeof demandCreateSchema>;

export const demandFeedQuerySchema = z.object({
  cursor: z.string().cuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  // Category filtering
  category: z.string().trim().optional(),
  subCategory: z.string().trim().optional(),
  provider: z.string().trim().optional(),
  problem: z.string().trim().optional(),
  // Comma-separated, up to 5 (workbook tags never contain commas)
  tags: z
    .string()
    .max(500)
    .transform((v) => v.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 5))
    .optional(),
  // Geolocation filtering (25km / 50km / all)
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.union([z.coerce.number().min(1).max(500), z.literal("all")]).optional(),
  // Time filtering (24h / 2d / all)
  timeFilter: z.enum(["24h", "2d", "all"]).optional(),
  // Free-text match against the summary
  q: z.string().trim().min(1).max(60).optional(),
  budgetMin: z.coerce.number().int().nonnegative().optional(),
  budgetMax: z.coerce.number().int().nonnegative().optional(),
  // Random per visit from the "All" feed: rotates which featured posts sit on top.
  seed: z.string().trim().regex(/^[a-z0-9]{4,32}$/i).optional(),
});
export type DemandFeedQuery = z.infer<typeof demandFeedQuerySchema>;

export const demandEngagementSchema = z.object({
  kinds: z.array(z.enum(["VIEW", "CARD_CLICK"])).max(2).default([]),
  // Random id kept on the device, so signed-out viewers can be counted once a day.
  anonId: z.string().trim().min(8).max(64).optional(),
});
