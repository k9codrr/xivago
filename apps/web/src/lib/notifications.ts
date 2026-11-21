import "server-only";
import { sendPushToUsers, type PushCategory } from "@slotbook/push";
import { prisma, type Prisma } from "@/lib/db";

/**
 * In-app notifications + push, in one place.
 *
 * Every event writes a `Notification` row (the inbox on /activity) and sends
 * a push to the recipient's devices. The row is always written; the push
 * respects the user's per-category opt-out (MetaAccountLink.notifPrefs).
 *
 * Like the WhatsApp senders, everything here is supplementary: functions
 * swallow their own errors and never throw, so callers fire-and-forget with
 * `void notifyX(...)` after the core action has succeeded.
 *
 * Inside a transaction, use the `record*` variants (they take `tx`) so the
 * row commits atomically with the action, then call
 * `deliverPendingNotifications()` after commit. Anything still undelivered
 * is swept by the WhatsApp-notifications cron.
 *
 * Chat messages are pushed from apps/realtime and not stored here.
 */

type Db = Prisma.TransactionClient | typeof prisma;

export type NotificationType =
  | "new_follower"
  | "slot_purchased"
  | "post_reaction"
  | "comment_reaction"
  | "post_comment"
  | "credits_received"
  | "credits_sent"
  | "credits_purchased"
  | "credits_granted"
  | "credits_deducted"
  | "credits_refunded"
  | "referral_reward"
  | "following_demand"
  | "following_post"
  | "post_mention"
  | "rating_received"
  | "refund_requested";

const CATEGORY: Record<NotificationType, PushCategory> = {
  new_follower: "follows",
  slot_purchased: "slots",
  post_reaction: "social",
  comment_reaction: "social",
  post_comment: "social",
  rating_received: "social",
  credits_received: "credits",
  credits_sent: "credits",
  credits_purchased: "credits",
  credits_granted: "credits",
  credits_deducted: "credits",
  credits_refunded: "credits",
  referral_reward: "credits",
  following_demand: "following",
  following_post: "following",
  post_mention: "social",
  refund_requested: "credits",
};

const CREDITS_URL = "/activity?tab=you";
const REFUNDS_URL = "/credits/refunds";

