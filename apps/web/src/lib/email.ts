import "server-only";
import { Resend } from "resend";
import { env } from "@/lib/env";

/**
 * Transactional email through Resend (https://resend.com).
 * Set RESEND_API_KEY and EMAIL_FROM (an address on a domain verified in
 * Resend, e.g. "xivago <no-reply@xivago.com>"). With no key, email is off and
 * callers fall back to WhatsApp.
 */

let client: Resend | null = null;

export function isEmailConfigured(): boolean {
  return Boolean(env.RESEND_API_KEY);
}

function resend(): Resend {
  client ??= new Resend(env.RESEND_API_KEY);
  return client;
}

/** Placeholder addresses given to phone-first signups can't receive mail. */
export function isDeliverableEmail(email: string): boolean {
  return !/^wa\+\d+@users\.slotbook\.in$/i.test(email);
}

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export type SendEmailResult = { ok: true; id: string | null } | { ok: false; message: string };

export async function sendEmail(msg: EmailMessage): Promise<SendEmailResult> {
  if (!isEmailConfigured()) return { ok: false, message: "Email isn't set up on this environment yet." };
  try {
    const { data, error } = await resend().emails.send({
      from: env.EMAIL_FROM,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
    });
    if (error) {
      console.error("sendEmail: Resend rejected the message", { name: error.name, message: error.message });
      return { ok: false, message: "Could not send the email. Please try again shortly." };
    }
    return { ok: true, id: data?.id ?? null };
  } catch (err) {
    console.error("sendEmail: request failed", err);
    return { ok: false, message: "Could not send the email. Please try again shortly." };
  }
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Plain, single-column layout that renders the same in every mail client. */
function layout(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f5f5f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#fff;border-radius:16px;border:1px solid #e5e5e5">
<tr><td style="padding:28px">
<p style="margin:0 0 20px;font-size:18px;font-weight:700">xivago</p>
<h1 style="margin:0 0 12px;font-size:20px;font-weight:600">${escapeHtml(title)}</h1>
${bodyHtml}
</td></tr></table>
<p style="margin:16px 0 0;font-size:12px;color:#888">You're getting this because of activity on your xivago account.</p>
</td></tr></table></body></html>`;
}

export function passwordResetCodeEmail(name: string, code: string, minutes: number) {
  const greeting = name.trim() ? `Hi ${escapeHtml(name.trim())},` : "Hi,";
  return {
    subject: `${code} is your xivago password reset code`,
    html: layout(
      "Reset your password",
      `<p style="margin:0 0 16px;font-size:15px;line-height:1.5">${greeting} use this code to choose a new password:</p>
<p style="margin:0 0 16px;font-size:32px;font-weight:700;letter-spacing:8px">${code}</p>
<p style="margin:0;font-size:14px;line-height:1.5;color:#555">It expires in ${minutes} minutes. If you didn't ask for this, you can ignore this email; your password won't change.</p>`,
    ),
    text: `${name.trim() ? `Hi ${name.trim()},` : "Hi,"}\n\nYour xivago password reset code is ${code}. It expires in ${minutes} minutes.\n\nIf you didn't ask for this, ignore this email; your password won't change.`,
  };
}
