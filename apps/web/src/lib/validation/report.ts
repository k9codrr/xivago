import { z } from "zod";

export const DEMAND_REPORT_REASONS = [
  "Fraud or scam",
  "Misleading or fake post",
  "Offensive or inappropriate content",
  "Spam or duplicate",
  "Prohibited service",
  "Something else",
] as const;

export const USER_REPORT_REASONS = [
  "Fraud or scam",
  "Harassment or abusive behaviour",
  "Fake profile or impersonation",
  "Asked to pay outside xivago",
  "Something else",
] as const;

export const reportSchema = z
  .object({
    target: z.enum(["DEMAND", "USER"]),
    reason: z.string().trim().min(1, "Pick a reason").max(80),
    details: z.string().trim().max(500).optional(),
  })
  .refine(
    (v) =>
      (v.target === "DEMAND" ? DEMAND_REPORT_REASONS : USER_REPORT_REASONS).includes(
        v.reason as (typeof DEMAND_REPORT_REASONS)[number] & (typeof USER_REPORT_REASONS)[number],
      ),
    { message: "Pick one of the listed reasons", path: ["reason"] },
  )
  .refine((v) => v.reason !== "Something else" || (v.details && v.details.length >= 5), {
    message: "Tell us a little more",
    path: ["details"],
  });

export type ReportInput = z.infer<typeof reportSchema>;

/** Short, human-quotable reference for a report — the tail of its cuid. */
export function reportReference(id: string): string {
  return `R-${id.slice(-8).toUpperCase()}`;
}

/** Short, human-quotable post ID shown on the detail page (OLX-style "Ad ID"). */
export function postReference(id: string): string {
  return id.slice(-10).toUpperCase();
}
