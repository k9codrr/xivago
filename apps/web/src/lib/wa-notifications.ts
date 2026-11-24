import "server-only";
import { prisma, type Prisma } from "@/lib/db";
import { sendTemplateMessage, WHATSAPP_TEMPLATES, WhatsAppApiError } from "@slotbook/whatsapp";
import { getWhatsAppCreds, isWhatsAppConfigured } from "@/lib/whatsapp-creds";
import { demandMatchesTerm } from "@/lib/demand-access";
import { formatBudgetRange } from "@/lib/money";
import { publicEnv } from "@/lib/env";
import { notifySlotPurchasedToAuthor } from "@/lib/notifications";

interface NotifPrefs {
  chatMessages?: boolean;
  demandMatches?: boolean;
}

/** Opt-OUT model: an absent key means enabled. See DECISIONS.md #42. */
function isPrefEnabled(notifPrefs: unknown, key: keyof NotifPrefs): boolean {
  const prefs = (notifPrefs ?? {}) as NotifPrefs;
  return prefs[key] !== false;
}

function appUrl(path: string): string {
  return `${publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "")}${path}`;
}

/**
 * Every function in this file swallows its own WhatsApp API errors (never
 * throws to the caller) -- section 3.6: "WA failure NEVER blocks core
 * flow." This is the opposite stance from lib/otp.ts, where delivery *is*
 * the core flow and failures are surfaced; these four are all
 * supplementary notifications layered on top of something that already
 * succeeded (a payment, a demand post, a chat message).
 */

// ── 1. slot_purchased -- fired synchronously right after a successful capture ──

