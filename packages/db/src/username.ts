import { Prisma, type PrismaClient } from "@prisma/client";

type Db = Prisma.TransactionClient | PrismaClient;

/** Handles are 3-30 chars of lowercase letters, digits and underscores. */
export const USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/;
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;

/** Paths and words a handle must never be, so "@admin" can't impersonate staff. */
const RESERVED = new Set([
  "admin", "administrator", "support", "help", "xivago", "slotbook", "staff", "moderator", "mod",
  "system", "root", "official", "settings", "api", "null", "undefined", "everyone", "here",
]);

/** Lowercases and strips anything a handle can't hold; may return "". */
export function sanitizeUsername(raw: string): string {
  return raw
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, USERNAME_MAX);
}

export function isReservedUsername(username: string): boolean {
  return RESERVED.has(username);
}

/**
 * A handle can't be taken by another user or shadow a community slug, because
 * "@word" in a post resolves to a community first (communities had mentions first).
 */
export async function isUsernameAvailable(db: Db, username: string, exceptUserId?: string): Promise<boolean> {
  if (!USERNAME_PATTERN.test(username) || isReservedUsername(username)) return false;
  const [user, community] = await Promise.all([
    db.user.findFirst({
      where: { username, ...(exceptUserId ? { NOT: { id: exceptUserId } } : {}) },
      select: { id: true },
    }),
    db.community.findFirst({ where: { slug: { equals: username, mode: "insensitive" } }, select: { id: true } }),
  ]);
  return !user && !community;
}

/** Base for an auto handle: the name, else the email's local part (not the synthetic WhatsApp one). */
function baseFor(user: { name: string; email: string }): string {
  let base = sanitizeUsername(user.name);
  if (base.length < USERNAME_MIN || base === "xivago_user") {
    const local = user.email.split("@")[0] ?? "";
    if (!local.startsWith("wa+")) base = sanitizeUsername(local);
  }
  if (base.length < USERNAME_MIN) base = "user";
  return base.slice(0, USERNAME_MAX - 5);
}

/** Picks a free handle from the user's name, adding digits when it's taken. */
export async function generateUsername(db: Db, user: { name: string; email: string }): Promise<string> {
  const base = baseFor(user);
  if (await isUsernameAvailable(db, base)) return base;
  for (let i = 0; i < 12; i++) {
    const digits = i < 6 ? 2 + Math.floor(i / 2) : 5; // short suffixes first
    const n = Math.floor(Math.random() * 10 ** digits);
    const candidate = `${base}${String(n).padStart(digits, "0")}`.slice(0, USERNAME_MAX);
    if (await isUsernameAvailable(db, candidate)) return candidate;
  }
  return `${base.slice(0, 18)}_${Date.now().toString(36)}`.slice(0, USERNAME_MAX);
}

/**
 * Gives each listed user without a handle an auto-generated one, and returns
 * id -> username for all of them. Safe to call concurrently: a lost race on the
 * unique index just retries with a new candidate.
 */
export async function ensureUsernames(db: Db, userIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (userIds.length === 0) return out;
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true, username: true },
  });
  for (const u of users) {
    if (u.username) {
      out.set(u.id, u.username);
      continue;
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      const username = await generateUsername(db, u);
      try {
        // username: null in the filter keeps a handle the user set meanwhile
        const { count } = await db.user.updateMany({ where: { id: u.id, username: null }, data: { username } });
        if (count === 0) {
          const fresh = await db.user.findUnique({ where: { id: u.id }, select: { username: true } });
          if (fresh?.username) out.set(u.id, fresh.username);
        } else {
          out.set(u.id, username);
        }
        break;
      } catch (err) {
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) throw err;
      }
    }
  }
  return out;
}
