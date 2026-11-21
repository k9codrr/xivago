export const ANONYMOUS_AUTHOR_NAME = "Anonymous";

interface DemandViewer {
  id: string;
  isAdmin?: boolean;
}

interface MaskableDemand {
  authorId: string;
  author: { location: string | null; trust?: unknown };
  bids: Array<{ bidder: { id: string } }>;
}

/** The poster's identity is part of what a slot buys. The poster and admins always see it. */
export function canSeeDemandAuthor(demand: MaskableDemand, viewer: DemandViewer | null | undefined): boolean {
  if (!viewer) return false;
  return Boolean(viewer.isAdmin) || viewer.id === demand.authorId || demand.bids.some((b) => b.bidder.id === viewer.id);
}

/**
 * Removes the poster's identity from a demand unless the viewer may see it.
 * Applied on the server so the name, image and profile id never reach the
 * browser. The author is rebuilt from an allowlist, so a field added to an
 * author select later stays hidden by default.
 */
export function maskDemandAuthor<T extends MaskableDemand>(
  demand: T,
  viewer: DemandViewer | null | undefined,
): T & { authorHidden: boolean } {
  if (canSeeDemandAuthor(demand, viewer)) return { ...demand, authorHidden: false };
  const { location, trust } = demand.author;
  return {
    ...demand,
    authorHidden: true,
    authorId: "",
    author: {
      id: "",
      name: ANONYMOUS_AUTHOR_NAME,
      avatarUrl: null,
      companyName: null,
      companyLogo: null,
      bio: null,
      isVerified: false,
      createdAt: null,
      location,
      ...(trust === undefined ? {} : { trust }),
    } as unknown as T["author"],
  };
}
