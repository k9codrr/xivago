import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { applyCreditDelta } from "../src/credits.js";
import { SERVICE_CATEGORIES } from "../src/service-categories.js";

const prisma = new PrismaClient();

const WELCOME_CREDITS = Number(process.env.WELCOME_CREDITS ?? 30);

async function hash(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

async function main() {
  console.log("Seeding xivago database...");

  // ── Admin user ────────────────────────────────────────────────────────
  const adminEmail = "admin@slotbook.in";
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash: await hash("ChangeMe!123"),
      name: "xivago Team",
      role: Role.ADMIN,
      isVerified: true,
      creditBalance: 0,
      subscription: { create: {} }, // defaults to FREE/ACTIVE
    },
  });
  console.log(`  admin user: ${admin.email} (password: ChangeMe!123 — rotate before prod)`);

  // ── Demo vendors + one business, each granted welcome credits via the
  //    ledger service so CreditTransaction rows exist from day one ────────
  const demoUsers: Array<{
    email: string;
    name: string;
    role: Role;
    companyName?: string;
    services?: string[];
    location?: string;
    bio?: string;
  }> = [
    {
      email: "vendor1@slotbook.in",
      name: "Ramesh Kumar",
      role: Role.VENDOR,
      companyName: "Ramesh Packaging Co.",
      services: ["Corrugated Boxes", "Custom Printed Boxes", "Poly Mailers"],
      location: "Delhi, Delhi",
      bio: "Bulk packaging supplier for D2C brands. 12 years in the trade.",
    },
    {
      email: "vendor2@slotbook.in",
      name: "Priya Sharma",
      role: Role.VENDOR,
      companyName: "Pixel & Ink Studio",
      services: ["Product Photography", "Social Media Management", "Reels & Short Video"],
      location: "Bengaluru, Karnataka",
      bio: "Full-stack content studio for e-commerce sellers.",
    },
    {
      email: "business1@slotbook.in",
      name: "Anita Verma",
      role: Role.BUSINESS,
      companyName: "Verma Retail Traders",
      location: "Jaipur, Rajasthan",
      bio: "Sourcing manager, always hiring local vendors.",
    },
  ];

  for (const u of demoUsers) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        passwordHash: await hash("Password!123"),
        name: u.name,
        role: u.role,
        companyName: u.companyName,
        services: u.services ?? [],
        location: u.location,
        bio: u.bio,
        isVerified: true,
        subscription: { create: {} },
      },
    });

    // Idempotent welcome grant: only if this user has never received one.
    const alreadyGranted = await prisma.creditTransaction.findFirst({
      where: { userId: user.id, type: "GRANT", note: "welcome-grant" },
    });
    if (!alreadyGranted) {
      const { balance } = await applyCreditDelta(prisma, {
        userId: user.id,
        amount: WELCOME_CREDITS,
        type: "GRANT",
        note: "welcome-grant",
      });
      console.log(`  ${user.email}: welcome grant -> balance ${balance}`);
    }
  }

  console.log(`Seed complete. Service taxonomy: ${Object.keys(SERVICE_CATEGORIES).length} categories.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
