import { NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/guards";
import { getDemandDetail, HIDDEN_FROM_FEED } from "@/lib/demand-access";
import { apiError } from "@/lib/api-response";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sessionUser = await getOptionalUser();

  const demand = await getDemandDetail(
    id,
    sessionUser ? { id: sessionUser.id, isAdmin: sessionUser.isAdmin } : null,
  );

  if (!demand) return apiError(404, "NOT_FOUND", "This request doesn't exist.");

  // §3.8: EXPIRED/FILLED (and CANCELLED, treated the same) demands 410 for
  // everyone except ADMIN — see DECISIONS.md #20 for why this applies even
  // to the author/slot-holders.
  if (HIDDEN_FROM_FEED.includes(demand.status) && !sessionUser?.isAdmin) {
    return apiError(410, "GONE", "This request is no longer available.");
  }

  return NextResponse.json({ demand });
}