interface NotificationInput {
  userId: string;
  actorId?: string | null;
  type: NotificationType;
  title: string;
  body: string;
  url?: string;
  entityId?: string;
  data?: Record<string, string | number | boolean | null>;
  /**
   * If a notification with the same (recipient, actor, type, entity) exists
   * within this window, refresh it instead of adding another -- e.g. someone
   * changing their reaction emoji doesn't stack up rows or re-buzz the phone.
   */
  collapseWithinMs?: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

export function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

async function nameOf(db: Db, userId: string): Promise<string> {
  const u = await db.user.findUnique({ where: { id: userId }, select: { name: true } });
  return u?.name?.trim() || "Someone";
}

function credits(n: number): string {
  const abs = Math.abs(n);
  return `${abs.toLocaleString("en-IN")} credit${abs === 1 ? "" : "s"}`;
}

function postUrl(post: { id: string; communityId: string | null }): string {
  return post.communityId ? `/communities/${post.communityId}` : "/forum";
}

/** Opens the post page scrolled to one comment, which flashes briefly. */
export function commentUrl(postId: string, commentId?: string | null): string {
  return commentId ? `/forum/${postId}?comment=${encodeURIComponent(commentId)}` : `/forum/${postId}`;
}

// ── Core ────────────────────────────────────────────────────────────────────

/**
 * Write a notification row. Returns the id if a push should go out (new
 * row), or null (self-notification, or collapsed into an existing row).
 */
export async function recordNotification(db: Db, input: NotificationInput): Promise<string | null> {
  if (input.actorId && input.actorId === input.userId) return null;

  if (input.collapseWithinMs && input.entityId) {
    const existing = await db.notification.findFirst({
      where: {
        userId: input.userId,
        actorId: input.actorId ?? null,
        type: input.type,
        entityId: input.entityId,
        createdAt: { gte: new Date(Date.now() - input.collapseWithinMs) },
      },
      select: { id: true },
    });
    if (existing) {
      await db.notification.update({
        where: { id: existing.id },
        data: { title: input.title, body: input.body, url: input.url ?? null, data: input.data ?? undefined },
      });
      return null;
    }
  }

  const row = await db.notification.create({
    data: {
      userId: input.userId,
      actorId: input.actorId ?? null,
      type: input.type,
      title: input.title,
      body: input.body,
      url: input.url ?? null,
      entityId: input.entityId ?? null,
      data: input.data ?? undefined,
    },
    select: { id: true },
  });
  return row.id;
}

/** Push one stored notification, at most once (claims it via pushedAt first). */
async function deliverNotification(id: string): Promise<void> {
  const claimed = await prisma.notification.updateMany({
    where: { id, pushedAt: null },
    data: { pushedAt: new Date() },
  });
  if (claimed.count === 0) return;

  const n = await prisma.notification.findUnique({
    where: { id },
    select: { userId: true, type: true, title: true, body: true, url: true, entityId: true },
  });
  if (!n) return;

  const type = n.type as NotificationType;
  await sendPushToUsers(n.userId, {
    title: n.title,
    body: n.body,
    url: n.url ?? "/activity",
    tag: n.entityId ? `${type}-${n.entityId}` : `${type}-${id}`,
    category: CATEGORY[type],
    data: { type, notificationId: id },
  });
}

/** Write + push. Never throws. */
export async function notify(input: NotificationInput): Promise<void> {
  try {
    const id = await recordNotification(prisma, input);
    if (id) await deliverNotification(id);
  } catch (err) {
    console.error("notify: failed (non-fatal)", { type: input.type, userId: input.userId, err });
  }
}

/**
 * Same notification to many recipients (fan-out to followers). One row each,
 * one multicast push. Never throws.
 */
async function notifyMany(userIds: string[], input: Omit<NotificationInput, "userId" | "collapseWithinMs">) {
  const ids = [...new Set(userIds)].filter((id) => id && id !== input.actorId);
  if (ids.length === 0) return;
  try {
    const now = new Date();
    await prisma.notification.createMany({
      data: ids.map((userId) => ({
        userId,
        actorId: input.actorId ?? null,
        type: input.type,
        title: input.title,
        body: input.body,
        url: input.url ?? null,
        entityId: input.entityId ?? null,
        data: input.data ?? undefined,
        pushedAt: now,
      })),
    });
    await sendPushToUsers(ids, {
      title: input.title,
      body: input.body,
      url: input.url ?? "/activity",
      tag: input.entityId ? `${input.type}-${input.entityId}` : undefined,
      category: CATEGORY[input.type],
      data: { type: input.type },
    });
  } catch (err) {
    console.error("notifyMany: failed (non-fatal)", { type: input.type, count: ids.length, err });
  }
}

/** Push anything written inside a transaction (or missed). Safe to call often. */
export async function deliverPendingNotifications(): Promise<{ delivered: number }> {
  try {
    const pending = await prisma.notification.findMany({
      where: { pushedAt: null, createdAt: { gte: new Date(Date.now() - 6 * 60 * 60 * 1000) } },
      select: { id: true },
      orderBy: { createdAt: "asc" },
      take: 200,
    });
    for (const { id } of pending) await deliverNotification(id);
    return { delivered: pending.length };
  } catch (err) {
    console.error("deliverPendingNotifications: failed (non-fatal)", err);
    return { delivered: 0 };
  }
}

// ── Social ──────────────────────────────────────────────────────────────────

export async function notifyNewFollower(followerId: string, followingId: string): Promise<void> {
  const name = await nameOf(prisma, followerId).catch(() => "Someone");
  await notify({
    userId: followingId,
    actorId: followerId,
    type: "new_follower",
    title: "New follower",
    body: `${name} started following you`,
    url: `/u/${followerId}`,
    entityId: followerId,
    collapseWithinMs: 24 * 60 * 60 * 1000, // unfollow/refollow spam → one row
  });
}

export async function notifyPostReaction(postId: string, reactorId: string, emoji: string): Promise<void> {
  try {
    const post = await prisma.forumMessage.findUnique({
      where: { id: postId },
      select: { id: true, senderId: true, text: true, communityId: true },
    });
    if (!post) return;
    const name = await nameOf(prisma, reactorId);
    await notify({
      userId: post.senderId,
      actorId: reactorId,
      type: "post_reaction",
      title: `${name} reacted ${emoji}`,
      body: post.text ? `to your post: "${clip(post.text, 80)}"` : "to your post",
      url: postUrl(post),
      entityId: post.id,
      data: { emoji },
      collapseWithinMs: 24 * 60 * 60 * 1000,
    });
  } catch (err) {
    console.error("notifyPostReaction: failed (non-fatal)", err);
  }
}

export async function notifyCommentReaction(commentId: string, reactorId: string, emoji: string): Promise<void> {
  try {
    const comment = await prisma.forumComment.findUnique({
      where: { id: commentId },
      select: { id: true, senderId: true, text: true, message: { select: { id: true, communityId: true } } },
    });
    if (!comment) return;
    const name = await nameOf(prisma, reactorId);
    await notify({
      userId: comment.senderId,
      actorId: reactorId,
      type: "comment_reaction",
      title: `${name} reacted ${emoji}`,
      body: `to your comment: "${clip(comment.text, 80)}"`,
      url: commentUrl(comment.message.id, comment.id),
      entityId: comment.id,
      data: { emoji, postId: comment.message.id },
      collapseWithinMs: 24 * 60 * 60 * 1000,
    });
  } catch (err) {
    console.error("notifyCommentReaction: failed (non-fatal)", err);
  }
}

/** Notify the post author about a new comment. */
export async function notifyPostComment(postId: string, commenterId: string, text: string, commentId: string): Promise<void> {
  try {
    const post = await prisma.forumMessage.findUnique({
      where: { id: postId },
      select: { id: true, senderId: true, communityId: true },
    });
    if (!post) return;
    const name = await nameOf(prisma, commenterId);
    await notify({
      userId: post.senderId,
      actorId: commenterId,
      type: "post_comment",
      title: `${name} commented on your post`,
      body: clip(text, 120),
      url: commentUrl(post.id, commentId),
      entityId: post.id,
      data: { postId: post.id, commentId },
    });
  } catch (err) {
    console.error("notifyPostComment: failed (non-fatal)", err);
  }
}

export async function notifyRatingReceived(raterId: string, ratedUserId: string, average: number): Promise<void> {
  const name = await nameOf(prisma, raterId).catch(() => "Someone");
  await notify({
    userId: ratedUserId,
    actorId: raterId,
    type: "rating_received",
    title: "You got a new rating",
    body: `${name} rated you ${average.toFixed(1)} ★`,
    url: "/profile",
  });
}

// ── People you follow ───────────────────────────────────────────────────────

async function followerIdsOf(userId: string): Promise<string[]> {
  const rows = await prisma.follow.findMany({
    where: { followingId: userId, follower: { isBanned: false } },
    select: { followerId: true },
  });
  return rows.map((r) => r.followerId);
}

/** Someone you follow posted a demand. */
export async function notifyFollowersOfDemand(demandId: string): Promise<void> {
  try {
    const demand = await prisma.demand.findUnique({
      where: { id: demandId },
      select: { id: true, authorId: true, summary: true },
    });
    if (!demand) return;
    const [name, followers] = await Promise.all([nameOf(prisma, demand.authorId), followerIdsOf(demand.authorId)]);
    await notifyMany(followers, {
      actorId: demand.authorId,
      type: "following_demand",
      title: `${name} posted a new request`,
      body: clip(demand.summary, 120),
      url: `/demands/${demand.id}`,
      entityId: demand.id,
    });
  } catch (err) {
    console.error("notifyFollowersOfDemand: failed (non-fatal)", err);
  }
}

/** Someone you follow posted on the feed. */
export async function notifyFollowersOfPost(postId: string): Promise<void> {
  try {
    const post = await prisma.forumMessage.findUnique({
      where: { id: postId },
      select: { id: true, senderId: true, text: true, communityId: true, poll: { select: { id: true } } },
    });
    if (!post) return;
    const [name, followers] = await Promise.all([nameOf(prisma, post.senderId), followerIdsOf(post.senderId)]);
    await notifyMany(followers, {
      actorId: post.senderId,
      type: "following_post",
      title: `${name} shared a new ${post.poll ? "poll" : "post"}`,
      body: post.text ? clip(post.text, 120) : "Tap to see it",
      url: postUrl(post),
      entityId: post.id,
    });
  } catch (err) {
    console.error("notifyFollowersOfPost: failed (non-fatal)", err);
  }
}

/** Pulls the "@handle" tokens out of post text (lowercased, deduped). */
export function extractMentionHandles(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/(?:^|\s)@([a-z0-9_-]{3,40})/gi)) out.add(m[1]!.toLowerCase());
  return [...out].slice(0, 20); // cap so a spammy post can't ping hundreds of people
}

