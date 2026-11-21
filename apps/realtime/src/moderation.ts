/**
 * Minimal duplicate of apps/web/src/lib/moderation.ts's image check --
 * apps/realtime is a separate Node process and can't import apps/web's
 * "@/lib/*" files (different app, different TS project, Next-specific
 * server-only marker), so the ~20 lines needed here are copied rather than
 * shared via a new package. Same precedent as DECISIONS.md #33.
 *
 * Fail-OPEN for chat (unlike the forum's fail-closed default, #45) -- see
 * DECISIONS.md #50 for why: a DM is already between two people who found
 * each other through a paid, verified interaction, not a public broadcast.
 */

const MODERATION_API_URL = process.env.MODERATION_API_URL ?? "https://api.sightengine.com/1.0/check.json";
const MODERATION_API_USER = process.env.MODERATION_API_USER ?? "";
const MODERATION_API_KEY = process.env.MODERATION_API_KEY ?? "";

export async function isImageSafe(imageUrl: string): Promise<boolean> {
  if (!MODERATION_API_USER || !MODERATION_API_KEY) return true; // fail-open, see doc comment above

  try {
    const url = new URL(MODERATION_API_URL);
    url.searchParams.set("url", imageUrl);
    url.searchParams.set("models", "nudity-2.1,offensive,gore-2.0");
    url.searchParams.set("api_user", MODERATION_API_USER);
    url.searchParams.set("api_secret", MODERATION_API_KEY);

    const res = await fetch(url.toString());
    const data = (await res.json()) as {
      status?: string;
      nudity?: { sexual_activity?: number; sexual_display?: number; erotica?: number };
      offensive?: { prob?: number };
      gore?: { prob?: number };
    };
    if (!res.ok || data.status !== "success") return true; // provider error -- fail-open, don't block chat on an outage

    const nudityScore = Math.max(
      data.nudity?.sexual_activity ?? 0,
      data.nudity?.sexual_display ?? 0,
      data.nudity?.erotica ?? 0,
    );
    const THRESHOLD = 0.5;
    if (nudityScore >= THRESHOLD) return false;
    if ((data.offensive?.prob ?? 0) >= THRESHOLD) return false;
    if ((data.gore?.prob ?? 0) >= THRESHOLD) return false;
    return true;
  } catch {
    return true; // network failure -- fail-open
  }
}
