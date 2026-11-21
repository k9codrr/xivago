/**
 * Gives every community that has no cover image a topic-matching one
 * (see community-covers.ts). Communities that already have a cover -- e.g. one
 * an admin uploaded -- are never touched, so this is safe to re-run.
 *
 * Run: pnpm --filter @slotbook/db backfill:community-covers
 */
import { PrismaClient } from "@prisma/client";
import { assignCoverImages } from "./community-covers";

const prisma = new PrismaClient();

const CONCURRENCY = 4; // stays under Prisma's default pool (5 connections on Neon)

async function main() {
  const missing = await prisma.community.findMany({
    where: { coverImage: null },
    select: { id: true, name: true, slug: true, description: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  const updates = assignCoverImages(missing);
  let done = 0;
  for (let i = 0; i < updates.length; i += CONCURRENCY) {
    const batch = updates.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map((c) =>
        // coverImage: null in the filter keeps a cover set meanwhile (e.g. by an admin) from being overwritten.
        prisma.community.updateMany({ where: { id: c.id, coverImage: null }, data: { coverImage: c.coverImage } }),
      ),
    );
    done += results.reduce((n, r) => n + r.count, 0);
  }

  const total = await prisma.community.count();
  console.log(`${done} covers added; ${total - missing.length} communities already had one (${total} total).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
