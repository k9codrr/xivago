import { NextResponse } from "next/server";
import type { ZodError } from "zod";

/**
 * Every API route in this codebase returns errors in this exact shape
 * (§6: "EVERY route: ... { error: { code, message } } shape").
 * `code` is a stable machine-readable string the client can switch on;
 * `message` is human-readable and safe to show directly in a toast.
 */
export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export function apiError(
  status: number,
  code: string,
  message: string,
  details?: unknown,
): NextResponse<ApiErrorBody> {
  return NextResponse.json({ error: { code, message, details } }, { status });
}

export function apiValidationError(zodError: ZodError): NextResponse<ApiErrorBody> {
  return apiError(
    400,
    "VALIDATION_ERROR",
    "Request payload failed validation.",
    zodError.flatten(),
  );
}

export const ApiErrors = {
  unauthorized: () => apiError(401, "UNAUTHORIZED", "You must be signed in."),
  forbidden: (message = "You do not have access to this resource.") =>
    apiError(403, "FORBIDDEN", message),
  notFound: (message = "Resource not found.") => apiError(404, "NOT_FOUND", message),
  gone: (message = "This resource is no longer available.") => apiError(410, "GONE", message),
  conflict: (message: string) => apiError(409, "CONFLICT", message),
  rateLimited: (message = "Too many requests. Try again shortly.") =>
    apiError(429, "RATE_LIMITED", message),
  internal: (message = "Something went wrong. Please try again.") =>
    apiError(500, "INTERNAL_ERROR", message),
};
