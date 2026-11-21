import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiValidationError } from "@/lib/api-response";
import { isKnownTag, normalizeTag, searchTags } from "@/lib/category-tags.server";

const tagQuerySchema = z.object({
  q: z.string().trim().max(80).default(""),
  sub: z.string().trim().max(20).optional(),
  // "1" adds custom tags already used on open posts (posting + feed filter only).
  custom: z.enum(["0", "1"]).default("0"),
});

const LIMIT = 30;
const CUSTOM_TTL_MS = 5 * 60 * 1000;

interface CustomTagRow {
  tag: string;
  uses: number;
  subIds: string[];
}

let customCache: { at: number; rows: CustomTagRow[] } | null = null;

/**
 * Custom (non-workbook) tags in use on open posts, most used first. Cached
 * in memory for a few minutes so typing in the picker doesn't hit the
 * database on every keystroke.
 */
async function customTagsInUse(): Promise<CustomTagRow[]> {
  if (customCache && Date.now() - customCache.at < CUSTOM_TTL_MS) return customCache.rows;
  try {
    const raw = await prisma.$queryRaw<{ tag: string; uses: bigint; sub_ids: (string | null)[] }[]>`
      SELECT t AS tag, COUNT(*) AS uses, ARRAY_AGG(DISTINCT d."categorySubId") AS sub_ids
      FROM demands d, UNNEST(d.tags) AS t
      WHERE d.status = 'OPEN' AND d."timelineEnd" > NOW()
      GROUP BY t
      ORDER BY uses DESC
      LIMIT 500`;
    const rows = raw
      .filter((r) => !isKnownTag(r.tag))
      .map((r) => ({ tag: r.tag, uses: Number(r.uses), subIds: r.sub_ids.filter((s): s is string => Boolean(s)) }));
    customCache = { at: Date.now(), rows };
    return rows;
  } catch (err) {
    console.error("tags GET: custom tag lookup failed", err);
    return customCache?.rows ?? [];
  }
}

/**
 * Tags for the tag picker dropdown: workbook tags first, then custom tags
 * other people already use on open posts, so they're discoverable in both
 * posting and the feed filter.
 */
export async function GET(req: NextRequest) {
  const parsed = tagQuerySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return apiValidationError(parsed.error);
  const { q, sub, custom: withCustom } = parsed.data;

  const known = searchTags(q, { subId: sub, limit: LIMIT });
  if (withCustom !== "1") {
    return NextResponse.json({ tags: known, custom: [] }, { headers: { "Cache-Control": "private, max-age=3600" } });
  }
  const term = normalizeTag(q);
  const custom = (await customTagsInUse())
    .filter((r) => (term ? r.tag.includes(term) : !sub || r.subIds.includes(sub)))
    .sort((a, b) => {
      // Prefix matches and this sub category's tags first, then by popularity.
      const score = (r: CustomTagRow) =>
        (term && r.tag.startsWith(term) ? 0 : 2) + (sub && r.subIds.includes(sub) ? 0 : 1);
      return score(a) - score(b) || b.uses - a.uses;
    })
    .map((r) => r.tag);

  const customSlots = Math.max(5, LIMIT - known.length);
  const customPicked = custom.filter((t) => !known.includes(t)).slice(0, customSlots);

  return NextResponse.json(
    { tags: [...known, ...customPicked], custom: customPicked },
    { headers: { "Cache-Control": "private, max-age=300" } },
  );
}
