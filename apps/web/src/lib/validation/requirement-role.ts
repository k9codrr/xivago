import { z } from "zod";

const name = z.string().trim().min(2, "Role name must be at least 2 characters").max(40);
const description = z.string().trim().max(120).nullable();
const sortOrder = z.coerce.number().int().min(0).max(100_000);

export const requirementRoleCreateSchema = z.object({
  name,
  description: description.optional(),
  sortOrder: sortOrder.optional(),
});

export const requirementRolePatchSchema = z
  .object({ name, description, sortOrder, isActive: z.boolean() })
  .partial();
