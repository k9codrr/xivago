import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError, apiValidationError } from "@/lib/api-response";
import { publicEnv } from "@/lib/env";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import { getOrCreateReferralCode } from "@/lib/referrals";

const schema = z.object({
  name: z.string().trim().max(80).optional(),
  email: z.string().trim().toLowerCase().email().max(200),
});

/** Soft per-instance cap so the endpoint can't be used to spam inboxes. */
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 15;
const sent = new Map<string, number[]>();

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * POST /api/invites  { email, name? }
 * Invite someone who isn't on xivago yet, by email (sent through Resend).
 * If the address already belongs to a member we don't email -- we return
 * their id so the client can open a chat with them instead. SMS / WhatsApp
 * invites are composed on the device (wa.me link) and never touch the server.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);
    const { email, name } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, isBanned: true } });
    if (existing && !existing.isBanned) {
      return NextResponse.json({ ok: true, alreadyMember: true, userId: existing.id });
    }

    const now = Date.now();
    const recent = (sent.get(user.id) ?? []).filter((t) => now - t < WINDOW_MS);
    if (recent.length >= MAX_PER_WINDOW) {
      return apiError(429, "RATE_LIMITED", "You've sent a lot of invites. Try again in a bit.");
    }

    if (!isEmailConfigured()) {
      return apiError(503, "EMAIL_UNAVAILABLE", "Email invites aren't set up yet. Share the invite on WhatsApp instead.");
    }

    const [me, code] = await Promise.all([
      prisma.user.findUnique({ where: { id: user.id }, select: { name: true } }),
      getOrCreateReferralCode(user.id),
    ]);
    const inviter = me?.name?.trim() || "A friend";
    const link = `${publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/signup?ref=${encodeURIComponent(code)}`;
    const hello = name ? `Hi ${esc(name)},` : "Hi,";

    const result = await sendEmail({
      to: email,
      subject: `${inviter} invited you to chat on xivago`,
      text: `${name ? `Hi ${name},` : "Hi,"}\n\n${inviter} wants to message you on xivago — the place to post what you need and get responses from the right people.\n\nJoin here: ${link}\nReferral code: ${code}\n\nSee you there!`,
      html: `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:460px;background:#fff;border-radius:20px;overflow:hidden;border:1px solid #e4e4e7">
<tr><td style="background:#0a0a0a;padding:28px;text-align:center">
<p style="margin:0;font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.02em">xivago</p>
</td></tr>
<tr><td style="padding:28px">
<p style="margin:0 0 12px;font-size:15px">${hello}</p>
<h1 style="margin:0 0 10px;font-size:21px;line-height:1.3;font-weight:700">${esc(inviter)} wants to chat with you on xivago</h1>
<p style="margin:0 0 22px;font-size:15px;line-height:1.55;color:#52525b">Join to reply to their message, post what you need and hear back from the right people.</p>
<a href="${link}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 26px;border-radius:999px">Accept invite</a>
<p style="margin:22px 0 0;font-size:13px;color:#71717a">Referral code: <strong style="color:#111;letter-spacing:0.08em">${esc(code)}</strong></p>
</td></tr></table>
<p style="margin:16px 0 0;font-size:12px;color:#a1a1aa">You got this because ${esc(inviter)} invited you. Ignore it if it isn't for you.</p>
</td></tr></table></body></html>`,
    });
    if (!result.ok) return apiError(502, "EMAIL_FAILED", result.message);

    recent.push(now);
    sent.set(user.id, recent);
    return NextResponse.json({ ok: true, alreadyMember: false });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("invites POST: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not send the invite.");
  }
}

/** GET /api/invites -- the viewer's invite link + code, for WhatsApp / SMS invites composed on the device. */
export async function GET() {
  try {
    const user = await requireUser();
    const code = await getOrCreateReferralCode(user.id);
    const link = `${publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/signup?ref=${encodeURIComponent(code)}`;
    return NextResponse.json({ code, link });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    return apiError(500, "INTERNAL_ERROR", "Could not load your invite link.");
  }
}
