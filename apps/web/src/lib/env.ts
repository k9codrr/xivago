import { z } from "zod";

/**
 * Central env schema. Import `env` instead of touching `process.env`
 * directly anywhere else in the app — this is the single point that
 * validates shape/presence and gives readable boot-time errors instead of
 * `undefined` surfacing three layers deep in a Razorpay signature check.
 *
 * NOTE: this file is imported by both server code and a few client
 * components that need `NEXT_PUBLIC_*` values; keep server-only secrets out
 * of anything imported from a "use client" file (Next.js will error if you
 * try, but be deliberate).
 */
const serverEnvSchema = z.object({
  DATABASE_URL: z.string().url(),

  NEXTAUTH_SECRET: z.string().min(16),
  NEXTAUTH_URL: z.string().url(),

  FACEBOOK_CLIENT_ID: z.string().optional().default(""),
  FACEBOOK_CLIENT_SECRET: z.string().optional().default(""),

  R2_ACCOUNT_ID: z.string().optional().default(""),
  R2_ACCESS_KEY_ID: z.string().optional().default(""),
  R2_SECRET_ACCESS_KEY: z.string().optional().default(""),
  R2_BUCKET: z.string().optional().default(""),
  R2_PUBLIC_URL: z.string().optional().default(""),

  WHATSAPP_TOKEN: z.string().optional().default(""),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional().default(""),
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().optional().default(""),
  WHATSAPP_APP_SECRET: z.string().optional().default(""),
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.string().optional().default(""),
  WHATSAPP_API_VERSION: z.string().default("v21.0"),

  RAZORPAY_KEY_ID: z.string().optional().default(""),
  RAZORPAY_KEY_SECRET: z.string().optional().default(""),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional().default(""),
  RAZORPAY_PRO_PLAN_ID: z.string().optional().default(""),
  // Razorpay's instant-refund fee per refund, in paise, before GST (from your
  // Razorpay pricing). Unset = the "Instant refund" option stays off.
  RAZORPAY_INSTANT_REFUND_FEE_PAISE: z.coerce.number().int().min(0).optional(),

  SLOT_PRICE_PAISE: z.coerce.number().int().positive().default(9900),
  PRO_PLAN_PRICE_PAISE: z.coerce.number().int().positive().default(49900),
  CREDIT_BOOST_COST: z.coerce.number().int().positive().default(50),
  WELCOME_CREDITS: z.coerce.number().int().nonnegative().default(30),
  // Refer & earn: credited to the inviter, and to the new user on top of WELCOME_CREDITS
  REFERRAL_REWARD_CREDITS: z.coerce.number().int().nonnegative().default(300),
  REFERRAL_WELCOME_CREDITS: z.coerce.number().int().nonnegative().default(100),

  // Master switch for featured hero bidding. The feature is live only when
  // this is "true" AND the admin toggle (FeaturedSettings.enabled) is on.
  FEATURED_BIDDING_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),

  CRON_SECRET: z.string().optional().default(""),

  SOCKET_JWT_SECRET: z.string().min(16).optional().default(""),

  MODERATION_API_URL: z.string().optional().default("https://api.sightengine.com/1.0/check.json"),
  MODERATION_API_USER: z.string().optional().default(""),
  MODERATION_API_KEY: z.string().optional().default(""),

  // Push notifications (packages/push reads these from process.env; listed
  // here so they're documented and validated). Each channel no-ops when unset.
  // Service-account JSON, raw or base64 -- iOS/Android via FCM.
  // Transactional email via Resend (lib/email.ts). Email features stay off while the key is empty.
  RESEND_API_KEY: z.string().optional().default(""),
  EMAIL_FROM: z.string().optional().default("xivago <onboarding@resend.dev>"),
  FIREBASE_SERVICE_ACCOUNT: z.string().optional().default(""),
  // Web Push. Generate a key pair with `npx web-push generate-vapid-keys`.
  VAPID_PRIVATE_KEY: z.string().optional().default(""),
  VAPID_SUBJECT: z.string().optional().default(""),

  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_RAZORPAY_KEY_ID: z.string().optional().default(""),
  NEXT_PUBLIC_SOCKET_URL: z.string().optional().default(""),
  NEXT_PUBLIC_SLOT_PRICE_PAISE: z.coerce.number().int().positive().default(9900),
  NEXT_PUBLIC_CREDIT_BOOST_COST: z.coerce.number().int().positive().default(50),
  NEXT_PUBLIC_PRO_PLAN_PRICE_PAISE: z.coerce.number().int().positive().default(49900),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().optional().default(""),
  // Shown in "Help & Support" on post pages. Each channel is hidden when unset.
  NEXT_PUBLIC_SUPPORT_EMAIL: z.string().optional().default(""),
  // Digits with country code, no "+" (e.g. 919876543210).
  NEXT_PUBLIC_SUPPORT_WHATSAPP: z.string().optional().default(""),
});

function loadServerEnv() {
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const summary = Object.entries(fieldErrors)
      .map(([key, messages]) => `  - ${key}: ${(messages ?? []).join("; ")}`)
      .join("\n");
    console.error("❌ Invalid/missing environment variables:\n", fieldErrors);
    throw new Error(
      `Invalid environment variables. Copy .env.example to .env and fill these in:\n${summary}`,
    );
  }
  return parsed.data;
}

function loadPublicEnv() {
  const parsed = publicEnvSchema.safeParse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_RAZORPAY_KEY_ID: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    NEXT_PUBLIC_SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL,
    NEXT_PUBLIC_SLOT_PRICE_PAISE: process.env.NEXT_PUBLIC_SLOT_PRICE_PAISE,
    NEXT_PUBLIC_CREDIT_BOOST_COST: process.env.NEXT_PUBLIC_CREDIT_BOOST_COST,
    NEXT_PUBLIC_PRO_PLAN_PRICE_PAISE: process.env.NEXT_PUBLIC_PRO_PLAN_PRICE_PAISE,
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    NEXT_PUBLIC_SUPPORT_EMAIL: process.env.NEXT_PUBLIC_SUPPORT_EMAIL,
    NEXT_PUBLIC_SUPPORT_WHATSAPP: process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP,
  });
  if (!parsed.success) {
    console.error(
      "❌ Invalid/missing public environment variables:\n",
      parsed.error.flatten().fieldErrors,
    );
    throw new Error("Invalid public environment variables — see log above.");
  }
  return parsed.data;
}

// `typeof window === "undefined"` guards server-only parsing so this module
// can still be imported (for the public subset) from client components.
export const env = typeof window === "undefined" ? loadServerEnv() : ({} as ReturnType<typeof loadServerEnv>);
export const publicEnv = loadPublicEnv();
