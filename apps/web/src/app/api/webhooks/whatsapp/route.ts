import { NextRequest, NextResponse } from "next/server";
import { prisma, type Prisma } from "@/lib/db";
import { verifyWebhookSignature, sendTextMessage } from "@slotbook/whatsapp";
import { getWhatsAppCreds } from "@/lib/whatsapp-creds";
import { env } from "@/lib/env";
import { apiError } from "@/lib/api-response";

/**
 * Meta's webhook verification handshake, performed once when you register
 * the webhook URL in the App Dashboard. Echoes `hub.challenge` back
 * verbatim if `hub.verify_token` matches our configured
 * WHATSAPP_WEBHOOK_VERIFY_TOKEN -- this is NOT the same secret as the
 * HMAC signature check on POST (that's WHATSAPP_APP_SECRET).
 */
export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("hub.mode");
  const token = req.nextUrl.searchParams.get("hub.verify_token");
  const challenge = req.nextUrl.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token && env.WHATSAPP_WEBHOOK_VERIFY_TOKEN && token === env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return apiError(403, "VERIFICATION_FAILED", "Webhook verification failed.");
}

interface WhatsAppStatusEntry {
  id: string; // this is the waMessageId we stored on send
  status: string; // "sent" | "delivered" | "read" | "failed"
  timestamp: string;
}

interface WhatsAppInboundMessage {
  id: string;
  from: string; // sender's WA id (digits, no leading +)
  timestamp: string;
  type: string;
  text?: { body: string };
}

interface WhatsAppWebhookBody {
  object?: string;
  entry?: Array<{
    changes?: Array<{
      value?: {
        statuses?: WhatsAppStatusEntry[];
        messages?: WhatsAppInboundMessage[];
      };
    }>;
  }>;
}

async function recordDeliveryStatus(status: WhatsAppStatusEntry): Promise<void> {
  const row = await prisma.notificationLog.findUnique({ where: { waMessageId: status.id } });
  if (!row) return; // status for a message we didn't send (or didn't record) -- nothing to update

  const existingPayload = (row.payload as Record<string, unknown> | null) ?? {};
  await prisma.notificationLog.update({
    where: { id: row.id },
    data: {
      payload: {
        ...existingPayload,
        deliveryStatus: status.status,
        deliveryStatusAt: status.timestamp,
      } as unknown as Prisma.InputJsonValue,
    },
  });
}

async function autoReplyToInbound(message: WhatsAppInboundMessage): Promise<void> {
  // Dedup: Meta may redeliver the same webhook event on retry -- don't
  // double-send the auto-reply for the same inbound message id.
  const alreadyReplied = await prisma.notificationLog.findFirst({
    where: { templateName: "auto_reply", payload: { path: ["inboundMessageId"], equals: message.id } },
    select: { id: true },
  });
  if (alreadyReplied) return;

  const to = message.from.startsWith("+") ? message.from : `+${message.from}`;
  try {
    const result = await sendTextMessage(getWhatsAppCreds(), {
      to,
      text: "Please use the xivago app to reply.",
    });
    await prisma.notificationLog.create({
      data: {
        toPhone: to,
        templateName: "auto_reply",
        status: "SENT",
        waMessageId: result.waMessageId,
        payload: { inboundMessageId: message.id } as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    console.error("whatsapp webhook: auto-reply failed (non-fatal)", { messageId: message.id, err });
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");

  const valid = verifyWebhookSignature(env.WHATSAPP_APP_SECRET, rawBody, signature);
  if (!valid) {
    return apiError(401, "INVALID_SIGNATURE", "Webhook signature verification failed.");
  }

  let body: WhatsAppWebhookBody;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return apiError(400, "INVALID_JSON", "Malformed webhook payload.");
  }

  try {
    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        for (const status of change.value?.statuses ?? []) {
          await recordDeliveryStatus(status);
        }
        for (const message of change.value?.messages ?? []) {
          await autoReplyToInbound(message);
        }
      }
    }
  } catch (err) {
    console.error("whatsapp webhook: handler error", err);
    // Still 200 below -- Meta retries on non-2xx, and our handlers are
    // idempotent (dedup checks), so a transient failure self-heals on the
    // next delivery attempt rather than needing a 5xx to signal retry.
  }

  return NextResponse.json({ received: true });
}
