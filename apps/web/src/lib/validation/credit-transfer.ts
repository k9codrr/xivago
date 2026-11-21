import { z } from "zod";

export const creditTransferRequestCreateSchema = z.object({
  amount: z.number().int().min(1).max(100000).optional(),
});
export type CreditTransferRequestCreateInput = z.infer<typeof creditTransferRequestCreateSchema>;

export const creditTransferConfirmSchema = z.object({
  amount: z.number().int().min(1).max(100000).optional(),
});
export type CreditTransferConfirmInput = z.infer<typeof creditTransferConfirmSchema>;
