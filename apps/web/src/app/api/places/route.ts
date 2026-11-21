import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, UnauthorizedError } from "@/lib/guards";
import { apiError, apiValidationError } from "@/lib/api-response";

/**
 * GET /api/places?q=kora[&lat=..&lng=..]      → place suggestions as you type
 * GET /api/places?lat=..&lng=..&reverse=1      → the place at a point ("use current location")
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
    const { q, lat, lng, reverse } = parsed.data;

    let url: string;
    if (reverse && lat != null && lng != null) {
      url = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&limit=1&lang=en`;
    } else {
      if (!q || q.length < 2) return NextResponse.json({ places: [] });
      const bias = lat != null && lng != null ? `&lat=${lat.toFixed(3)}&lon=${lng.toFixed(3)}` : "";
      url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=10&lang=en${bias}`;
    }

    const res = await fetch(url, {
      headers: { "User-Agent": "xivago-app/1.0 (place search)", Accept: "application/json" },
      next: { revalidate: 60 * 60 * 24 },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return apiError(502, "PLACES_UNAVAILABLE", "Place search is unavailable right now.");
    const data = (await res.json()) as { features?: PhotonFeature[] };

    const seen = new Set<string>();
    const places = (data.features ?? [])
      .map(shape)
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
