import { z } from "zod";

export const ALLOWED_IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
} as const;

export const ALLOWED_VIDEO_TYPES = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
} as const;

export const ALLOWED_DOCUMENT_TYPES = {
  "application/pdf": "pdf",
} as const;

export const ALLOWED_MEDIA_TYPES = {
  ...ALLOWED_IMAGE_TYPES,
  ...ALLOWED_VIDEO_TYPES,
  ...ALLOWED_DOCUMENT_TYPES,
} as const;

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50MB
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024; // 10MB
/** @deprecated Use MAX_IMAGE_BYTES or MAX_VIDEO_BYTES instead. */
export const MAX_UPLOAD_BYTES = MAX_IMAGE_BYTES;

export const uploadKindSchema = z.enum(["avatar", "logo", "forum", "chat", "community", "demand"]);

export const uploadSignSchema = z.object({
  kind: uploadKindSchema,
  contentType: z.string().refine(
    (type) => type in ALLOWED_MEDIA_TYPES,
    { message: "Supported formats: JPG, PNG, WEBP, GIF, MP4, WEBM, MOV, PDF" }
  ),
  fileSizeBytes: z
    .number()
    .int()
    .positive()
    .max(MAX_VIDEO_BYTES, "File is too large — max 50MB for video, 10MB for image/PDF."),
});

export type UploadSignInput = z.infer<typeof uploadSignSchema>;
