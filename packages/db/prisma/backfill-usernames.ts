/**
 * Gives every user without an "@username" handle an auto-generated one (from
 * their name, else email). Users who already have one are never touched, so
 * this is safe to re-run. New and old accounts also get one lazily on demand.
 *
 * Run: pnpm --filter @slotbook/db backfill:usernames
 */
import { PrismaClient } from "@prisma/client";
import { ensureUsernames } from "../src/username";

const prisma = new PrismaClient();
const BATCH = 200;

async function main() {
  let total = 0;
  for (;;) {
    const ids = await prisma.user.findMany({
      where: { username: null },
      select: { id: true },
      orderBy: { createdAt: "asc" },
      take: BATCH,
    });
    if (ids.length === 0) break;
    const assigned = await ensureUsernames(prisma, ids.map((u) => u.id));
    total += assigned.size;
    if (assigned.size === 0) break; // nothing could be assigned; avoid looping forever
  }
  console.log(`backfill-usernames: assigned ${total} handle(s)`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
