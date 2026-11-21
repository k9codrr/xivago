/**
 * Creates the starting list of roles for Requirement posts. Admins manage the
 * list afterwards at /admin/roles.
 *
 * Run: pnpm --filter @slotbook/db seed:roles
 *
 * Idempotent: a role that already exists is left as it is, so re-running never
 * overwrites an admin's edits. A role an admin deleted comes back if re-run.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_ROLES: Array<{ name: string; description: string }> = [
  { name: "Agent", description: "Represents you and closes deals on your behalf" },
  { name: "Analyst", description: "Researches, models and reports on data" },
  { name: "Workforce", description: "Staff or labour for hands-on work" },
  { name: "Consultant", description: "Expert guidance for a specific problem" },
  { name: "Freelancer", description: "Independent professional for a project" },
  { name: "Contractor", description: "Takes on and delivers a defined scope of work" },
  { name: "Developer", description: "Builds software, apps and websites" },
  { name: "Designer", description: "Brand, product and visual design" },
  { name: "Marketer", description: "Promotes and grows your business" },
  { name: "Supplier", description: "Provides products or materials" },
];

async function main() {
  for (const [index, role] of DEFAULT_ROLES.entries()) {
    await prisma.requirementRole.upsert({
      where: { name: role.name },
      create: { ...role, sortOrder: (index + 1) * 10 },
      update: {},
    });
  }
  console.log(`Requirement roles ready: ${DEFAULT_ROLES.length} checked.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
