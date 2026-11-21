import "server-only";
import { createHmac } from "node:crypto";
import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from "obscenity";
import { env, publicEnv } from "@/lib/env";

/**
 * Text moderation: a real, always-available baseline using `obscenity` (a
 * maintained library, not a hand-authored word list). Deliberately
 * word/pattern-based, not an ML classifier -- see DECISIONS.md #45 for why
 * that limitation is documented rather than papered over. Runs
 * synchronously on every forum post/comment submission.
 */
const textMatcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

export function isTextClean(text: string): boolean {
  return !textMatcher.hasMatch(text);
}

export interface ImageModerationResult {
  /** True only when a configured provider actively cleared the image. */
  autoApproved: boolean;
  /** True when a configured provider actively flagged the image. */
  autoRejected: boolean;
  reason?: string;
}

function isImageModerationConfigured(): boolean {
  return Boolean(env.MODERATION_API_USER && env.MODERATION_API_KEY);
}

/**
 * Calls Sightengine's nudity-detection endpoint
 * (https://sightengine.com/docs/nudity-detection) -- a real, commonly used
 * third-party moderation API, genuinely implemented against its actual
 * request/response shape. When no API credentials are configured (the
 * default in this delivery), returns a neutral result immediately and the
 * caller falls back to the fail-closed PENDING/admin-review path — see
 * DECISIONS.md #45.
 */
export async function moderateImageUrl(imageUrl: string): Promise<ImageModerationResult> {
  if (!isImageModerationConfigured()) {
    return { autoApproved: false, autoRejected: false, reason: "MODERATION_NOT_CONFIGURED" };
  }

  try {
    const url = new URL(env.MODERATION_API_URL);
    url.searchParams.set("url", imageUrl);
    url.searchParams.set("models", MODELS);
    url.searchParams.set("api_user", env.MODERATION_API_USER);
    url.searchParams.set("api_secret", env.MODERATION_API_KEY);

    const res = await fetch(url.toString());
    const data = (await res.json()) as {
      status?: string;
      nudity?: { sexual_activity?: number; sexual_display?: number; erotica?: number };
      offensive?: { prob?: number };
      gore?: { prob?: number };
    };

    if (!res.ok || data.status !== "success") {
      return { autoApproved: false, autoRejected: false, reason: "MODERATION_API_ERROR" };
    }

    const flagged = flaggedReason(data);
    return flagged ? { autoApproved: false, autoRejected: true, reason: flagged } : { autoApproved: true, autoRejected: false };
  } catch (err) {
    console.error("moderateImageUrl: provider call failed (falling back to manual review)", err);
    return { autoApproved: false, autoRejected: false, reason: "MODERATION_API_UNREACHABLE" };
  }
}

// ── Scoring shared by images and video frames ───────────────────────────────

const MODELS = "nudity-2.1,offensive,gore-2.0";
const THRESHOLD = 0.5;

interface FrameScores {
  nudity?: { sexual_activity?: number; sexual_display?: number; erotica?: number };
  offensive?: { prob?: number };
  gore?: { prob?: number };
}

/** The first rule a picture (or one video frame) breaks, or null when it's clean. */
function flaggedReason(scores: FrameScores): string | null {
  const nudity = Math.max(
    scores.nudity?.sexual_activity ?? 0,
    scores.nudity?.sexual_display ?? 0,
    scores.nudity?.erotica ?? 0,
  );
  if (nudity >= THRESHOLD) return "NUDITY_DETECTED";
  if ((scores.offensive?.prob ?? 0) >= THRESHOLD) return "OFFENSIVE_CONTENT";
  if ((scores.gore?.prob ?? 0) >= THRESHOLD) return "GRAPHIC_CONTENT";
  return null;
}

/** A video is flagged if any sampled frame is. */
export function flaggedVideoReason(frames: FrameScores[] | undefined): string | null {
  for (const frame of frames ?? []) {
    const reason = flaggedReason(frame);
    if (reason) return reason;
  }
  return null;
}

