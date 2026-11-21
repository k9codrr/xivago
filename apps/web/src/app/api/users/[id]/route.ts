import { NextRequest, NextResponse } from "next/server";
import { getPublicProfileWithSocial } from "@/lib/profile";
import { getOptionalUser } from "@/lib/guards";
import { apiError } from "@/lib/api-response";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const viewer = await getOptionalUser();
  const profile = await getPublicProfileWithSocial(id, viewer?.id ?? null);
  if (!profile) return apiError(404, "NOT_FOUND", "This profile doesn't exist.");
  return NextResponse.json({ profile });
}
