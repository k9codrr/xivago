import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/** The roles shown in the post modal's Requirement step. */
export async function GET() {
  const roles = await prisma.requirementRole.findMany({
    where: { isActive: true },
    select: { id: true, name: true, description: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return NextResponse.json({ roles });
}