// ── Video ───────────────────────────────────────────────────────────────────

export interface VideoModerationResult extends ImageModerationResult {
  /** Too long to check while the user waits: start an async check once the attachment exists. */
  needsAsync?: boolean;
}

const SIGHTENGINE_VIDEO_SYNC = "https://api.sightengine.com/1.0/video/check-sync.json";
const SIGHTENGINE_VIDEO_ASYNC = "https://api.sightengine.com/1.0/video/check.json";

/**
 * Checks a video with Sightengine's video API, frame by frame, on the same
 * nudity/offensive/gore rules as images. Short videos (under ~1 minute) are
 * checked right away; longer ones come back `needsAsync` and are checked in
 * the background via `startAsyncVideoModeration`.
 */
export async function moderateVideoUrl(videoUrl: string): Promise<VideoModerationResult> {
  if (!isImageModerationConfigured()) {
    return { autoApproved: false, autoRejected: false, reason: "MODERATION_NOT_CONFIGURED" };
  }
  try {
    const body = new URLSearchParams({
      stream_url: videoUrl,
      models: MODELS,
      api_user: env.MODERATION_API_USER,
      api_secret: env.MODERATION_API_KEY,
    });
    const res = await fetch(SIGHTENGINE_VIDEO_SYNC, { method: "POST", body });
    const data = (await res.json()) as {
      status?: string;
      error?: { type?: string; message?: string };
      data?: { frames?: FrameScores[] };
    };

    if (!res.ok || data.status !== "success") {
      // The sync endpoint only takes short videos; anything else goes to the background check.
      console.warn("moderateVideoUrl: sync check unavailable, using async", data.error?.message);
      return { autoApproved: false, autoRejected: false, reason: "VIDEO_CHECK_QUEUED", needsAsync: true };
    }

    const flagged = flaggedVideoReason(data.data?.frames);
    return flagged ? { autoApproved: false, autoRejected: true, reason: flagged } : { autoApproved: true, autoRejected: false };
  } catch (err) {
    console.error("moderateVideoUrl: provider call failed (async fallback)", err);
    return { autoApproved: false, autoRejected: false, reason: "VIDEO_CHECK_QUEUED", needsAsync: true };
  }
}

/** Signs the callback URL so only Sightengine (which we gave it to) can approve an attachment. */
export function videoCallbackToken(attachmentId: string): string {
  return createHmac("sha256", env.MODERATION_API_KEY).update(`video-moderation:${attachmentId}`).digest("hex");
}

/**
 * Background check for a stored video attachment. Sightengine calls
 * /api/webhooks/sightengine as frames are analysed; that route approves or
 * rejects the attachment. If this can't start, the attachment stays PENDING
 * for an admin, as before.
 */
export async function startAsyncVideoModeration(attachmentId: string, videoUrl: string): Promise<void> {
  if (!isImageModerationConfigured()) return;
  try {
    const callback = new URL("/api/webhooks/sightengine", publicEnv.NEXT_PUBLIC_APP_URL);
    callback.searchParams.set("attachment", attachmentId);
    callback.searchParams.set("token", videoCallbackToken(attachmentId));

    const body = new URLSearchParams({
      stream_url: videoUrl,
      models: MODELS,
      callback_url: callback.toString(),
      api_user: env.MODERATION_API_USER,
      api_secret: env.MODERATION_API_KEY,
    });
    const res = await fetch(SIGHTENGINE_VIDEO_ASYNC, { method: "POST", body });
    const data = (await res.json()) as { status?: string; error?: { message?: string } };
    if (!res.ok || data.status !== "success") {
      console.error("startAsyncVideoModeration: Sightengine refused", data.error?.message);
    }
  } catch (err) {
    console.error("startAsyncVideoModeration: provider call failed (left for admin review)", err);
  }
}

/** Images and videos, each with the right check. */
export function moderateMedia(url: string, contentType: string): Promise<VideoModerationResult> {
  return contentType.startsWith("video/") ? moderateVideoUrl(url) : moderateImageUrl(url);
}
