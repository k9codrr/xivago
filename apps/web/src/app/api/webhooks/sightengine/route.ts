import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { flaggedVideoReason, videoCallbackToken } from "@/lib/moderation";

/**
 * Sightengine's callback for background video checks (see
 * startAsyncVideoModeration). It is called several times while frames are
 * analysed: any flagged frame rejects the video straight away; a clean,
 * finished check approves it. The URL carries an HMAC of the attachment id,
 * so a forged call can't approve anything.
 */
export async function POST(req: NextRequest) {
  const attachmentId = req.nextUrl.searchParams.get("attachment") ?? "";
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const expected = Buffer.from(videoCallbackToken(attachmentId));
  const given = Buffer.from(token);
  if (!attachmentId || expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return NextResponse.json({ error: "invalid token" }, { status: 401 });
  }

  let payload: { data?: { status?: string; frames?: Parameters<typeof flaggedVideoReason>[0] } };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const status = payload.data?.status; // "ongoing" | "finished" | "stopped"
  const flagged = flaggedVideoReason(payload.data?.frames);

  try {
    if (flagged) {
      // Only decide while it's still pending, so an admin's call is never overwritten.
      await prisma.forumAttachment.updateMany({
        where: { id: attachmentId, status: "PENDING" },
        data: { status: "REJECTED", moderationNote: flagged },
      });
    } else if (status === "finished") {
      await prisma.forumAttachment.updateMany({
        where: { id: attachmentId, status: "PENDING" },
        data: { status: "APPROVED", moderationNote: "Video auto-approved" },
      });
    } else if (status === "stopped") {
      await prisma.forumAttachment.updateMany({
        where: { id: attachmentId, status: "PENDING" },
        data: { moderationNote: "VIDEO_CHECK_STOPPED" }, // stays for an admin to review
      });
    }
  } catch (err) {
    console.error("sightengine webhook: update failed", { attachmentId, err });
  }

  return NextResponse.json({ received: true });
}
