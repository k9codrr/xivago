import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, UnauthorizedError } from "@/lib/guards";
import { apiError, apiValidationError } from "@/lib/api-response";

/**
 * GET /api/places?q=kora[&lat=..&lng=..]      → place suggestions as you type
 * GET /api/places?lat=..&lng=..&reverse=1      → the place at a point ("use current location")
 * GET /api/places?q=pun&scope=region           → Indian states, districts and cities only
 *
 * Backed by Photon (photon.komoot.io, OpenStreetMap data): free, no key, built
 * for type-ahead. Proxied so the app shell / browsers don't need CORS and we
 * can cache. Results are biased toward the user's location when given.
 */

const schema = z.object({
  q: z.string().trim().max(120).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  reverse: z.string().optional(),
  // "region": only states, districts and cities inside India (service-area picker).
  scope: z.enum(["region"]).optional(),
});

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_id?: number;
    osm_type?: string;
    name?: string;
    street?: string;
    housenumber?: string;
    district?: string;
    locality?: string;
    city?: string;
    county?: string;
    state?: string;
    country?: string;
    countrycode?: string;
    postcode?: string;
    type?: string;
    osm_value?: string;
  };
}

interface Place {
  id: string;
  name: string;
  secondary: string;
  full: string;
  lat: number;
  lng: number;
  kind: string;
  /** Set with scope=region: what kind of area this is, and its state. */
  areaKind?: "STATE" | "DISTRICT" | "CITY";
  state?: string;
}

/** India's bounding box (min lon, min lat, max lon, max lat). */
const INDIA_BBOX = "68.1,6.5,97.5,35.7";

function areaKindOf(f: PhotonFeature): "STATE" | "DISTRICT" | "CITY" | null {
  const { type, osm_value: value, name = "" } = f.properties;
  if (type === "state") return "STATE";
  // Districts are admin "county" areas; skip sub-district/tehsil divisions.
  if (type === "county" && !/sub-?district|tehsil|taluk|mandal|block|gewog/i.test(name)) return "DISTRICT";
  // Cities and towns only — not villages or suburbs.
  if (type === "city" && (value === "city" || value === "town")) return "CITY";
  return null;
}

function shape(f: PhotonFeature): Place | null {
  const p = f.properties;
  const [lng, lat] = f.geometry.coordinates;
  const primary =
    p.name ?? (p.street ? `${p.housenumber ? `${p.housenumber} ` : ""}${p.street}` : null) ?? p.district ?? p.locality ?? p.city ?? p.state;
  if (!primary) return null;
  const parts = [p.district, p.locality, p.city, p.state, p.country].filter(
    (x, i, arr): x is string => Boolean(x) && x !== primary && arr.indexOf(x) === i,
  );
  const secondary = parts.slice(0, 3).join(", ");
  const short = [primary, p.city && p.city !== primary ? p.city : p.state].filter(Boolean).join(", ");
  return {
    id: `${p.osm_type ?? "x"}${p.osm_id ?? `${lat},${lng}`}`,
    name: primary,
    secondary,
    full: short,
    lat,
    lng,
    kind: p.type ?? p.osm_value ?? "place",
  };
}

export async function GET(req: NextRequest) {
  try {
    await requireUser();
    const parsed = schema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
    if (!parsed.success) return apiValidationError(parsed.error);
    const { q, lat, lng, reverse, scope } = parsed.data;

    let url: string;
    if (reverse && lat != null && lng != null) {
      url = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&limit=1&lang=en`;
    } else {
      if (!q || q.length < 2) return NextResponse.json({ places: [] });
      const bias = lat != null && lng != null ? `&lat=${lat.toFixed(3)}&lon=${lng.toFixed(3)}` : "";
      url =
        scope === "region"
          ? `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=15&lang=en&bbox=${INDIA_BBOX}` +
            "&layer=state&layer=county&layer=district&layer=city"
          : `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=10&lang=en${bias}`;
    }

    const res = await fetch(url, {
      headers: { "User-Agent": "xivago-app/1.0 (place search)", Accept: "application/json" },
      next: { revalidate: 60 * 60 * 24 },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return apiError(502, "PLACES_UNAVAILABLE", "Place search is unavailable right now.");
    const data = (await res.json()) as { features?: PhotonFeature[] };

    const seen = new Set<string>();
    const features = (data.features ?? []).filter(
      (f) => scope !== "region" || (f.properties.countrycode === "IN" && areaKindOf(f) != null),
    );
    const places = features
      .map((f) => {
        const p = shape(f);
        if (!p || scope !== "region") return p;
        const areaKind = areaKindOf(f)!;
        return { ...p, areaKind, state: areaKind === "STATE" ? undefined : f.properties.state };
      })
      .filter((p): p is Place => {
        if (!p) return false;
        const key = `${p.name}|${p.secondary}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 8);

    return NextResponse.json({ places });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    console.error("places GET: failed", err);
    return apiError(502, "PLACES_UNAVAILABLE", "Place search is unavailable right now.");
  }
}
