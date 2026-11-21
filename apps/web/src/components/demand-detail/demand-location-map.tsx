import { MapPin, Navigation } from "lucide-react";

interface DemandLocationMapProps {
  lat: number | null;
  lng: number | null;
  locationLabel: string | null;
}

// ~1.1 km of rounding: the map shows the neighbourhood, never the exact spot
// the poster was standing when they posted.
const round = (n: number) => Math.round(n * 100) / 100;
const SPAN = 0.012;

/**
 * "Posted in" map card. Uses keyless embeds (OpenStreetMap when the post has
 * coordinates, a Google Maps place search when it only has a text location)
 * and draws an area circle instead of a pin.
 */
export function DemandLocationMap({ lat, lng, locationLabel }: DemandLocationMapProps) {
  const hasCoords = lat != null && lng != null;
  if (!hasCoords && !locationLabel) return null;

  let embedSrc: string;
  let openHref: string;
  if (hasCoords) {
    const la = round(lat);
    const ln = round(lng);
    const bbox = [ln - SPAN, la - SPAN * 0.7, ln + SPAN, la + SPAN * 0.7].join(",");
    embedSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik`;
    openHref = `https://www.google.com/maps/search/?api=1&query=${la},${ln}`;
  } else {
    const q = encodeURIComponent(locationLabel!);
    embedSrc = `https://maps.google.com/maps?q=${q}&z=13&output=embed`;
    openHref = `https://www.google.com/maps/search/?api=1&query=${q}`;
  }

  return (
    <section className="card-shell overflow-hidden">
      <div className="flex items-center justify-between gap-3 p-4 pb-3">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">Posted in</h2>
          <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-neutral-500">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{locationLabel ?? "Approximate area"}</span>
          </p>
        </div>
        <a
          href={openHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex shrink-0 items-center gap-1 rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
        >
          <Navigation className="h-3.5 w-3.5" /> Open map
        </a>
      </div>
      <div className="relative h-48 w-full bg-neutral-100 dark:bg-neutral-900">
        <iframe
          title="Approximate location"
          src={embedSrc}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="pointer-events-none h-full w-full border-0 grayscale-[20%]"
        />
        {hasCoords && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-24 w-24 rounded-full border-2 border-brand-500 bg-brand-500/20" />
          </div>
        )}
      </div>
      <p className="px-4 py-2.5 text-[11px] text-neutral-400">Location is approximate to protect the poster&apos;s privacy.</p>
    </section>
  );
}