export async function notifySlotPurchased(bidId: string): Promise<void> {
  // In-app + push to the demand author, independent of WhatsApp being configured.
  void notifySlotPurchasedToAuthor(bidId);

  if (!isWhatsAppConfigured()) return;

  try {
    const bid = await prisma.bid.findUnique({
      where: { id: bidId },
      select: {
        slot: true,
        bidder: { select: { id: true, phone: true, name: true } },
        demand: { select: { id: true, summary: true, budgetMin: true, budgetMax: true, authorId: true } },
      },
    });
    if (!bid?.bidder.phone) return; // nothing to notify without a verified phone

    const conversation = await prisma.conversation.findUnique({
      where: {
        demandId_buyerId_bidderId: {
          demandId: bid.demand.id,
          buyerId: bid.demand.authorId,
          bidderId: bid.bidder.id,
        },
      },
      select: { id: true },
    });
    const chatLink = conversation ? appUrl(`/chats/${conversation.id}`) : appUrl(`/demands/${bid.demand.id}`);
    const budget = formatBudgetRange(bid.demand.budgetMin, bid.demand.budgetMax) ?? "Not specified";

    const result = await sendTemplateMessage(getWhatsAppCreds(), {
      to: bid.bidder.phone,
      templateName: WHATSAPP_TEMPLATES.SLOT_PURCHASED,
      bodyParams: [String(bid.slot), bid.demand.summary.slice(0, 60), budget, chatLink],
    });

    await prisma.notificationLog.create({
      data: {
        toPhone: bid.bidder.phone,
        templateName: WHATSAPP_TEMPLATES.SLOT_PURCHASED,
        status: "SENT",
        waMessageId: result.waMessageId,
        payload: { bidId, demandId: bid.demand.id } as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    console.error("notifySlotPurchased: failed (non-fatal)", { bidId, err });
  }
}

// ── 2. new_demand_match -- daily digest, max 1/day/vendor, one demand each ──

export async function sendNewDemandMatchDigests(): Promise<{ sent: number; failed: number }> {
  if (!isWhatsAppConfigured()) return { sent: 0, failed: 0 };

  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);

  const vendors = await prisma.user.findMany({
    where: { role: "VENDOR", phone: { not: null }, isBanned: false, services: { isEmpty: false } },
    select: { id: true, phone: true, services: true },
  });

  const openDemands = await prisma.demand.findMany({
    where: { status: "OPEN", timelineEnd: { gt: new Date() } },
    select: { id: true, summary: true, budgetMin: true, budgetMax: true, bids: { select: { id: true } } },
    orderBy: { createdAt: "desc" },
    take: 200, // bounded scan -- fine at this scale, revisit with a search index if the feed grows large
  });

  let sent = 0;
  let failed = 0;

  for (const vendor of vendors) {
    if (!vendor.phone) continue;

    const alreadySentToday = await prisma.notificationLog.findFirst({
      where: { toPhone: vendor.phone, templateName: WHATSAPP_TEMPLATES.NEW_DEMAND_MATCH, createdAt: { gte: startOfToday } },
      select: { id: true },
    });
    if (alreadySentToday) continue;

    const match = openDemands.find(
      (d) => d.bids.length < 3 && vendor.services.some((tag) => demandMatchesTerm(d.summary, tag)),
    );
    if (!match) continue;

    const matchedTag = vendor.services.find((tag) => demandMatchesTerm(match.summary, tag)) ?? "your services";
    const budget = formatBudgetRange(match.budgetMin, match.budgetMax);
    const slotsLeft = 3 - match.bids.length;

    try {
      const result = await sendTemplateMessage(getWhatsAppCreds(), {
        to: vendor.phone,
        templateName: WHATSAPP_TEMPLATES.NEW_DEMAND_MATCH,
        bodyParams: [
          matchedTag,
          match.summary.slice(0, 60),
          budget?.split("–")[0]?.replace("₹", "") ?? "0",
          budget?.split("–")[1]?.replace("₹", "") ?? budget?.replace(/[₹+]/g, "") ?? "0",
          String(slotsLeft),
          appUrl(`/demands/${match.id}`),
        ],
      });
      await prisma.notificationLog.create({
        data: {
          toPhone: vendor.phone,
          templateName: WHATSAPP_TEMPLATES.NEW_DEMAND_MATCH,
          status: "SENT",
          waMessageId: result.waMessageId,
          payload: { demandId: match.id, vendorId: vendor.id } as unknown as Prisma.InputJsonValue,
        },
      });
      sent += 1;
    } catch (err) {
      failed += 1;
      await prisma.notificationLog.create({
        data: {
          toPhone: vendor.phone,
          templateName: WHATSAPP_TEMPLATES.NEW_DEMAND_MATCH,
          status: "FAILED",
          error: err instanceof WhatsAppApiError ? err.message : "Unknown error",
          payload: { demandId: match.id, vendorId: vendor.id } as unknown as Prisma.InputJsonValue,
        },
      });
    }
  }

  return { sent, failed };
}

// ── 3. demand_expiring -- picks up rows QUEUED by the M3 expiry cron ──

export async function sendQueuedDemandExpiringNotifications(): Promise<{ sent: number; failed: number }> {
  if (!isWhatsAppConfigured()) return { sent: 0, failed: 0 };

  const queued = await prisma.notificationLog.findMany({
    where: { templateName: WHATSAPP_TEMPLATES.DEMAND_EXPIRING, status: "QUEUED" },
    take: 100,
  });

  let sent = 0;
  let failed = 0;

  for (const row of queued) {
    const payload = row.payload as unknown as {
      demandId: string;
      summary: string;
      slotsFilled: number;
      timelineEnd: string;
    } | null;
    if (!payload) {
      await prisma.notificationLog.update({ where: { id: row.id }, data: { status: "FAILED", error: "MISSING_PAYLOAD" } });
      failed += 1;
      continue;
    }

    try {
      const result = await sendTemplateMessage(getWhatsAppCreds(), {
        to: row.toPhone,
        templateName: WHATSAPP_TEMPLATES.DEMAND_EXPIRING,
        bodyParams: [payload.summary.slice(0, 60), String(payload.slotsFilled), appUrl("/explore/sell")],
      });
      await prisma.notificationLog.update({
        where: { id: row.id },
        data: { status: "SENT", waMessageId: result.waMessageId },
      });
      sent += 1;
    } catch (err) {
      await prisma.notificationLog.update({
        where: { id: row.id },
        data: { status: "FAILED", error: err instanceof WhatsAppApiError ? err.message : "Unknown error" },
      });
      failed += 1;
    }
  }

  return { sent, failed };
}

// ── 4. new_chat_message -- only if notifPrefs enabled AND unread 15 min ──

export async function sendStaleChatNotifications(): Promise<{ sent: number; failed: number }> {
  if (!isWhatsAppConfigured()) return { sent: 0, failed: 0 };

  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const staleMessages = await prisma.message.findMany({
    where: { readAt: null, createdAt: { gte: oneDayAgo, lte: fifteenMinAgo } },
    select: {
      id: true,
      text: true,
      senderId: true,
      sender: { select: { name: true } },
      conversation: {
        select: {
          id: true,
          demandId: true,
          buyerId: true,
          bidderId: true,
          demand: { select: { summary: true } },
        },
      },
    },
    take: 200,
  });

  let sent = 0;
  let failed = 0;

  for (const message of staleMessages) {
    const recipientId = message.conversation.buyerId === message.senderId
      ? message.conversation.bidderId
      : message.conversation.buyerId;

    const alreadyNotified = await prisma.notificationLog.findFirst({
      where: {
        templateName: WHATSAPP_TEMPLATES.NEW_CHAT_MESSAGE,
        payload: { path: ["messageId"], equals: message.id },
      },
      select: { id: true },
    });
    if (alreadyNotified) continue;

    const recipient = await prisma.user.findUnique({
      where: { id: recipientId },
      select: { phone: true, metaLink: { select: { notifPrefs: true } } },
    });
    if (!recipient?.phone) continue;
    if (!isPrefEnabled(recipient.metaLink?.notifPrefs, "chatMessages")) continue;

    try {
      const result = await sendTemplateMessage(getWhatsAppCreds(), {
        to: recipient.phone,
        templateName: WHATSAPP_TEMPLATES.NEW_CHAT_MESSAGE,
        bodyParams: [
          message.sender.name,
          message.conversation.demand?.summary.slice(0, 60) ?? "your conversation",
          appUrl(`/chats/${message.conversation.id}`),
        ],
      });
      await prisma.notificationLog.create({
        data: {
          toPhone: recipient.phone,
          templateName: WHATSAPP_TEMPLATES.NEW_CHAT_MESSAGE,
          status: "SENT",
          waMessageId: result.waMessageId,
          payload: { messageId: message.id, conversationId: message.conversation.id } as unknown as Prisma.InputJsonValue,
        },
      });
      sent += 1;
    } catch (err) {
      failed += 1;
      await prisma.notificationLog.create({
        data: {
          toPhone: recipient.phone,
          templateName: WHATSAPP_TEMPLATES.NEW_CHAT_MESSAGE,
          status: "FAILED",
          error: err instanceof WhatsAppApiError ? err.message : "Unknown error",
          payload: { messageId: message.id, conversationId: message.conversation.id } as unknown as Prisma.InputJsonValue,
        },
      });
    }
  }

  return { sent, failed };
}
