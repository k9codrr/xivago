import { z } from "zod";

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

export const communityCreateSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(80),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  coverImage: z.string().url().optional(),
});
export type CommunityCreateInput = z.infer<typeof communityCreateSchema>;

export const communityCoverSchema = z.object({ coverImage: z.string().url() });

export { slugify };

export const communityFeedQuerySchema = z.object({
  q: z.string().trim().min(1).max(60).optional(),
  cursor: z.string().cuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  // "1": only communities the viewer has joined, most recently joined first.
  mine: z.literal("1").optional(),
});
