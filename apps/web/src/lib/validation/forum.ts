import { z } from "zod";

export const MAX_FORUM_TEXT = 1000; // matches @db.VarChar(1000) on both ForumMessage and ForumComment

/** Curated reaction set, enforced in app code -- the DB column accepts any string (see schema.prisma comment). */
export const FORUM_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "👏"] as const;
export type ForumReactionEmoji = (typeof FORUM_REACTIONS)[number];

export const forumTextSchema = z
  .string()
  .trim()
  .min(1, "Say something first")
  .max(MAX_FORUM_TEXT, `Keep it under ${MAX_FORUM_TEXT} characters`);

const forumPollSchema = z.object({
  options: z.array(z.string().trim().min(1).max(80)).min(2).max(4),
  closesInHours: z.number().int().min(1).max(168).optional(), // max 1 week
});

/** Most photos/videos on one post. */
export const MAX_FORUM_MEDIA = 4;

const forumAttachmentSchema = z.object({
  url: z.string().url(),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm", "video/quicktime"]),
});

export const forumPostCreateSchema = z.object({
  text: forumTextSchema,
  attachments: z.array(forumAttachmentSchema).max(MAX_FORUM_MEDIA).optional(),
  /** Posts inside a community instead of the global forum -- see DECISIONS.md #53/#54. */
  communityId: z.string().cuid().optional(),
  /** "near me" feed filter -- see lib/geo.ts. */
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  poll: forumPollSchema.optional(),
});
export type ForumPostCreateInput = z.infer<typeof forumPostCreateSchema>;

export const forumCommentCreateSchema = z.object({
  text: forumTextSchema,
});
export type ForumCommentCreateInput = z.infer<typeof forumCommentCreateSchema>;

export const forumReactSchema = z.object({
  emoji: z.enum(FORUM_REACTIONS),
});
export type ForumReactInput = z.infer<typeof forumReactSchema>;

export const forumVoteSchema = z.object({
  optionId: z.string().cuid(),
});
export type ForumVoteInput = z.infer<typeof forumVoteSchema>;

export const forumReportSchema = z.object({
  reason: z.string().trim().min(1, "Tell us what's wrong").max(300),
});
export type ForumReportInput = z.infer<typeof forumReportSchema>;

export const forumFeedQuerySchema = z.object({
  cursor: z.string().cuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  /** Filters the feed to one author's posts -- used by the profile "Threads" tab. */
  authorId: z.string().cuid().optional(),
  /** Filters the feed to one community's posts; omitted means the global forum. */
  communityId: z.string().cuid().optional(),
  /** "joined": only posts from communities the viewer has joined -- the forum's Communities tab. */
  scope: z.literal("joined").optional(),
  /** "new" (default) is plain chronological; "hot" ranks by recency-decayed engagement. */
  sort: z.enum(["new", "hot"]).default("new"),
  /** "near me" filter -- requires both lat/lng; radiusKm defaults to 25. */
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().positive().max(500).default(25),
});
