import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError } from "@/lib/api-response";
import { getPublicProfileWithSocial } from "@/lib/profile";
import { getUserTrust } from "@/lib/trust";
import { topTier } from "@/lib/trust-labels";

/** Messages scanned for shared media / files / links (newest first). */
const SCAN_LIMIT = 3000;
const URL_RE = /\bhttps?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/gi;

/**
 * GET /api/conversations/[id]/details
 * Everything the chat's profile panel shows (Telegram-style): the other
 * person's public profile with follow counts, trust tier + badges, and what
 * was shared in this chat -- media, files and links -- newest first.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id: conversationId } = await params;

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        buyerId: true,
        bidderId: true,
        createdAt: true,
        demand: { select: { id: true, summary: true, status: true } },
      },
    });
    if (!conversation) return apiError(404, "NOT_FOUND", "This chat doesn't exist.");
    const isParticipant = conversation.buyerId === user.id || conversation.bidderId === user.id;
    if (!isParticipant && !user.isAdmin) return apiError(403, "FORBIDDEN", "You're not part of this chat.");

    const otherId = conversation.buyerId === user.id ? conversation.bidderId : conversation.buyerId;

    const [profile, trust, extra, messages, commonCommunities] = await Promise.all([
      getPublicProfileWithSocial(otherId, user.id),
      getUserTrust(otherId),
      prisma.user.findUnique({ where: { id: otherId }, select: { isVerified: true, lastSeenAt: true } }),
      prisma.message.findMany({
        where: { conversationId, deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: SCAN_LIMIT,
        select: {
          id: true,
          text: true,
          senderId: true,
          createdAt: true,
          attachments: { select: { id: true, url: true, contentType: true } },
        },
      }),
      prisma.community.findMany({
        where: {
          AND: [{ members: { some: { userId: user.id } } }, { members: { some: { userId: otherId } } }],
        },
        select: { id: true, name: true, coverImage: true },
        take: 10,
      }).catch(() => [] as Array<{ id: string; name: string; coverImage: string | null }>),
    ]);
    if (!profile) return apiError(404, "NOT_FOUND", "This profile doesn't exist.");

    const media: Array<{ id: string; messageId: string; url: string; contentType: string; createdAt: Date }> = [];
    const files: Array<{ id: string; messageId: string; url: string; contentType: string; createdAt: Date; name: string }> = [];
    const links: Array<{ id: string; messageId: string; url: string; host: string; text: string; createdAt: Date; senderId: string }> = [];

    for (const m of messages) {
      for (const a of m.attachments) {
        if (a.contentType.startsWith("image/") || a.contentType.startsWith("video/")) {
          media.push({ id: a.id, messageId: m.id, url: a.url, contentType: a.contentType, createdAt: m.createdAt });
        } else {
          const name = decodeURIComponent(a.url.split("/").pop()?.split("?")[0] ?? "File");
          files.push({ id: a.id, messageId: m.id, url: a.url, contentType: a.contentType, createdAt: m.createdAt, name });
        }
      }
      const found = m.text.match(URL_RE);
      if (found) {
        found.forEach((url, i) => {
          let host = url;
          try {
            host = new URL(url).hostname.replace(/^www\./, "");
          } catch {
            // keep raw
          }
          links.push({ id: `${m.id}:${i}`, messageId: m.id, url, host, text: m.text, createdAt: m.createdAt, senderId: m.senderId });
        });
      }
    }

    return NextResponse.json({
      profile: {
        ...profile,
        isVerified: extra?.isVerified ?? false,
        lastSeenAt: extra?.lastSeenAt ?? null,
        tier: topTier(trust.tiers),
        badges: trust.badges,
      },
      demand: conversation.demand,
      chatStartedAt: conversation.createdAt,
      commonCommunities,
      media,
      files,
      links,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("conversations/details: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not load chat details.");
  }
}
