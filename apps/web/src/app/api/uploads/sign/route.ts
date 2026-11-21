import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2Client, isR2Configured, publicUrlForKey } from "@/lib/r2";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError, apiValidationError } from "@/lib/api-response";
import { uploadSignSchema, ALLOWED_MEDIA_TYPES } from "@/lib/validation/upload";
import { env } from "@/lib/env";

const PRESIGN_EXPIRY_SECONDS = 120;

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();

    if (!isR2Configured()) {
      return apiError(
        503,
        "UPLOADS_NOT_CONFIGURED",
        "Media uploads aren't set up on this environment yet.",
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
    }

    const parsed = uploadSignSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);
    const { kind, contentType, fileSizeBytes } = parsed.data;
    void fileSizeBytes; // enforced client-side

    if (kind === "community" && !user.isAdmin) {
      return apiError(403, "FORBIDDEN", "Only admins can set community cover images.");
    }

    const ext = ALLOWED_MEDIA_TYPES[contentType as keyof typeof ALLOWED_MEDIA_TYPES] || "bin";
    const key = `${kind}s/${user.id}/${randomUUID()}.${ext}`;

    const client = getR2Client();
    const command = new PutObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(client, command, {
      expiresIn: PRESIGN_EXPIRY_SECONDS,
    });

    return NextResponse.json({
      uploadUrl,
      publicUrl: publicUrlForKey(key),
      key,
      expiresIn: PRESIGN_EXPIRY_SECONDS,
      // Client MUST set this exact header on the PUT or the signature won't match.
      requiredHeaders: { "Content-Type": contentType },
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("uploads/sign: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not create upload URL.");
  }
}
