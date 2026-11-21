import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOptionalUser } from "@/lib/guards";

/** GET /api/notifications/unread-count -- for the bell badge. Signed-out → 0 (no 401 noise). */
export async function GET() {
  try {
    const user = await getOptionalUser();
    if (!user) return NextResponse.json({ unreadCount: 0 });
    const unreadCount = await prisma.notification.count({ where: { userId: user.id, readAt: null } });
    return NextResponse.json({ unreadCount });
  } catch (err) {
    console.error("notifications/unread-count GET: unexpected error", err);
    return NextResponse.json({ unreadCount: 0 });
  }
}
