import { createHmac, timingSafeEqual } from "node:crypto";

export interface WhatsAppCredentials {
  token: string;
  phoneNumberId: string;
  businessAccountId: string;
  appSecret: string;
  webhookVerifyToken: string;
  apiVersion: string;
}

export class WhatsAppApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = "WhatsAppApiError";
  }
}

function graphUrl(creds: WhatsAppCredentials, path: string): string {
  return `https://graph.facebook.com/${creds.apiVersion}/${path}`;
}

/** Cloud API wants digits only (country code + number), no "+". */
function toWaId(e164Phone: string): string {
  return e164Phone.replace(/^\+/, "");
}

async function graphPost(creds: WhatsAppCredentials, path: string, body: unknown): Promise<unknown> {
  const res = await fetch(graphUrl(creds, path), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${creds.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new WhatsAppApiError(
      (data as { error?: { message?: string } } | null)?.error?.message ?? `WhatsApp API error (${res.status})`,
      res.status,
      data,
    );
  }
  return data;
}

export interface SendTemplateInput {
  to: string; // E.164, e.g. "+919876543210"
  templateName: string;
  languageCode?: string; // default "en"
  bodyParams: string[]; // ordered {{1}}, {{2}}, ...
}

export interface SendResult {
  waMessageId: string;
}

/**
 * Sends an approved WhatsApp template message (AUTHENTICATION or UTILITY
 * category -- never MARKETING, per the templates doc: "NEVER use MARKETING
 * category (7x cost in India, stricter approval)"). `templateName` must
 * exactly match a template name approved in Meta Business Manager.
 */
export async function sendTemplateMessage(
  creds: WhatsAppCredentials,
  input: SendTemplateInput,
): Promise<SendResult> {
  const data = (await graphPost(creds, `${creds.phoneNumberId}/messages`, {
    messaging_product: "whatsapp",
    to: toWaId(input.to),
    type: "template",
    template: {
      name: input.templateName,
      language: { code: input.languageCode ?? "en" },
      components: [
        {
          type: "body",
          parameters: input.bodyParams.map((text) => ({ type: "text", text })),
        },
      ],
    },
  })) as { messages?: Array<{ id: string }> };

  const waMessageId = data.messages?.[0]?.id;
  if (!waMessageId) throw new WhatsAppApiError("WhatsApp API returned no message id", 502, data);
  return { waMessageId };
}

export interface SendTextInput {
  to: string;
  text: string;
}

/**
 * Plain text message -- used only for the inbound-webhook auto-reply
 * (section 3.6.D). Cloud API only allows free-form text replies within the
 * 24h customer service window opened by an inbound message, which is
 * exactly the situation the auto-reply handler runs in.
 */
export async function sendTextMessage(creds: WhatsAppCredentials, input: SendTextInput): Promise<SendResult> {
  const data = (await graphPost(creds, `${creds.phoneNumberId}/messages`, {
    messaging_product: "whatsapp",
    to: toWaId(input.to),
    type: "text",
    text: { body: input.text },
  })) as { messages?: Array<{ id: string }> };

  const waMessageId = data.messages?.[0]?.id;
  if (!waMessageId) throw new WhatsAppApiError("WhatsApp API returned no message id", 502, data);
  return { waMessageId };
}

/**
 * Constant-time HMAC-SHA256 compare for the inbound webhook's
 * `X-Hub-Signature-256` header (format: `sha256=<hex>`), matching Meta's
 * documented verification scheme. Mirrors packages/payments's
 * verifyWebhookSignature for the same reasons (timing side-channel safety).
 */
export function verifyWebhookSignature(
  appSecret: string,
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  if (!signatureHeader) return false;
  const [scheme, providedHex] = signatureHeader.split("=");
  if (scheme !== "sha256" || !providedHex) return false;

  const expectedHex = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const expected = Buffer.from(expectedHex, "utf8");
  const provided = Buffer.from(providedHex, "utf8");
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(expected, provided);
}

/**
 * The five approved templates this app sends, exactly as named/worded in
 * the templates doc -- kept here as a single source of truth for template
 * names so a typo can't silently target a non-existent/unapproved
 * template. Category matters for cost/approval (see the doc): AUTHENTICATION
 * for the OTP, UTILITY for everything else.
 */
export const WHATSAPP_TEMPLATES = {
  OTP: "slotbook_otp",
  SLOT_PURCHASED: "slot_purchased",
  NEW_DEMAND_MATCH: "new_demand_match",
  DEMAND_EXPIRING: "demand_expiring",
  NEW_CHAT_MESSAGE: "new_chat_message",
} as const;
