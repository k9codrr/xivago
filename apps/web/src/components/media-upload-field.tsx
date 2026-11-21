"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Image as ImageIcon, Video, X, Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAX_IMAGE_BYTES, MAX_VIDEO_BYTES } from "@/lib/validation/upload";

interface MediaUploadFieldProps {
  value: string[];
  onChange: (urls: string[]) => void;
  maxFiles?: number;
}

const ACCEPTED = "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime";

function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov)(\?.*)?$/i.test(url) || url.includes("/videos/");
}

export function MediaUploadField({ value = [], onChange, maxFiles = 5 }: MediaUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) return;

    if (value.length + files.length > maxFiles) {
      toast.error(`You can attach up to ${maxFiles} photos/videos maximum.`);
      return;
    }

    setUploading(true);
    const newUrls: string[] = [];

    try {
      for (const file of Array.from(files)) {
        const isVid = file.type.startsWith("video/");
        const maxBytes = isVid ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;

        if (file.size > maxBytes) {
          toast.error(`${file.name} is too large. Max size is ${isVid ? "50MB" : "10MB"}.`);
          continue;
        }

        const signRes = await fetch("/api/uploads/sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "demand",
            contentType: file.type,
            fileSizeBytes: file.size,
          }),
        });

        const signData = await signRes.json();
        if (!signRes.ok) {
          toast.error(signData?.error?.message ?? `Failed to sign upload for ${file.name}`);
          continue;
        }

        const putRes = await fetch(signData.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });

        if (!putRes.ok) {
          toast.error(`Failed to upload ${file.name}`);
          continue;
        }

        newUrls.push(signData.publicUrl as string);
      }

      if (newUrls.length > 0) {
        onChange([...value, ...newUrls]);
        toast.success(`Uploaded ${newUrls.length} file(s) via Cloudflare R2.`);
      }
    } catch {
      toast.error("Upload failed. Please check your connection.");
    } finally {
      setUploading(false);
    }
  }

  function handleRemove(index: number) {
    const next = [...value];
    next.splice(index, 1);
    onChange(next);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {value.map((url, i) => {
          const isVideo = isVideoUrl(url);
          return (
            <div
              key={url}
              className="group relative h-20 w-20 overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-900 shadow-sm dark:border-neutral-800"
            >
              {isVideo ? (
                <video src={url} className="h-full w-full object-cover" muted />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt={`Attachment ${i + 1}`} className="h-full w-full object-cover" />
              )}

              {isVideo && (
                <span className="absolute bottom-1 right-1 rounded bg-black/60 p-0.5 text-white">
                  <Video className="h-3 w-3" />
                </span>
              )}

              <button
                type="button"
                onClick={() => handleRemove(i)}
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white transition-opacity group-hover:opacity-100"
                aria-label="Remove media"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}

        {value.length < maxFiles && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className={cn(
              "flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-neutral-300 bg-neutral-50 text-neutral-400 transition-colors hover:border-brand-500 hover:text-brand-500 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-brand-500",
              uploading && "opacity-50 cursor-not-allowed"
            )}
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Plus className="h-5 w-5" />
                <span className="text-[10px] font-semibold">Media</span>
              </>
            )}
          </button>
        )}
      </div>

      <p className="text-xs text-neutral-400">
        Attach photos, images, or videos (MP4/MOV up to 50MB) stored on R2.
      </p>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED}
        className="hidden"
        onChange={(e) => {
          void handleFilesSelected(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