/** People "@username"-mentioned in a post hear about it. */
export async function notifyMentionedInPost(postId: string): Promise<void> {
  try {
    const post = await prisma.forumMessage.findUnique({
      where: { id: postId },
      select: { id: true, senderId: true, text: true, communityId: true },
    });
    if (!post?.text) return;
    const handles = extractMentionHandles(post.text);
    if (handles.length === 0) return;
    const users = await prisma.user.findMany({
      where: { username: { in: handles }, isBanned: false },
      select: { id: true },
    });
    if (users.length === 0) return;
    const name = await nameOf(prisma, post.senderId);
    await notifyMany(
      users.map((u) => u.id),
      {
        actorId: post.senderId,
        type: "post_mention",
        title: `${name} mentioned you in a post`,
        body: clip(post.text, 120),
        url: `/forum/${post.id}`,
        entityId: post.id,
      },
    );
  } catch (err) {
    console.error("notifyMentionedInPost: failed (non-fatal)", err);
  }
}

// ── Slots ───────────────────────────────────────────────────────────────────

/** A vendor took a slot on a demand -- tell the demand's author. */
export async function notifySlotPurchasedToAuthor(bidId: string): Promise<void> {
  try {
    const bid = await prisma.bid.findUnique({
      where: { id: bidId },
      select: {
        slot: true,
        bidder: { select: { id: true, name: true } },
        demand: { select: { id: true, summary: true, authorId: true } },
      },
    });
    if (!bid) return;

    const conversation = await prisma.conversation.findUnique({
      where: {
        demandId_buyerId_bidderId: {
          demandId: bid.demand.id,
          buyerId: bid.demand.authorId,
          bidderId: bid.bidder.id,
        },
      },
      select: { id: true },
    });

    await notify({
      userId: bid.demand.authorId,
      actorId: bid.bidder.id,
      type: "slot_purchased",
      title: "New response on your request",
      body: `${bid.bidder.name ?? "A provider"} took response spot #${bid.slot} on "${clip(bid.demand.summary, 60)}"`,
      url: conversation ? `/chats/${conversation.id}` : `/demands/${bid.demand.id}`,
      entityId: bidId,
      data: { demandId: bid.demand.id },
    });
  } catch (err) {
    console.error("notifySlotPurchasedToAuthor: failed (non-fatal)", { bidId, err });
  }
}

