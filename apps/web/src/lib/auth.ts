import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Facebook from "next-auth/providers/facebook";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { loginSchema } from "@/lib/validation/auth";
import { env } from "@/lib/env";
import { authConfig } from "@/lib/auth.config";
import { verifyOtp, findOrCreateUserByPhone } from "@/lib/otp";
import { isValidIndianMobile, toE164IndianMobile } from "@/lib/phone";

/**
 * Full, Node-runtime NextAuth instance — providers + every DB-backed
 * callback live here. Imported by API routes, Server Components, and
 * Server Actions ONLY. Middleware must import from `@/lib/auth-edge`
 * instead — see auth.config.ts and DECISIONS.md #25 for why.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  secret: env.NEXTAUTH_SECRET,
  providers: [
    Credentials({
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        // Facebook-only accounts have no local password; block credential
        // login for them instead of throwing on a bcrypt compare against "".
        if (!user.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        if (user.isBanned) {
          throw new Error("ACCOUNT_BANNED");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatarUrl,
          role: user.role,
          isBanned: user.isBanned,
        };
      },
    }),
    // §3.1 WhatsApp OTP login. Verification logic lives in lib/otp.ts
    // (shared with nothing else, so there's exactly one place it can drift
    // from) -- this provider just adapts it into NextAuth's session-issuing
    // machinery, which is why /api/auth/whatsapp-otp/verify calls the
    // server-side `signIn("whatsapp-otp", ...)` rather than reimplementing
    // cookie-signing by hand. See DECISIONS.md #37.
    Credentials({
      id: "whatsapp-otp",
      name: "WhatsApp OTP",
      credentials: {
        phone: { label: "Phone", type: "text" },
        code: { label: "Code", type: "text" },
        referralCode: { label: "Referral code", type: "text" },
      },
      async authorize(raw) {
        const phone = (raw as { phone?: string } | undefined)?.phone;
        const code = (raw as { code?: string } | undefined)?.code;
        const referralCode = (raw as { referralCode?: string } | undefined)?.referralCode;
        if (!phone || !code || !isValidIndianMobile(phone)) return null;

        const phoneE164 = toE164IndianMobile(phone);
        const result = await verifyOtp(phoneE164, code);
        if (!result.ok) {
          throw new Error(result.code);
        }

        const user = await findOrCreateUserByPhone(phoneE164, referralCode);
        if (user.isBanned) throw new Error("ACCOUNT_BANNED");

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatarUrl,
          role: user.role,
          isBanned: user.isBanned,
        };
      },
    }),
    Facebook({
      clientId: env.FACEBOOK_CLIENT_ID,
      clientSecret: env.FACEBOOK_CLIENT_SECRET,
      // Facebook Login must give us name + photo to pre-fill the profile,
      // per §3.7.
      authorization: { params: { scope: "email public_profile" } },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account, profile }) {
      if (account?.provider === "facebook") {
        // Facebook doesn't guarantee an email back for every app config;
        // without it we have no way to match/create our User row (email is
        // the unique key in §5's schema), so we refuse rather than silently
        // creating an unusable account.
        const fbEmail = (profile as { email?: string } | undefined)?.email;
        if (!fbEmail) return "/login?error=FacebookEmailRequired";

        const existing = await prisma.user.findUnique({
          where: { email: fbEmail },
        });

        if (existing) {
          if (existing.isBanned) return "/login?error=AccountBanned";
          // Backfill avatar/name on first Facebook link if we don't have
          // them yet — never clobber a user's own edits.
          const facebookId =
            (profile as { id?: string } | undefined)?.id ?? account.providerAccountId;
          await prisma.$transaction([
            prisma.user.update({
              where: { id: existing.id },
              data: {
                avatarUrl: existing.avatarUrl ?? (user.image ?? undefined),
              },
            }),
            prisma.metaAccountLink.upsert({
              where: { userId: existing.id },
              update: { facebookId },
              create: { userId: existing.id, facebookId },
            }),
          ]);
          user.id = existing.id;
          user.role = existing.role;
          user.isBanned = existing.isBanned;
          return true;
        }

        // New Facebook signup: create the user with a random unusable
        // password hash (credentials login stays disabled for this account
        // until/unless they explicitly set a password from Settings).
        const randomHash = await bcrypt.hash(crypto.randomUUID(), 12);
        const facebookId =
          (profile as { id?: string } | undefined)?.id ?? account.providerAccountId;

        const created = await prisma.$transaction(async (tx) => {
          const newUser = await tx.user.create({
            data: {
              email: fbEmail,
              name: user.name ?? "xivago user",
              avatarUrl: user.image,
              passwordHash: randomHash,
              subscription: { create: {} },
              metaLink: { create: { facebookId } },
            },
          });
          const { applyCreditDelta } = await import("@slotbook/db");
          await applyCreditDelta(tx, {
            userId: newUser.id,
            amount: env.WELCOME_CREDITS,
            type: "GRANT",
            note: "welcome-grant",
          });
          return newUser;
        });

        user.id = created.id;
        user.role = created.role;
        user.isBanned = created.isBanned;
        return true;
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
        token.isBanned = user.isBanned;
      }

      // Keep role/ban status fresh on every Node-runtime request cheaply.
      // This callback only ever runs here, in the full Node config — NEVER
      // in middleware (which uses auth-edge.ts / authConfig with no DB
      // access) — so it's always safe to call Prisma. See DECISIONS.md #25.
      if (token.id) {
        const userId = token.id as string;
        const fresh = await prisma.user.findUnique({
          where: { id: userId },
          select: { role: true, isBanned: true, phone: true, createdAt: true },
        });
        if (fresh) {
          token.role = fresh.role;
          token.isBanned = fresh.isBanned;
          token.phoneVerified = Boolean(fresh.phone);
          token.createdAt = fresh.createdAt.toISOString();
        } else {
          // The account was deleted (Settings → Delete my account): end the
          // session everywhere instead of leaving a token for a missing user.
          return null;
        }
        const sub = await prisma.subscription.findUnique({
          where: { userId },
          select: { status: true },
        });
        token.isPro = sub?.status === "ACTIVE";
      }

      return token;
    },
    // `session()` is identical to authConfig's — reused as-is via the
    // spread above, so it's defined once, not duplicated.
  },
});
