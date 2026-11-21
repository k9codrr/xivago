import "server-only";
import { S3Client } from "@aws-sdk/client-s3";
import { env } from "@/lib/env";

/**
 * R2 is S3-compatible, so the standard AWS SDK v3 client works unmodified
 * against R2's endpoint — no separate SDK needed. `region: "auto"` is R2's
 * documented convention (it doesn't use AWS regions).
 */
export function getR2Client(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
}

export function isR2Configured(): boolean {
  return Boolean(
    env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET,
  );
}

export function publicUrlForKey(key: string): string {
  const base = env.R2_PUBLIC_URL.replace(/\/+$/, "");
  return `${base}/${key}`;
}
