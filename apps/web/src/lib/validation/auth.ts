import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});
export type LoginInput = z.infer<typeof loginSchema>;

/** Rules for any new password: signup, reset and change. */
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password is too long")
  .regex(/[a-z]/, "Include at least one lowercase letter")
  .regex(/[A-Z]/, "Include at least one uppercase letter")
  .regex(/[0-9]/, "Include at least one number");

/** Email or 10-digit mobile the account is known by, for "Forgot password". */
export const resetIdentifierSchema = z.string().trim().min(3, "Enter your email or mobile number").max(254);

/** Where a reset code goes: the account's email (Resend) or its verified WhatsApp number. */
export const codeChannelSchema = z.enum(["email", "whatsapp"]);
export type CodeChannel = z.infer<typeof codeChannelSchema>;

/** No channel = pick automatically (email for an email identifier, else WhatsApp). */
export const passwordResetSendSchema = z.object({ identifier: resetIdentifierSchema, channel: codeChannelSchema.optional() });

export const passwordResetConfirmSchema = z.object({
  identifier: resetIdentifierSchema,
  channel: codeChannelSchema.default("whatsapp"),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
  password: passwordSchema,
});

/** Signed in: prove it's you with the current password or a WhatsApp code. */
export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1).max(200).optional(),
    channel: codeChannelSchema.default("whatsapp"),
    code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code").optional(),
    password: passwordSchema,
  })
  .refine((d) => Boolean(d.currentPassword) !== Boolean(d.code), {
    message: "Enter your current password or a WhatsApp code",
    path: ["currentPassword"],
  });

export const roleChoiceSchema = z.enum(["VENDOR", "BUSINESS"]);
export type RoleChoice = z.infer<typeof roleChoiceSchema>;

export const signupSchema = z
  .object({
    name: z.string().trim().min(2, "Name is too short").max(80),
    email: z.string().trim().toLowerCase().email("Enter a valid email address"),
    password: passwordSchema,
    confirmPassword: z.string(),
    role: roleChoiceSchema,
    referralCode: z.string().trim().max(20).optional(),
    acceptedTerms: z.literal(true, {
      errorMap: () => ({ message: "Please accept the Terms of Service and Privacy Policy" }),
    }),
    ageConfirmed: z.literal(true, {
      errorMap: () => ({ message: "You must be 18 or older to use xivago" }),
    }),
    // Every tick / untick of the consent checkbox, logged with the account.
    consentEvents: z
      .array(
        z.object({
          action: z.enum(["checked", "unchecked", "age_checked", "age_unchecked"]),
          at: z.string().datetime(),
        }),
      )
      .max(50)
      .optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type SignupInput = z.infer<typeof signupSchema>;

// Server-side register payload (no confirmPassword, that's a UI-only check)
export const registerPayloadSchema = signupSchema
  .innerType()
  .omit({ confirmPassword: true });
export type RegisterPayload = z.infer<typeof registerPayloadSchema>;
