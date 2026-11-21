export interface ForumAuthor {
  id: string;
  name: string;
  avatarUrl: string | null;
  companyName: string | null;
  role: string;
}

export interface ForumReactions {
  counts: Record<string, number>;
  total: number;
  myReaction: string | null;
}

export interface ForumAttachment {
  id: string;
  url: string;
  contentType: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
}

export interface ForumPollOption {
  id: string;
  text: string;
  voteCount: number;
}

export interface ForumPoll {
  id: string;
  closesAt: string | null;
  totalVotes: number;
  options: ForumPollOption[];
  myVoteOptionId: string | null;
}

export interface ForumPost {
  id: string;
  text: string;
  createdAt: string;
  senderId: string;
  sender: ForumAuthor;
  /** Visible photos/videos, in posting order. */
  attachments: ForumAttachment[];
  reactions: ForumReactions;
  commentCount: number;
  repostCount: number;
  shareCount: number;
  bookmarkCount: number;
  isReposted: boolean;
  isBookmarked: boolean;
  isMine: boolean;
  location: { lat: number; lng: number } | null;
  poll: ForumPoll | null;
  /** The community this was posted in; null for the global forum. */
  community: { id: string; name: string; slug: string } | null;
}

export interface ForumComment {
  id: string;
  text: string;
  createdAt: string;
  senderId: string;
  sender: ForumAuthor;
  reactions: ForumReactions;
  isMine: boolean;
}

/** A community suggested while typing an "@" mention in the composer. */
export interface MentionCommunity {
  kind: "community";
  id: string;
  name: string;
  slug: string;
  coverImage: string | null;
  memberCount: number;
  /** Whether the viewer has joined it (joined ones are listed first). */
  isMember: boolean;
}

/** How a suggested person relates to the viewer; null when they don't follow each other. */
export type UserRelation = "mutual" | "following" | "follower";

/** A person suggested while typing an "@" mention in the composer. */
export interface MentionUser {
  kind: "user";
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  /** People the viewer follows / is followed by are listed first. */
  relation: UserRelation | null;
}

export type MentionSuggestion = MentionUser | MentionCommunity;

/** The text a suggestion inserts after "@". */
export const mentionHandle = (s: MentionSuggestion) => (s.kind === "user" ? s.username : s.slug);
