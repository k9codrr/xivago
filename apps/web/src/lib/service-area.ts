/**
 * Where an offer is available. Shared by the post flow, the create route,
 * the feed's distance filter and the cards.
 *
 *   NEARBY     — within serviceRadiusKm of the post's lat/lng
 *   REGIONS    — the states, districts and cities in serviceAreas
 *   ALL_INDIA  — anywhere in India
 *   ONLINE     — remote only
 *
 * NEARBY and REGIONS can also set serviceOnline ("also available online").
 * ALL_INDIA and ONLINE posts match every distance filter in the feed.
 */
import { z } from "zod";

export const SERVICE_AREA_TYPES = ["NEARBY", "REGIONS", "ALL_INDIA", "ONLINE"] as const;
export type ServiceAreaType = (typeof SERVICE_AREA_TYPES)[number];

/** Types that aren't tied to one point, so they show for any distance filter. */
export const LOCATION_FREE_AREA_TYPES: ServiceAreaType[] = ["ALL_INDIA", "ONLINE"];

export const SERVICE_RADIUS_CHOICES = [5, 10, 25, 50, 100] as const;
export const DEFAULT_SERVICE_RADIUS_KM = 25;
export const MAX_SERVICE_AREAS = 20;

export const AREA_KINDS = ["STATE", "DISTRICT", "CITY"] as const;
export type AreaKind = (typeof AREA_KINDS)[number];

export const serviceAreaSchema = z.object({
  kind: z.enum(AREA_KINDS),
  name: z.string().trim().min(1).max(80),
  // The state a district or city is in, for the label and future matching.
  state: z.string().trim().max(80).optional().nullable(),
  lat: z.coerce.number().min(-90).max(90).optional().nullable(),
  lng: z.coerce.number().min(-180).max(180).optional().nullable(),
});
export type ServiceArea = z.infer<typeof serviceAreaSchema>;

/** States and union territories of India. */
export const INDIA_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
] as const;

export const SERVICE_AREA_TYPE_INFO: Record<ServiceAreaType, { label: string; hint: string }> = {
  NEARBY: { label: "Near me", hint: "Around your location, within a distance you pick" },
  REGIONS: { label: "Pick areas", hint: "States, districts or cities you cover" },
  ALL_INDIA: { label: "All over India", hint: "You serve customers anywhere in India" },
  ONLINE: { label: "Online only", hint: "Calls, chat or remote delivery" },
};

export function isServiceAreaType(v: unknown): v is ServiceAreaType {
  return typeof v === "string" && (SERVICE_AREA_TYPES as readonly string[]).includes(v);
}

/** Stored JSON → typed areas, dropping anything malformed. */
export function parseServiceAreas(raw: unknown): ServiceArea[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((a) => {
    const parsed = serviceAreaSchema.safeParse(a);
    return parsed.success ? [parsed.data] : [];
  });
}

interface AreaFields {
  serviceAreaType?: string | null;
  serviceAreas?: unknown;
  serviceRadiusKm?: number | null;
  serviceOnline?: boolean | null;
  locationName?: string | null;
}

/**
 * Short label for cards: "Online", "All over India", "Within 25 km of Koramangala",
 * "Pune, Mumbai +2 · Online". Null when the post has no service area (requests, older posts).
 */
export function serviceAreaLabel(d: AreaFields, maxNames = 2): string | null {
  const type = d.serviceAreaType;
  if (!isServiceAreaType(type)) return null;
  const online = d.serviceOnline ? " · Online too" : "";
  if (type === "ONLINE") return "Online";
  if (type === "ALL_INDIA") return "All over India";
  if (type === "NEARBY") {
    const km = d.serviceRadiusKm ?? DEFAULT_SERVICE_RADIUS_KM;
    return `Within ${km} km${d.locationName ? ` of ${d.locationName.split(",")[0]}` : ""}${online}`;
  }
  const areas = parseServiceAreas(d.serviceAreas);
  if (areas.length === 0) return online ? "Online" : null;
  const names = areas.slice(0, maxNames).map((a) => a.name).join(", ");
  const more = areas.length > maxNames ? ` +${areas.length - maxNames}` : "";
  return `${names}${more}${online}`;
}

export const AREA_KIND_LABEL: Record<AreaKind, string> = { STATE: "State", DISTRICT: "District", CITY: "City" };