// ── Credits ─────────────────────────────────────────────────────────────────

/** P2P transfer: tells the recipient they received, and the sender they sent. */
export async function notifyCreditTransfer(senderId: string, recipientId: string, amount: number, transferId: string) {
  const [senderName, recipientName] = await Promise.all([
    nameOf(prisma, senderId).catch(() => "Someone"),
    nameOf(prisma, recipientId).catch(() => "someone"),
  ]);
  await Promise.all([
    notify({
      userId: recipientId,
      actorId: senderId,
      type: "credits_received",
      title: `+${credits(amount)} received`,
      body: `${senderName} sent you ${credits(amount)}`,
      url: CREDITS_URL,
      entityId: transferId,
      data: { amount },
    }),
    // Confirmation to the sender (actor is the recipient so it isn't a self-notification).
    notify({
      userId: senderId,
      actorId: recipientId,
      type: "credits_sent",
      title: `${credits(amount)} sent`,
      body: `You sent ${credits(amount)} to ${recipientName}`,
      url: CREDITS_URL,
      entityId: transferId,
      data: { amount },
    }),
  ]);
}

/** An admin refunded a top-up: money back to the bank, unspent credits taken back. */
export async function notifyPaymentRefunded(
  userId: string,
  paymentId: string,
  netPaise: number,
  creditsTaken: number,
  instant = false,
) {
  const rupees = `₹${(netPaise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  const when = instant ? "should reach your bank within minutes" : "reaches your bank in 5–7 working days";
  await notify({
    userId,
    type: "credits_deducted",
    title: `Withdrawal on its way · ${rupees}`,
    body:
      creditsTaken > 0
        ? `You withdrew ${credits(creditsTaken)}. ${rupees} (after fees and GST) ${when}.`
        : `${rupees} (after fees and GST) ${when}.`,
    url: REFUNDS_URL,
    entityId: paymentId,
    data: { netPaise, creditsTaken },
  });
}

/** Every admin hears about a new refund request (in-app + push). */
export async function notifyAdminsRefundRequested(requestId: string, userId: string, amountPaise: number, reason: string) {
  try {
    const [name, admins] = await Promise.all([
      nameOf(prisma, userId),
      prisma.user.findMany({ where: { role: "ADMIN", isBanned: false }, select: { id: true } }),
    ]);
    const rupees = `₹${(amountPaise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
    await notifyMany(
      admins.map((a) => a.id),
      {
        actorId: userId,
        type: "refund_requested",
        title: `Withdrawal request · ${rupees}`,
        body: `${name}: "${clip(reason, 100)}"`,
        url: "/admin/payments",
        entityId: requestId,
      },
    );
  } catch (err) {
    console.error("notifyAdminsRefundRequested: failed (non-fatal)", err);
  }
}

export async function notifyRefundRequestRejected(userId: string, paymentId: string, note: string) {
  await notify({
    userId,
    type: "credits_deducted",
    title: "Withdrawal request declined",
    body: clip(note, 140),
    url: REFUNDS_URL,
    entityId: `refund-request-${paymentId}`,
  });
}

export async function notifyCreditsPurchased(userId: string, amount: number, balance: number, paymentId: string) {
  await notify({
    userId,
    type: "credits_purchased",
    title: `+${credits(amount)} added`,
    body: `Your top-up was successful. New balance: ${credits(balance)}`,
    url: CREDITS_URL,
    entityId: paymentId,
    data: { amount, balance },
    collapseWithinMs: 7 * 24 * 60 * 60 * 1000, // verify + webhook both firing → one row
  });
}

export async function notifyAdminCreditAdjustment(userId: string, amount: number, balance: number) {
  const added = amount > 0;
  await notify({
    userId,
    type: added ? "credits_granted" : "credits_deducted",
    title: added ? `+${credits(amount)} added` : `${credits(amount)} deducted`,
    body: `${added ? "xivago added" : "xivago deducted"} ${credits(amount)}. New balance: ${credits(balance)}`,
    url: CREDITS_URL,
    data: { amount, balance },
  });
}

/** Inside the referral transaction. Push goes out on deliverPendingNotifications(). */
export async function recordReferralReward(tx: Db, referrerId: string, newUserId: string, amount: number) {
  const name = await nameOf(tx, newUserId);
  await recordNotification(tx, {
    userId: referrerId,
    actorId: newUserId,
    type: "referral_reward",
    title: `+${credits(amount)} referral reward`,
    body: `${name} joined xivago with your invite`,
    url: CREDITS_URL,
    entityId: newUserId,
    data: { amount },
  });
}

/** Inside the featured-refund transaction. Push goes out on deliverPendingNotifications(). */
export async function recordFeaturedRefund(tx: Db, userId: string, amount: number, bidId: string, reason: string) {
  const why =
    reason === "lost"
      ? "Your featured bid didn't win"
      : reason === "won-difference"
        ? "You got featured for less than you offered"
        : reason === "withdrawn"
          ? "You stopped featuring your post"
          : reason === "feature-disabled"
            ? "Featured placements were paused"
            : "Your featured placement ended early";
  await recordNotification(tx, {
    userId,
    type: "credits_refunded",
    title: `+${credits(amount)} back in your wallet`,
    body: `${why}, so ${credits(amount)} came back to your wallet.`,
    url: CREDITS_URL,
    entityId: `${bidId}:${reason}`,
    data: { amount },
  });
}
