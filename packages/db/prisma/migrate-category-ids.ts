/**
 * One-off: rewrites category ids stored on demands and users from the previous
 * taxonomy to the workbook taxonomy, so feed filters and provider search match
 * them. Display lookups already resolve old ids through aliases.
 *
 * Run: pnpm --filter @slotbook/db migrate:category-ids
 *
 * Idempotent: no current id is an alias key, so a second run changes nothing.
 */
import { PrismaClient } from "@prisma/client";
import {
  LEGACY_CATEGORY_ALIASES,
  getParentCategoryById,
  getSubCategoryById,
  resolveCategoryId,
} from "../../../apps/web/src/lib/categories.js";

const prisma = new PrismaClient();

const legacyIds = Object.keys(LEGACY_CATEGORY_ALIASES);
const remap = (ids: string[]) => Array.from(new Set(ids.map(resolveCategoryId)));
const isLegacy = (id: string | null) => id != null && id in LEGACY_CATEGORY_ALIASES;

async function migrateDemands() {
  const demands = await prisma.demand.findMany({
    where: {
      OR: [
        { categoryParentId: { in: legacyIds } },
        { categorySubId: { in: legacyIds } },
        { categoryProviderId: { in: legacyIds } },
        { categoryProblemIds: { hasSome: legacyIds } },
      ],
    },
    select: { id: true, categoryParentId: true, categorySubId: true, categoryProviderId: true, categoryProblemIds: true },
  });

  for (const demand of demands) {
    const sub = demand.categorySubId ? getSubCategoryById(demand.categorySubId) : undefined;
    const parent = sub?.parent ?? (demand.categoryParentId ? getParentCategoryById(demand.categoryParentId) : undefined);
    await prisma.demand.update({
      where: { id: demand.id },
      data: {
        // A moved sub can land under a different main than its old parent's alias, so the sub decides.
        categoryParentId: parent?.id ?? demand.categoryParentId,
        categoryName: parent?.name,
        categorySubId: sub?.sub.id ?? demand.categorySubId,
        subCategoryName: sub?.sub.name,
        categoryProviderId: isLegacy(demand.categoryProviderId)
          ? resolveCategoryId(demand.categoryProviderId!)
          : demand.categoryProviderId,
        categoryProblemIds: remap(demand.categoryProblemIds),
      },
    });
  }
  return demands.length;
}

async function migrateUsers() {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { categorySubIds: { hasSome: legacyIds } },
        { categoryProviderIds: { hasSome: legacyIds } },
        { categoryProblemIds: { hasSome: legacyIds } },
      ],
    },
    select: { id: true, categorySubIds: true, categoryProviderIds: true, categoryProblemIds: true },
  });

  for (const user of users) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        categorySubIds: remap(user.categorySubIds),
        categoryProviderIds: remap(user.categoryProviderIds),
        categoryProblemIds: remap(user.categoryProblemIds),
      },
    });
  }
  return users.length;
}

async function main() {
  const demands = await migrateDemands();
  const users = await migrateUsers();
  console.log(`Migrated category ids on ${demands} demands and ${users} users.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
