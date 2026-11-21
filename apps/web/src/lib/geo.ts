/**
 * Geo calculation utilities.
 * Uses the Haversine formula to compute spherical distance between two coordinates.
 */

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Calculates the great-circle distance between two points on the Earth (in km).
 */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

/**
 * Calculates a bounding box around a center point for a given radius in km.
 * Useful for fast indexing in DB before applying exact Haversine circle filter.
 */
export function getBoundingBox(
  lat: number,
  lng: number,
  radiusKm: number
): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
  // 1 degree latitude ~= 111 km
  const latDelta = radiusKm / 111.0;
  // 1 degree longitude ~= 111 * cos(latitude) km
  const cosLat = Math.cos(toRadians(lat));
  const lngDelta = radiusKm / (111.0 * Math.max(cosLat, 0.0001));

  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLng: lng - lngDelta,
    maxLng: lng + lngDelta,
  };
}
