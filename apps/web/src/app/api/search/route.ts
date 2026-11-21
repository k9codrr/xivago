import { NextRequest, NextResponse } from "next/server";
import { prisma, SERVICE_CATEGORIES } from "@/lib/db";
import { getOptionalUser } from "@/lib/guards";
import { apiValidationError } from "@/lib/api-response";
import { searchQuerySchema } from "@/lib/validation/search";
import { HIDDEN_FROM_FEED } from "@/lib/demand-access";
import { getParentCategoryById, getProviderById, getSubCategoryById } from "@/lib/categories";
import { matchTaxonomy, normalizeTag } from "@/lib/category-tags.server";

const RESULT_LIMIT = 10;

/**
 * One search endpoint fanning out across every searchable entity in the app
 * (people, demands, communities, public posts, and -- only for the signed-in
 * viewer's own threads -- chat messages), rather than a per-entity search
 * bar on each page. `type` narrows to one bucket with a higher per-bucket
 * limit; `all` returns a taste of each. `category` filters by a main category
 * id (or a SERVICE_CATEGORIES name) instead of free text.
 *
 * A query naming a category, sub category, provider type, problem or tag also
 * returns the providers offering it: `matchTaxonomy` maps the text to the ids
 * providers store on their profile.
 */
export async function GET(req: NextRequest) {
  const viewer = await getOptionalUser();

  const url = new URL(req.url);
  const parsed = searchQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return apiValidationError(parsed.error);
  const { q, type, category } = parsed.data;

  if (!q && !category) {
    return NextResponse.json({ people: [], demands: [], communities: [], posts: [], messages: [], categories: [] });
  }

  const mainCategory = category ? getParentCategoryById(category) : undefined;
  const categoryTags = category && !mainCategory ? SERVICE_CATEGORIES[category] ?? [category] : null;
  const match = q ? matchTaxonomy(q) : null;
  const tagTerm = q ? normalizeTag(q) : "";
  const take = type === "all" ? RESULT_LIMIT : RESULT_LIMIT * 3;

  const wantPeople = type === "all" || type === "people";
  const wantDemands = type === "all" || type === "demands";
  const wantCommunities = type === "all" || type === "communities";
  const wantPosts = type === "all" || type === "posts";
  const wantMessages = (type === "all" || type === "messages") && Boolean(viewer);

  const [people, demands, communities, posts, messages] = await Promise.all([
    wantPeople
      ? prisma.user.findMany({
          where: {
            isBanned: false,
            ...(q
              ? {
                  OR: [
                    { name: { contains: q, mode: "insensitive" } },
                    { companyName: { contains: q, mode: "insensitive" } },
                    { services: { hasSome: serviceTermsFor(q) } },
                    ...(match?.subIds.length ? [{ categorySubIds: { hasSome: match.subIds } }] : []),
                    ...(match?.providerIds.length ? [{ categoryProviderIds: { hasSome: match.providerIds } }] : []),
                    ...(match?.problemIds.length ? [{ categoryProblemIds: { hasSome: match.problemIds } }] : []),
                  ],
                }
              : {}),
            ...(categoryTags ? { services: { hasSome: categoryTags } } : {}),
            ...(mainCategory ? { categorySubIds: { hasSome: mainCategory.subCategories.map((s) => s.id) } } : {}),
          },
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            companyName: true,
            role: true,
            categorySubIds: true,
            categoryProviderIds: true,
          },
          take,
        })
      : [],
    wantDemands
      ? prisma.demand.findMany({
          where: {
            status: { notIn: HIDDEN_FROM_FEED },
            timelineEnd: { gt: new Date() },
            AND: [
              ...(q
                ? [
                    {
                      OR: [
                        { summary: { contains: q, mode: "insensitive" as const } },
                        { tags: { has: tagTerm } },
                        ...(match?.subIds.length ? [{ categorySubId: { in: match.subIds } }] : []),
                      ],
                    },
                  ]
                : []),
              ...(category ? [{ OR: [{ categoryName: category }, { categoryParentId: mainCategory?.id ?? category }] }] : []),
            ],
          },
          select: { id: true, summary: true, budgetMin: true, budgetMax: true, currency: true, status: true },
          take,
        })
      : [],
    wantCommunities
      ? prisma.community.findMany({
          where: q
            ? {
                OR: [
                  { name: { contains: q, mode: "insensitive" } },
                  { slug: { contains: q, mode: "insensitive" } },
                  { description: { contains: q, mode: "insensitive" } },
                ],
              }
            : {},
          select: { id: true, name: true, slug: true, coverImage: true },
          take,
        })
      : [],
    wantPosts && q
      ? prisma.forumMessage.findMany({
          where: { deletedAt: null, text: { contains: q, mode: "insensitive" } },
          select: { id: true, text: true, createdAt: true, senderId: true, sender: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
          take,
        })
      : [],
    wantMessages && q && viewer
      ? prisma.message.findMany({
          where: {
            text: { contains: q, mode: "insensitive" },
            conversation: { OR: [{ buyerId: viewer.id }, { bidderId: viewer.id }] },
          },
          select: { id: true, text: true, createdAt: true, conversationId: true },
          orderBy: { createdAt: "desc" },
          take,
        })
      : [],
  ]);

  const matchedSubs = new Set(match?.subIds ?? []);
  const matchedProviders = new Set(match?.providerIds ?? []);
  const shapedPeople = people
    .map(({ categorySubIds, categoryProviderIds, ...person }) => {
      const providerId = categoryProviderIds.find((id) => matchedProviders.has(id));
      const subId = categorySubIds.find((id) => matchedSubs.has(id));
      const offers =
        (providerId && getProviderById(providerId)?.provider.name) || (subId && getSubCategoryById(subId)?.sub.name) || null;
      return { ...person, offers, rank: providerId ? 0 : subId ? 1 : 2 };
    })
    .sort((a, b) => a.rank - b.rank)
    .map(({ rank: _rank, ...person }) => person);

  return NextResponse.json({
    people: shapedPeople,
    demands,
    communities,
    posts,
    messages,
    categories: match?.categories ?? [],
  });
}

/** `User.services` is case-sensitive free text, so try the casings people actually save. */
function serviceTermsFor(q: string): string[] {
  const lower = q.trim().toLowerCase();
  const title = lower.replace(/\b\w/g, (c) => c.toUpperCase());
  return Array.from(new Set([q.trim(), lower, title]));
}
