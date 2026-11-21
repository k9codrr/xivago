import "server-only";
import type { WhatsAppCredentials } from "@slotbook/whatsapp";
import { env } from "@/lib/env";

export function getWhatsAppCreds(): WhatsAppCredentials {
  return {
    token: env.WHATSAPP_TOKEN,
    phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
    businessAccountId: env.WHATSAPP_BUSINESS_ACCOUNT_ID,
    appSecret: env.WHATSAPP_APP_SECRET,
    webhookVerifyToken: env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
    apiVersion: env.WHATSAPP_API_VERSION,
  };
}

export function isWhatsAppConfigured(): boolean {
  return Boolean(env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID && env.WHATSAPP_APP_SECRET);
}
