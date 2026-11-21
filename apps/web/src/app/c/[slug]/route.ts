import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /c/[slug]
 * "@slug" community mentions in posts link here; resolve the slug to the
 * community and redirect to its canonical /communities/[id] page.
 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const community = await prisma.community.findFirst({
    where: { slug: { equals: decodeURIComponent(slug), mode: "insensitive" } },
    select: { id: true },
  });
  const target = community ? `/communities/${community.id}` : "/communities";
  return NextResponse.redirect(new URL(target, req.url));
}
