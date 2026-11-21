import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma, type CreditType } from "@/lib/db";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError, apiValidationError } from "@/lib/api-response";

/**
 * GET /api/activity -- "Your activity": a single timeline of everything the
 * signed-in user did, assembled from the tables that already record it
 * (credit ledger, demands, slots, posts, comments, reactions, follows,
 * ratings, community joins). Nothing extra is stored.
 *
 * Pagination: `before` is an ISO timestamp. Each source returns its newest
 * PAGE rows older than `before`; merging and taking PAGE overall is exact,
 * because no source can contribute more than PAGE rows to one page.
 */

const PAGE = 30;

const querySchema = z.object({
  before: z.string().datetime().optional(),
});

type ActivityKind =
  | "credit"
  | "demand"
  | "slot"
  | "post"
  | "comment"
  | "reaction"
  | "follow"
  | "rating"
  | "community";

interface PersonRef {
  id: string;
  name: string | null;
  avatarUrl: string | null;
}

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  title: string;
  detail: string | null;
  amount: number | null; // credits delta, for kind "credit"
  url: string | null;
  createdAt: string;
  person: PersonRef | null;
}

const PERSON = { select: { id: true, name: true, avatarUrl: true } } as const;

function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

function creditLabel(type: CreditType, note: string | null, counterpart: PersonRef | null): string {
  const n = note ?? "";
  switch (type) {
    case "PURCHASE":
      return "Bought credits";
    case "TRANSFER_IN":
      return counterpart ? `Received from ${counterpart.name ?? "a user"}` : "Credits received";
    case "TRANSFER_OUT":
      return counterpart ? `Sent to ${counterpart.name ?? "a user"}` : "Credits sent";
    case "FEATURED_HOLD":
      return "Featured bid placed";
    case "FEATURED_REFUND":
      return "Featured credits back";
    case "PAYMENT_REFUND":
      return n.startsWith("payment-refund-reversed") ? "Withdrawal reversed" : "Withdrawn to bank";
    case "BOOST":
      if (n === "post-demand-fee") return "Posting fee";
      if (n.startsWith("priority-boost")) return "Featured boost";
      if (n.startsWith("slot-purchase")) return "Response spot";
      return "Credits spent";
    case "GRANT":
      if (n === "welcome-grant") return "Welcome bonus";
      if (n.startsWith("referral-reward")) return "Referral reward";
      if (n === "referral-welcome") return "Referral joining bonus";
      if (n.startsWith("spin-win")) return "Spin & Win prize";
      return "Adjusted by xivago";
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
    if (!parsed.success) return apiValidationError(parsed.error);

    const before = parsed.data.before ? new Date(parsed.data.before) : new Date(Date.now() + 1000);
    const me = user.id;
    const recent = { lt: before };
    const page = { take: PAGE, orderBy: { createdAt: "desc" as const } };

    const [credits, demands, bids, posts, comments, reactions, follows, ratings, joins] = await Promise.all([
      prisma.creditTransaction.findMany({
        where: { userId: me, createdAt: recent },
        select: { id: true, amount: true, type: true, note: true, demandId: true, createdAt: true },
        ...page,
      }),
      prisma.demand.findMany({
        where: { authorId: me, createdAt: recent },
        select: { id: true, summary: true, createdAt: true },
        ...page,
      }),
      prisma.bid.findMany({
        where: { bidderId: me, createdAt: recent },
        select: { id: true, slot: true, createdAt: true, demand: { select: { id: true, summary: true, author: PERSON } } },
        ...page,
      }),
      prisma.forumMessage.findMany({
        where: { senderId: me, deletedAt: null, createdAt: recent },
        select: { id: true, text: true, communityId: true, createdAt: true, poll: { select: { id: true } } },
        ...page,
      }),
      prisma.forumComment.findMany({
        where: { senderId: me, deletedAt: null, createdAt: recent },
        select: {
          id: true,
          text: true,
          createdAt: true,
          message: { select: { id: true, communityId: true, sender: PERSON } },
        },
        ...page,
      }),
      prisma.forumReaction.findMany({
        where: { userId: me, createdAt: recent },
        select: { id: true, emoji: true, targetType: true, targetId: true, createdAt: true },
        ...page,
      }),
      prisma.follow.findMany({
        where: { followerId: me, createdAt: recent },
        select: { id: true, createdAt: true, following: PERSON },
        ...page,
      }),
      prisma.rating.findMany({
        where: { raterId: me, createdAt: recent },
        select: {
          id: true,
          createdAt: true,
          responsiveness: true,
          quality: true,
          timeliness: true,
          value: true,
          ratedUser: PERSON,
        },
        ...page,
      }),
      prisma.communityMember.findMany({
        where: { userId: me, joinedAt: recent },
        select: { id: true, joinedAt: true, community: { select: { id: true, name: true } } },
        take: PAGE,
        orderBy: { joinedAt: "desc" },
      }),
    ]);

    // Resolve transfer counterparts ("transfer to <id>" / "transfer from <id>").
    const counterpartIds = new Set<string>();
    for (const c of credits) {
      const m = c.note?.match(/^transfer (?:to|from) (\S+)$/);
      if (m) counterpartIds.add(m[1]!);
    }
    // Resolve reaction targets (polymorphic, no relation).
    const postTargetIds = reactions.filter((r) => r.targetType === "MESSAGE").map((r) => r.targetId);
    const commentTargetIds = reactions.filter((r) => r.targetType === "COMMENT").map((r) => r.targetId);

    const [counterparts, reactedPosts, reactedComments] = await Promise.all([
      counterpartIds.size
        ? prisma.user.findMany({ where: { id: { in: [...counterpartIds] } }, select: PERSON.select })
        : Promise.resolve([]),
      postTargetIds.length
        ? prisma.forumMessage.findMany({
            where: { id: { in: postTargetIds } },
            select: { id: true, text: true, communityId: true, sender: PERSON },
          })
        : Promise.resolve([]),
      commentTargetIds.length
        ? prisma.forumComment.findMany({
            where: { id: { in: commentTargetIds } },
            select: { id: true, text: true, sender: PERSON, message: { select: { communityId: true } } },
          })
        : Promise.resolve([]),
    ]);
    const personById = new Map(counterparts.map((p) => [p.id, p]));
    const postById = new Map(reactedPosts.map((p) => [p.id, p]));
    const commentById = new Map(reactedComments.map((c) => [c.id, c]));

    const feedUrl = (communityId: string | null) => (communityId ? `/communities/${communityId}` : "/forum");
    const items: ActivityItem[] = [];

    for (const c of credits) {
      const m = c.note?.match(/^transfer (?:to|from) (\S+)$/);
      const counterpart = m ? (personById.get(m[1]!) ?? null) : null;
      items.push({
        id: `credit:${c.id}`,
        kind: "credit",
        title: creditLabel(c.type, c.note, counterpart),
        detail: null,
        amount: c.amount,
        url: counterpart ? `/u/${counterpart.id}` : c.demandId ? `/demands/${c.demandId}` : null,
        createdAt: c.createdAt.toISOString(),
        person: counterpart,
      });
    }
    for (const d of demands) {
      items.push({
        id: `demand:${d.id}`,
        kind: "demand",
        title: "You posted a request",
        detail: clip(d.summary, 120),
        amount: null,
        url: `/demands/${d.id}`,
        createdAt: d.createdAt.toISOString(),
        person: null,
      });
    }
    for (const b of bids) {
      items.push({
        id: `slot:${b.id}`,
        kind: "slot",
        title: `You took response spot #${b.slot}${b.demand.author.name ? ` on ${b.demand.author.name}'s request` : ""}`,
        detail: clip(b.demand.summary, 120),
        amount: null,
        url: `/demands/${b.demand.id}`,
        createdAt: b.createdAt.toISOString(),
        person: b.demand.author,
      });
    }
    for (const p of posts) {
      items.push({
        id: `post:${p.id}`,
        kind: "post",
        title: p.poll ? "You created a poll" : p.communityId ? "You posted in a community" : "You shared a post",
        detail: p.text ? clip(p.text, 120) : null,
        amount: null,
        url: feedUrl(p.communityId),
        createdAt: p.createdAt.toISOString(),
        person: null,
      });
    }
    for (const c of comments) {
      const own = c.message.sender.id === me;
      items.push({
        id: `comment:${c.id}`,
        kind: "comment",
        title: own ? "You commented on your post" : `You commented on ${c.message.sender.name ?? "a"}'s post`,
        detail: clip(c.text, 120),
        amount: null,
        url: feedUrl(c.message.communityId),
        createdAt: c.createdAt.toISOString(),
        person: own ? null : c.message.sender,
      });
    }
    for (const r of reactions) {
      const target = r.targetType === "MESSAGE" ? postById.get(r.targetId) : commentById.get(r.targetId);
      if (!target) continue; // target deleted
      const what = r.targetType === "MESSAGE" ? "post" : "comment";
      const own = target.sender.id === me;
      const communityId = "communityId" in target ? target.communityId : target.message.communityId;
      items.push({
        id: `reaction:${r.id}`,
        kind: "reaction",
        title: own ? `You reacted ${r.emoji} to your ${what}` : `You reacted ${r.emoji} to ${target.sender.name ?? "a"}'s ${what}`,
        detail: target.text ? clip(target.text, 100) : null,
        amount: null,
        url: feedUrl(communityId),
        createdAt: r.createdAt.toISOString(),
        person: own ? null : target.sender,
      });
    }
    for (const f of follows) {
      items.push({
        id: `follow:${f.id}`,
        kind: "follow",
        title: `You started following ${f.following.name ?? "a user"}`,
        detail: null,
        amount: null,
        url: `/u/${f.following.id}`,
        createdAt: f.createdAt.toISOString(),
        person: f.following,
      });
    }
    for (const r of ratings) {
      const avg = (r.responsiveness + r.quality + r.timeliness + r.value) / 4;
      items.push({
        id: `rating:${r.id}`,
        kind: "rating",
        title: `You rated ${r.ratedUser.name ?? "a user"} ${avg.toFixed(1)} ★`,
        detail: null,
        amount: null,
        url: `/u/${r.ratedUser.id}`,
        createdAt: r.createdAt.toISOString(),
        person: r.ratedUser,
      });
    }
    for (const j of joins) {
      items.push({
        id: `community:${j.id}`,
        kind: "community",
        title: `You joined ${j.community.name}`,
        detail: null,
        amount: null,
        url: `/communities/${j.community.id}`,
        createdAt: j.joinedAt.toISOString(),
        person: null,
      });
    }

    items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
    const pageItems = items.slice(0, PAGE);
    const hasMore = items.length > PAGE;

    const balance = await prisma.user.findUnique({ where: { id: me }, select: { creditBalance: true } });

    return NextResponse.json({
      items: pageItems,
      nextBefore: hasMore ? pageItems[pageItems.length - 1]!.createdAt : null,
      creditBalance: balance?.creditBalance ?? 0,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("activity GET: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not load your activity.");
  }
}
