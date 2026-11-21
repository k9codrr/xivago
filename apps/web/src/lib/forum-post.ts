import { prisma } from "@/lib/db";
import {
  getReactionSummaries,
  getCommentCounts,
  getViewerPollVotes,
  getPostEngagement,
  isAttachmentVisible,
  EMPTY_ENGAGEMENT,
  type PostEngagement,
} from "@/lib/forum";
import type { ForumPost } from "@/components/forum/types";

/** The fields every forum post response is shaped from. */
export const FORUM_POST_SELECT = {
  id: true,
  text: true,
  createdAt: true,
  senderId: true,
  lat: true,
  lng: true,
  community: { select: { id: true, name: true, slug: true } },
  sender: { select: { id: true, name: true, avatarUrl: true, companyName: true, role: true } },
  attachments: {
    select: { id: true, url: true, contentType: true, status: true },
    // cuids sort by creation, and unlike createdAt can't tie within one post's insert.
    orderBy: { id: "asc" },
  },
  poll: {
    select: {
      id: true,
      closesAt: true,
      options: { select: { id: true, text: true, _count: { select: { votes: true } } } },
    },
  },
} as const;

export type RawForumPost = Awaited<
  ReturnType<typeof prisma.forumMessage.findMany<{ select: typeof FORUM_POST_SELECT }>>
>[number];

export function shapeForumPost(
  post: RawForumPost,
  viewerId: string | null,
  reactions: Map<string, { counts: Record<string, number>; total: number; myReaction: string | null }>,
  commentCounts: Map<string, number>,
  pollVotes: Map<string, string>,
  engagement: Map<string, PostEngagement> = new Map(),
): ForumPost {
  const isOwner = viewerId === post.senderId;
  return {
    id: post.id,
    text: post.text,
    createdAt: post.createdAt.toISOString(),
    senderId: post.senderId,
    sender: post.sender,
    // Moderated per item: one pending video must not hide the post's approved images.
    attachments: post.attachments.filter((a) => isAttachmentVisible(a.status, isOwner)),
    reactions: reactions.get(post.id) ?? { counts: {}, total: 0, myReaction: null },
    commentCount: commentCounts.get(post.id) ?? 0,
    ...(engagement.get(post.id) ?? EMPTY_ENGAGEMENT),
    isMine: isOwner,
    location: post.lat != null && post.lng != null ? { lat: post.lat, lng: post.lng } : null,
    poll: post.poll
      ? {
          id: post.poll.id,
          closesAt: post.poll.closesAt?.toISOString() ?? null,
          totalVotes: post.poll.options.reduce((sum, o) => sum + o._count.votes, 0),
          options: post.poll.options.map((o) => ({ id: o.id, text: o.text, voteCount: o._count.votes })),
          myVoteOptionId: pollVotes.get(post.poll.id) ?? null,
        }
      : null,
    community: post.community,
  };
}

/** Several posts shaped for the viewer, with every count loaded in a few batched queries. */
export async function shapeForumPosts(posts: RawForumPost[], viewerId: string | null): Promise<ForumPost[]> {
  const ids = posts.map((p) => p.id);
  const pollIds = posts.flatMap((p) => (p.poll ? [p.poll.id] : []));
  const [reactions, commentCounts, pollVotes, engagement] = await Promise.all([
    getReactionSummaries("MESSAGE", ids, viewerId),
    getCommentCounts(ids),
    getViewerPollVotes(pollIds, viewerId),
    getPostEngagement(ids, viewerId),
  ]);
  return posts.map((p) => shapeForumPost(p, viewerId, reactions, commentCounts, pollVotes, engagement));
}

/** One post as the viewer may see it, or null if it doesn't exist or was deleted. */
export async function getForumPost(id: string, viewerId: string | null): Promise<ForumPost | null> {
  const post = await prisma.forumMessage.findFirst({
    where: { id, deletedAt: null },
    select: FORUM_POST_SELECT,
  });
  if (!post) return null;

  const [reactions, commentCounts, pollVotes, engagement] = await Promise.all([
    getReactionSummaries("MESSAGE", [id], viewerId),
    getCommentCounts([id]),
    getViewerPollVotes(post.poll ? [post.poll.id] : [], viewerId),
    getPostEngagement([id], viewerId),
  ]);
  return shapeForumPost(post, viewerId, reactions, commentCounts, pollVotes, engagement);
}
