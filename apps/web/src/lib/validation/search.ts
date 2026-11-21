import { z } from "zod";

export const searchQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  type: z.enum(["all", "people", "demands", "communities", "posts", "messages"]).default("all"),
  category: z.string().trim().max(60).optional(),
});
export type SearchQueryInput = z.infer<typeof searchQuerySchema>;
