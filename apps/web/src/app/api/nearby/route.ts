import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError, apiValidationError } from "@/lib/api-response";
import { getBoundingBox, haversineKm } from "@/lib/geo";

const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce.number().min(1).max(200).default(50),
});

const PEOPLE_LIMIT = 16;
const POSTS_LIMIT = 12;
const SCAN = 400;

const AUTHOR = { id: true, name: true, username: true, avatarUrl: true, companyName: true, isVerified: true, isBanned: true } as const;

/**
 * GET /api/nearby?lat=..&lng=..[&radiusKm=50]
 * "Near you" recommendations shown on the feed even when the nearby filter is
 * off: people who have posted or asked for something close by (we only know
 * where someone is from where they tagged a post / request -- never a live
 * location), and recent feed posts tagged near the viewer. Exact coordinates
 * are never returned, only a rounded distance.
 */
export async function GET(req: NextRequest) {
  try {
    const viewer = await requireUser();
    const parsed = querySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
    if (!parsed.success) return apiValidationError(parsed.error);
    const { lat, lng, radiusKm } = parsed.data;
    const box = getBoundingBox(lat, lng, radiusKm);
    const inBox = { lat: { gte: box.minLat, lte: box.maxLat }, lng: { gte: box.minLng, lte: box.maxLng } };

    const [posts, demands, following] = await Promise.all([
      prisma.forumMessage.findMany({
        where: { ...inBox, deletedAt: null, communityId: null },
        orderBy: { createdAt: "desc" },
        take: SCAN,
        select: {
          id: true,
          text: true,
          createdAt: true,
          lat: true,
          lng: true,
          sender: { select: AUTHOR },
          attachments: { where: { status: "APPROVED" }, select: { url: true, contentType: true }, take: 1 },
          _count: { select: { comments: true } },
        },
      }),
      prisma.demand.findMany({
        where: { ...inBox, status: "OPEN" },
        orderBy: { createdAt: "desc" },
        take: SCAN,
        select: { lat: true, lng: true, createdAt: true, author: { select: AUTHOR } },
      }),
      prisma.follow.findMany({ where: { followerId: viewer.id }, select: { followingId: true }, take: 2000 }),
    ]);
    const followed = new Set(following.map((f) => f.followingId));

    // People: nearest known spot per person.
    const people = new Map<string, { person: (typeof posts)[number]["sender"]; km: number; lastActive: Date }>();
    const consider = (person: (typeof posts)[number]["sender"], pLat: number | null, pLng: number | null, at: Date) => {
      if (pLat == null || pLng == null || person.id === viewer.id || person.isBanned) return;
      const km = haversineKm(lat, lng, pLat, pLng);
      if (km > radiusKm) return;
      const prev = people.get(person.id);
      if (!prev || km < prev.km) people.set(person.id, { person, km, lastActive: prev && prev.lastActive > at ? prev.lastActive : at });
    };
    posts.forEach((p) => consider(p.sender, p.lat, p.lng, p.createdAt));
    demands.forEach((d) => consider(d.author, d.lat, d.lng, d.createdAt));

    const peopleOut = [...people.values()]
      .sort((a, b) => Number(followed.has(a.person.id)) - Number(followed.has(b.person.id)) || a.km - b.km)
      .slice(0, PEOPLE_LIMIT)
      .map(({ person: { isBanned: _banned, ...person }, km }) => ({
        ...person,
        distanceKm: km < 1 ? 1 : Math.round(km),
        isFollowing: followed.has(person.id),
      }));

    const postsOut = posts
      .filter((p) => p.lat != null && p.lng != null && !p.sender.isBanned && haversineKm(lat, lng, p.lat, p.lng) <= radiusKm)
      .slice(0, POSTS_LIMIT)
      .map((p) => ({
        id: p.id,
        text: p.text.slice(0, 220),
        createdAt: p.createdAt,
        media: p.attachments[0] ?? null,
        commentCount: p._count.comments,
        distanceKm: Math.max(1, Math.round(haversineKm(lat, lng, p.lat!, p.lng!))),
        author: { id: p.sender.id, name: p.sender.name, avatarUrl: p.sender.avatarUrl, username: p.sender.username },
      }));

    return NextResponse.json({ people: peopleOut, posts: postsOut, radiusKm });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("nearby GET: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not load nearby recommendations.");
  }
}
