import "server-only";
import { prisma } from "@/lib/db";

/**
 * The ONLY set of User fields ever returned for a *public* profile view.
 * Deliberately excludes: email, passwordHash, phone, creditBalance,
 * isBanned, isVerified-adjacent admin internals. `phone` in particular is
 * never selected here — it only ever gets serialized from the per-demand
 * contact-reveal code path added in M3, gated on `shareContact`. See
 * DECISIONS.md #14.
 */
export const PUBLIC_PROFILE_SELECT = {
  id: true,
  name: true,
  username: true,
  role: true,
  bio: true,
  avatarUrl: true,
  companyName: true,
  companyLogo: true,
  website: true,
  services: true,
  location: true,
  createdAt: true,
} as const;

export type PublicProfile = {
  id: string;
  name: string;
  username: string | null;
  role: "VENDOR" | "BUSINESS" | "ADMIN";
  bio: string | null;
  avatarUrl: string | null;
  companyName: string | null;
  companyLogo: string | null;
  website: string | null;
  services: string[];
  location: string | null;
  createdAt: Date;
};

export interface PublicProfileWithSocial extends PublicProfile {
  followerCount: number;
  followingCount: number;
  isFollowedByViewer: boolean;
  isViewerSelf: boolean;
}

export async function getPublicProfile(userId: string): Promise<PublicProfile | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: PUBLIC_PROFILE_SELECT,
  });
}

/** Adds follow counts/state on top of getPublicProfile -- used by /u/[id] and its API route. */
export async function getPublicProfileWithSocial(
  userId: string,
  viewerId: string | null,
): Promise<PublicProfileWithSocial | null> {
  const profile = await getPublicProfile(userId);
  if (!profile) return null;

  const [followerCount, followingCount, viewerFollow] = await Promise.all([
    prisma.follow.count({ where: { followingId: userId } }),
    prisma.follow.count({ where: { followerId: userId } }),
    viewerId && viewerId !== userId
      ? prisma.follow.findUnique({ where: { followerId_followingId: { followerId: viewerId, followingId: userId } } })
      : null,
  ]);

  return {
    ...profile,
    followerCount,
    followingCount,
    isFollowedByViewer: Boolean(viewerFollow),
    isViewerSelf: viewerId === userId,
  };
}
