"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAX_UPLOAD_BYTES } from "@/lib/validation/upload";

interface ImageUploadFieldProps {
  kind: "avatar" | "logo" | "community";
  value: string | undefined;
  onChange: (url: string) => void;
  label: string;
  shape?: "circle" | "square";
}

const ACCEPTED = "image/jpeg,image/png,image/webp";

export function ImageUploadField({ kind, value, onChange, label, shape = "circle" }: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | undefined>(value);

  // `value` arrives asynchronously (profile data loads after mount, then
  // react-hook-form's `reset()` updates it) — keep the preview in sync
  // rather than only reading it once at mount.
  useEffect(() => {
    setPreview((current) => {
      // Don't clobber a just-uploaded local blob preview with a stale prop
      // value racing in from the same render cycle.
      if (current?.startsWith("blob:")) return current;
      return value;
    });
  }, [value]);

  async function handleFileSelected(file: File) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Only JPEG, PNG, or WEBP images are allowed.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error("File is too large — max 5MB.");
      return;
    }

    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);
    setUploading(true);

    try {
      const signRes = await fetch("/api/uploads/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          contentType: file.type,
          fileSizeBytes: file.size,
        }),
      });

      const signData = await signRes.json();
      if (!signRes.ok) {
        toast.error(signData?.error?.message ?? "Could not start upload.");
        return;
      }

      const putRes = await fetch(signData.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!putRes.ok) {
        toast.error("Upload failed. Please try again.");
        return;
      }

      onChange(signData.publicUrl as string);
      toast.success(`${label} updated.`);
    } catch {
      toast.error("Upload failed. Check your connection and try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className={cn(
          "relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden border-2 border-dashed border-neutral-300 bg-neutral-100 text-neutral-400 dark:border-neutral-700 dark:bg-neutral-800",
          shape === "circle" ? "rounded-full" : "rounded-xl",
        )}
        aria-label={`Upload ${label}`}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- preview can be a blob: URL, next/image can't handle those
          <img src={preview} alt={label} className="h-full w-full object-cover" />
        ) : (
          <Camera className="h-6 w-6" />
        )}
        {uploading && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/40">
            <Loader2 className="h-5 w-5 animate-spin text-white" />
          </span>
        )}
      </button>

      <div>
        <p className="text-sm font-medium text-neutral-700 dark:text-neutral-200">{label}</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="text-sm font-semibold text-brand-600 disabled:opacity-50"
        >
          {preview ? "Change photo" : "Upload photo"}
        </button>
        <p className="text-xs text-neutral-400">JPEG, PNG or WEBP, up to 5MB.</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFileSelected(file);
          e.target.value = ""; // allow re-selecting the same file
        }}
      />
    </div>
  );
}
