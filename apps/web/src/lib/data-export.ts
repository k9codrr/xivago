import "server-only";
import { prisma } from "@/lib/db";

/**
 * Everything we hold about a user, as one JSON document they can download
 * (Settings → Delete account → Download my data, or before deleting).
 *
 * Never included: password hash, T-PIN hash, device push tokens, the
 * Instagram access token, payment signatures, and other people's private
 * data (only the messages and comments this user wrote are exported).
 */
export async function buildUserDataExport(userId: string) {
  const profile = await prisma.user.findUnique({
    where: { id: userId },
    omit: { passwordHash: true },
  });
  if (!profile) return null;

  const [
    posts,
    responses,
    conversations,
    messagesSent,
    feedPosts,
    comments,
    ratingsGiven,
    ratingsReceived,
    following,
    followers,
    bookmarks,
    forumBookmarks,
    communitiesCreated,
    communityMemberships,
    creditTransactions,
    payments,
    invoices,
    refundRequests,
    subscription,
    notifications,
    consentLogs,
    spinWins,
    badges,
    metaLink,
  ] = await Promise.all([
    prisma.demand.findMany({ where: { authorId: userId }, orderBy: { createdAt: "asc" } }),
    prisma.bid.findMany({ where: { bidderId: userId }, orderBy: { createdAt: "asc" } }),
    prisma.conversation.findMany({
      where: { OR: [{ buyerId: userId }, { bidderId: userId }] },
      select: {
        id: true,
        demandId: true,
        createdAt: true,
        buyer: { select: { id: true, name: true } },
        bidder: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.message.findMany({
      where: { senderId: userId },
      include: { attachments: { select: { url: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.forumMessage.findMany({
      where: { senderId: userId },
      include: { attachments: { select: { url: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.forumComment.findMany({ where: { senderId: userId }, orderBy: { createdAt: "asc" } }),
    prisma.rating.findMany({ where: { raterId: userId } }),
    prisma.rating.findMany({ where: { ratedUserId: userId } }),
    prisma.follow.findMany({
      where: { followerId: userId },
      select: { createdAt: true, following: { select: { id: true, name: true, username: true } } },
    }),
    prisma.follow.findMany({
      where: { followingId: userId },
      select: { createdAt: true, follower: { select: { id: true, name: true, username: true } } },
    }),
    prisma.bookmark.findMany({ where: { userId } }),
    prisma.forumBookmark.findMany({ where: { userId } }),
    prisma.community.findMany({ where: { creatorId: userId } }),
    prisma.communityMember.findMany({ where: { userId } }),
    prisma.creditTransaction.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.payment.findMany({ where: { userId }, omit: { razorpaySignature: true }, orderBy: { createdAt: "asc" } }),
    prisma.invoice.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.refundRequest.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.subscription.findUnique({ where: { userId } }),
    prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.consentLog.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.spinWin.findMany({ where: { userId } }),
    prisma.userBadge.findMany({ where: { userId } }),
    prisma.metaAccountLink.findUnique({ where: { userId }, omit: { igAccessToken: true } }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    format: "xivago-data-export/v1",
    note: "All personal data xivago holds about this account. Passwords, PINs and security tokens are never included.",
    profile,
    posts,
    responses,
    conversations,
    messagesSent,
    feedPosts,
    comments,
    ratingsGiven,
    ratingsReceived,
    following: following.map((f) => ({ ...f.following, since: f.createdAt })),
    followers: followers.map((f) => ({ ...f.follower, since: f.createdAt })),
    bookmarks,
    forumBookmarks,
    communitiesCreated,
    communityMemberships,
    credits: { balance: profile.creditBalance, transactions: creditTransactions },
    payments,
    invoices,
    refundRequests,
    subscription,
    notifications,
    consentLogs,
    spinWins,
    badges,
    linkedAccounts: metaLink,
  };
}
