import { PrismaClient } from "@prisma/client";

/**
 * Prisma client singleton.
 *
 * Next.js dev mode hot-reloads modules, which would otherwise create a new
 * PrismaClient (and a new connection pool) on every file save. We stash the
 * instance on `globalThis` in non-production so it survives HMR.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export * from "@prisma/client";
export { Prisma } from "@prisma/client";
export * from "./credits";
export * from "./service-categories";
export * from "./quota";
export * from "./subscription";
export * from "./ratings";
export * from "./username";
