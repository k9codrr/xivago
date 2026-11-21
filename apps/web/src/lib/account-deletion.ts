import "server-only";
import { DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { cancelSubscription } from "@slotbook/payments";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { getR2Client, isR2Configured } from "@/lib/r2";
import { getRazorpayCreds, isRazorpayConfigured } from "@/lib/razorpay-creds";

/**
 * Permanently delete a user and everything they created.
 *
 * Every user-owned table cascades from `users` (see schema.prisma), so one
 * `user.delete` removes their requests, offers, responses, feed posts,
 * comments, chats (both sides), ratings, communities they created, follows,
 * bookmarks, credits, payments, invoices, notifications and devices.
 *
 * The few things that point at their content WITHOUT a foreign key
 * (ForumReaction / ForumReport targets, notifications other people got about
 * them) are cleared by hand in the same transaction, and uploaded files are
 * removed from storage afterwards.
 *
 * Kept afterwards:
 *  - AccountDeletionLog: the fact of the deletion, masked email / phone, counts
 *  - RetainedFinancialRecord: the user's payments, invoices, credit ledger,
 *    withdrawal requests and subscription IN FULL, with their real name, email
 *    and phone, for tax / accounting / disputes (retained 8 years)
 *  - ConsentLog rows
 */
export class AccountDeletionError extends Error {
  constructor(public code: "NOT_FOUND" | "ADMIN_ACCOUNT") {
    super(code);
  }
}

export function maskEmail(email: string): string {
  const [local = "", domain] = email.split("@");
  if (!domain) return "***";
  return `${local.slice(0, 2)}***@${domain}`;
}

export function maskPhone(phone: string | null): string | null {
  if (!phone) return null;
  return phone.length <= 4 ? "****" : `${phone.slice(0, 3)}${"*".repeat(Math.max(phone.length - 7, 2))}${phone.slice(-4)}`;
}

/** R2 object key for a URL we host, or null for anything else. */
function r2KeyFromUrl(url: string | null | undefined): string | null {
  if (!url || !env.R2_PUBLIC_URL) return null;
  const base = env.R2_PUBLIC_URL.replace(/\/+$/, "") + "/";
  return url.startsWith(base) ? decodeURIComponent(url.slice(base.length).split("?")[0] ?? "") || null : null;
}

async function deleteFiles(urls: Array<string | null | undefined>) {
  if (!isR2Configured()) return;
  const keys = [...new Set(urls.map(r2KeyFromUrl).filter((k): k is string => Boolean(k)))];
  const client = getR2Client();
  for (let i = 0; i < keys.length; i += 1000) {
    try {
      await client.send(
        new DeleteObjectsCommand({
          Bucket: env.R2_BUCKET,
          Delete: { Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })), Quiet: true },
        }),
      );
    } catch (err) {
      console.error("account-deletion: could not delete some files", (err as Error).message);
    }
  }
}

/** Books of account must be kept 8 years (CGST Act s.36 / Companies Act s.128). */
const FINANCIAL_RETENTION_YEARS = 8;

