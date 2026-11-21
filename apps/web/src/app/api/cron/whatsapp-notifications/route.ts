import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { env } from "@/lib/env";
import {
  sendQueuedDemandExpiringNotifications,
  sendNewDemandMatchDigests,
  sendStaleChatNotifications,
} from "@/lib/wa-notifications";
import { deliverPendingNotifications } from "@/lib/notifications";

function isAuthorized(req: NextRequest): boolean {
  if (!env.CRON_SECRET) return false;
  return req.headers.get("authorization") === `Bearer ${env.CRON_SECRET}`;
}

/**
 * Consolidated WhatsApp notification sweep -- see DECISIONS.md #41 for why
 * this covers three of the four notification types (demand_expiring,
 * new_demand_match, new_chat_message) in one Vercel Cron job rather than
 * three. slot_purchased (the fourth) is sent synchronously from
 * lib/slot-allocation.ts instead, since it's triggered by a specific event
 * rather than a periodic sweep.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return apiError(401, "UNAUTHORIZED", "Missing or invalid cron secret.");
  }

  const [expiring, digests, chat, pushOutbox] = await Promise.all([
    sendQueuedDemandExpiringNotifications(),
    sendNewDemandMatchDigests(),
    sendStaleChatNotifications(),
    // Safety net for in-app notifications whose push didn't go out right after commit.
    deliverPendingNotifications(),
  ]);

  return NextResponse.json({
    ok: true,
    demandExpiring: expiring,
    newDemandMatch: digests,
    newChatMessage: chat,
    pushOutbox,
    ranAt: new Date().toISOString(),
  });
}
