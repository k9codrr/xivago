import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getMessaging, type MulticastMessage } from "firebase-admin/messaging";
import webpush from "web-push";
import { prisma } from "@slotbook/db";

/**
 * Push notification sender, shared by apps/web and apps/realtime.
 *
 * - ios / android tokens → Firebase Cloud Messaging (FCM relays to APNs on iOS).
 * - web tokens           → standard Web Push (VAPID), stored as subscription JSON.
 *
 * Like the WhatsApp notifications, push is supplementary: every function
 * here swallows its own errors and never throws to the caller. If the
 * relevant env vars are missing, that channel silently no-ops.
 *
 * Env:
 *   FIREBASE_SERVICE_ACCOUNT       service-account JSON (raw or base64)
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY   Web Push public key (also used by the client)
 *   VAPID_PRIVATE_KEY              Web Push private key
 *   VAPID_SUBJECT                  "mailto:..." or https URL identifying the sender
 */

export type PushPlatform = "ios" | "android" | "web";

/** Matches the opt-out keys stored in MetaAccountLink.notifPrefs. */
export type PushCategory =
  | "chatMessages" // new chat message
  | "slots" // a vendor took a slot on your demand
  | "follows" // new follower
  | "credits" // credits received / sent / purchased / granted / refunded
  | "social" // likes & comments on your posts, ratings
  | "following"; // someone you follow posted a demand or a post

export interface PushPayload {
  title: string;
  body: string;
  /** In-app path to open when the notification is tapped, e.g. "/chats/abc". */
  url?: string;
  /**
   * Groups/replaces related notifications (one per conversation, etc.).
   * Android `tag`, iOS `thread-id`, Web Push `tag`.
   */
  tag?: string;
  /** iOS: break through Focus / show prominently. Needs the Time Sensitive capability. */
  timeSensitive?: boolean;
  /** Opt-out preference this notification belongs to. */
  category?: PushCategory;
  /** Extra string data delivered to the app. */
  data?: Record<string, string>;
}

/** Android notification channel id — the app creates it with high importance. */
export const ANDROID_CHANNEL_ID = "xivago_default";

const INVALID_FCM_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);

// ── Firebase ────────────────────────────────────────────────────────────────

let firebaseApp: App | null | undefined;

function getFirebase(): App | null {
  if (firebaseApp !== undefined) return firebaseApp;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (!raw) return (firebaseApp = null);

  try {
    const json = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    const account = JSON.parse(json) as { project_id: string; client_email: string; private_key: string };
    firebaseApp =
      getApps().find((a) => a.name === "slotbook-push") ??
      initializeApp(
        {
          credential: cert({
            projectId: account.project_id,
            clientEmail: account.client_email,
            privateKey: account.private_key.replace(/\\n/g, "\n"),
          }),
        },
        "slotbook-push",
      );
  } catch (err) {
    console.error("push: FIREBASE_SERVICE_ACCOUNT is invalid — native push disabled", err);
    firebaseApp = null;
  }
  return firebaseApp;
}

// ── Web Push ────────────────────────────────────────────────────────────────

let webPushReady: boolean | undefined;

function ensureWebPush(): boolean {
  if (webPushReady !== undefined) return webPushReady;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || process.env.NEXT_PUBLIC_APP_URL;
  if (!publicKey || !privateKey || !subject) return (webPushReady = false);
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    webPushReady = true;
  } catch (err) {
    console.error("push: invalid VAPID config — web push disabled", err);
    webPushReady = false;
  }
  return webPushReady;
}

export function isPushConfigured(): boolean {
  return Boolean(getFirebase()) || ensureWebPush();
}

// ── Sending ─────────────────────────────────────────────────────────────────

function isOptedOut(notifPrefs: unknown, category: PushCategory | undefined): boolean {
  if (!category) return false;
  const prefs = (notifPrefs ?? {}) as Record<string, unknown>;
  return prefs[category] === false; // opt-out model: absent = enabled
}

async function sendFcm(tokens: string[], payload: PushPayload): Promise<string[]> {
  const app = getFirebase();
  if (!app || tokens.length === 0) return [];

  const data: Record<string, string> = { ...(payload.data ?? {}) };
  if (payload.url) data.url = payload.url;

  const message: MulticastMessage = {
    tokens,
    notification: { title: payload.title, body: payload.body },
    data,
    android: {
      priority: "high",
      notification: {
        channelId: ANDROID_CHANNEL_ID,
        sound: "default",
        visibility: "public",
        defaultVibrateTimings: true,
        ...(payload.tag ? { tag: payload.tag } : {}),
      },
    },
    apns: {
      headers: { "apns-priority": "10", "apns-push-type": "alert" },
      payload: {
        aps: {
          sound: "default",
          ...(payload.tag ? { threadId: payload.tag } : {}),
          ...(payload.timeSensitive ? { "interruption-level": "time-sensitive" } : {}),
        },
      },
    },
  };

  const invalid: string[] = [];
  // FCM caps multicast at 500 tokens per call.
  for (let i = 0; i < tokens.length; i += 500) {
    const chunk = tokens.slice(i, i + 500);
    const res = await getMessaging(app).sendEachForMulticast({ ...message, tokens: chunk });
    res.responses.forEach((r, idx) => {
      if (!r.success && r.error && INVALID_FCM_CODES.has(r.error.code)) invalid.push(chunk[idx]!);
    });
  }
  return invalid;
}

async function sendWeb(tokens: string[], payload: PushPayload): Promise<string[]> {
  if (!ensureWebPush() || tokens.length === 0) return [];

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/",
    tag: payload.tag,
  });

  const invalid: string[] = [];
  await Promise.all(
    tokens.map(async (token) => {
      try {
        const subscription = JSON.parse(token) as webpush.PushSubscription;
        await webpush.sendNotification(subscription, body, { TTL: 60 * 60 * 24, urgency: "high" });
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410 || err instanceof SyntaxError) invalid.push(token);
      }
    }),
  );
  return invalid;
}

/**
 * Send a push notification to every registered device of the given users.
 * Respects the per-user opt-out for `payload.category`, and prunes tokens
 * the push services report as dead. Never throws.
 */
export async function sendPushToUsers(userIds: string | string[], payload: PushPayload): Promise<void> {
  const ids = [...new Set(Array.isArray(userIds) ? userIds : [userIds])].filter(Boolean);
  if (ids.length === 0 || !isPushConfigured()) return;

  try {
    const devices = await prisma.deviceToken.findMany({
      where: {
        userId: { in: ids },
        user: { isBanned: false },
      },
      select: {
        token: true,
        platform: true,
        user: { select: { metaLink: { select: { notifPrefs: true } } } },
      },
    });

    const eligible = devices.filter((d) => !isOptedOut(d.user.metaLink?.notifPrefs, payload.category));
    const native = eligible.filter((d) => d.platform !== "web").map((d) => d.token);
    const web = eligible.filter((d) => d.platform === "web").map((d) => d.token);

    const [deadNative, deadWeb] = await Promise.all([
      sendFcm(native, payload).catch((err) => {
        console.error("push: FCM send failed (non-fatal)", err);
        return [] as string[];
      }),
      sendWeb(web, payload),
    ]);

    const dead = [...deadNative, ...deadWeb];
    if (dead.length > 0) {
      await prisma.deviceToken.deleteMany({ where: { token: { in: dead } } });
    }
  } catch (err) {
    console.error("push: sendPushToUsers failed (non-fatal)", err);
  }
}