/** Dates -> ISO strings so the rows can be stored as JSON exactly as they were. */
function toJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export async function deleteAccount(input: {
  userId: string;
  reason?: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}) {
  const { userId } = input;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      phone: true,
      companyName: true,
      role: true,
      createdAt: true,
      creditBalance: true,
      avatarUrl: true,
      companyLogo: true,
      subscription: { select: { status: true, razorpaySubId: true } },
    },
  });
  if (!user) throw new AccountDeletionError("NOT_FOUND");
  if (user.role === "ADMIN") throw new AccountDeletionError("ADMIN_ACCOUNT");

  // Everything their deletion will cascade away, gathered first so the
  // id-only references and files can be cleaned up too.
  const [demands, communities, conversations] = await Promise.all([
    prisma.demand.findMany({ where: { authorId: userId }, select: { id: true, postType: true, mediaUrls: true } }),
    prisma.community.findMany({ where: { creatorId: userId }, select: { id: true, coverImage: true } }),
    prisma.conversation.findMany({
      where: { OR: [{ buyerId: userId }, { bidderId: userId }] },
      select: { id: true },
    }),
  ]);
  const communityIds = communities.map((c) => c.id);
  const forumPosts = await prisma.forumMessage.findMany({
    where: { OR: [{ senderId: userId }, { communityId: { in: communityIds } }] },
    select: { id: true, senderId: true, attachments: { select: { url: true } } },
  });
  const forumPostIds = forumPosts.map((p) => p.id);
  const comments = await prisma.forumComment.findMany({
    where: { OR: [{ senderId: userId }, { messageId: { in: forumPostIds } }] },
    select: { id: true, senderId: true },
  });
  const commentIds = comments.map((c) => c.id);
  const messageAttachments = await prisma.messageAttachment.findMany({
    where: { message: { conversationId: { in: conversations.map((c) => c.id) } } },
    select: { url: true },
  });
  const demandIds = demands.map((d) => d.id);

  const [responses, messagesSent, ratingsGiven] = await Promise.all([
    prisma.bid.count({ where: { bidderId: userId } }),
    prisma.message.count({ where: { senderId: userId } }),
    prisma.rating.count({ where: { raterId: userId } }),
  ]);

  // Financial history, copied in full before the cascade removes it.
  const [payments, invoices, creditTransactions, refundRequests, subscriptionRow] = await Promise.all([
    prisma.payment.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.invoice.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.creditTransaction.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.refundRequest.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.subscription.findUnique({ where: { userId } }),
  ]);
  const deletedAt = new Date();
  const retainUntil = new Date(deletedAt);
  retainUntil.setFullYear(retainUntil.getFullYear() + FINANCIAL_RETENTION_YEARS);
  const financialTotals = {
    paymentCount: payments.length,
    capturedPaise: payments
      .filter((p) => p.status === "CAPTURED" || p.status === "REFUNDED")
      .reduce((sum, p) => sum + p.amountPaise, 0),
    refundedPaise: payments.reduce((sum, p) => sum + (p.refundAmountPaise ?? 0), 0),
    invoiceCount: invoices.length,
    invoiceCredits: invoices.reduce((sum, i) => sum + i.totalCredits, 0),
    creditBalanceAtDeletion: user.creditBalance,
  };

  const removedCounts = {
    requests: demands.filter((d) => d.postType === "REQUIREMENT").length,
    offers: demands.filter((d) => d.postType === "PROMOTE").length,
    responses,
    feedPosts: forumPosts.filter((p) => p.senderId === userId).length,
    comments: comments.filter((c) => c.senderId === userId).length,
    chats: conversations.length,
    messagesSent,
    communitiesCreated: communities.length,
    ratingsGiven,
  };

  // Stop future PRO charges before the subscription row disappears.
  if (user.subscription?.razorpaySubId && user.subscription.status === "ACTIVE" && isRazorpayConfigured()) {
    try {
      await cancelSubscription(getRazorpayCreds(), user.subscription.razorpaySubId, false);
    } catch (err) {
      console.error("account-deletion: could not cancel subscription", (err as Error).message);
    }
  }

  await prisma.$transaction([
    prisma.forumReaction.deleteMany({
      where: {
        OR: [
          { targetType: "MESSAGE", targetId: { in: forumPostIds } },
          { targetType: "COMMENT", targetId: { in: commentIds } },
        ],
      },
    }),
    prisma.forumReport.deleteMany({
      where: {
        OR: [
          { targetType: "MESSAGE", targetId: { in: forumPostIds } },
          { targetType: "COMMENT", targetId: { in: commentIds } },
        ],
      },
    }),
    // Other people's notifications about this user or their posts.
    prisma.notification.deleteMany({
      where: { OR: [{ actorId: userId }, { entityId: { in: [...demandIds, ...forumPostIds] } }] },
    }),
    prisma.user.delete({ where: { id: userId } }),
    prisma.accountDeletionLog.create({
      data: {
        userId,
        maskedEmail: maskEmail(user.email),
        maskedPhone: maskPhone(user.phone),
        role: user.role,
        accountCreatedAt: user.createdAt,
        deletedBy: "SELF",
        reason: input.reason?.trim().slice(0, 500) || null,
        removedCounts,
        creditsForfeited: Math.max(user.creditBalance, 0),
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        deletedAt,
        financialRecord: {
          create: {
            userId,
            name: user.name,
            email: user.email,
            phone: user.phone,
            companyName: user.companyName,
            accountCreatedAt: user.createdAt,
            deletedAt,
            payments: toJson(payments),
            invoices: toJson(invoices),
            creditTransactions: toJson(creditTransactions),
            refundRequests: toJson(refundRequests),
            subscription: subscriptionRow ? toJson(subscriptionRow) : undefined,
            totals: financialTotals,
            retainUntil,
          },
        },
      },
    }),
  ]);

  await deleteFiles([
    user.avatarUrl,
    user.companyLogo,
    ...demands.flatMap((d) => d.mediaUrls),
    ...communities.map((c) => c.coverImage),
    ...forumPosts.flatMap((p) => p.attachments.map((a) => a.url)),
    ...messageAttachments.map((a) => a.url),
  ]);

  return { removedCounts };
}
