"use client";

import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, Expand, ImageOff, X } from "lucide-react";
import { cn } from "@/lib/utils";

const isVideo = (url: string) => /\.(mp4|webm|mov)(\?.*)?$/i.test(url);

function Slide({ url, index, fit }: { url: string; index: number; fit: "cover" | "contain" }) {
  if (isVideo(url)) {
    return <video src={url} controls playsInline className="h-full w-full object-contain" />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={`Photo ${index + 1}`}
      draggable={false}
      className={cn("h-full w-full select-none", fit === "cover" ? "object-cover" : "object-contain")}
    />
  );
}

/** Carousel state shared by the inline gallery and the fullscreen viewer. */
function useGallery(startIndex = 0) {
  const [ref, api] = useEmblaCarousel({ loop: false, startIndex });
  const [index, setIndex] = useState(startIndex);

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setIndex(api.selectedScrollSnap());
    onSelect();
    api.on("select", onSelect);
    api.on("reInit", onSelect);
    return () => {
      api.off("select", onSelect);
      api.off("reInit", onSelect);
    };
  }, [api]);

  return { ref, api, index };
}

function NavButtons({
  api,
  index,
  count,
  dark,
}: {
  api: ReturnType<typeof useGallery>["api"];
  index: number;
  count: number;
  dark?: boolean;
}) {
  if (count < 2) return null;
  const base = cn(
    "absolute top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full p-2 shadow-md transition disabled:opacity-0 sm:flex",
    dark ? "bg-white/15 text-white hover:bg-white/25" : "bg-white/90 text-neutral-800 hover:bg-white",
  );
  return (
    <>
      <button type="button" aria-label="Previous photo" className={cn(base, "left-3")} disabled={index === 0} onClick={() => api?.scrollPrev()}>
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button type="button" aria-label="Next photo" className={cn(base, "right-3")} disabled={index === count - 1} onClick={() => api?.scrollNext()}>
        <ChevronRight className="h-5 w-5" />
      </button>
    </>
  );
}

function FullscreenViewer({ urls, startIndex, onClose }: { urls: string[]; startIndex: number; onClose: () => void }) {
  const { ref, api, index } = useGallery(startIndex);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") api?.scrollPrev();
      if (e.key === "ArrowRight") api?.scrollNext();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [api, onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label="Photo viewer" className="fixed inset-0 z-[100] flex flex-col bg-black">
      <div className="flex items-center justify-between px-4 pb-2 pt-[max(env(safe-area-inset-top),0.75rem)] text-white">
        <span className="text-sm font-medium tabular-nums">
          {index + 1} / {urls.length}
        </span>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-2 hover:bg-white/10">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="relative min-h-0 flex-1">
        <div ref={ref} className="h-full overflow-hidden">
          <div className="flex h-full">
            {urls.map((url, i) => (
              <div key={url} className="h-full min-w-0 shrink-0 grow-0 basis-full">
                <Slide url={url} index={i} fit="contain" />
              </div>
            ))}
          </div>
        </div>
        <NavButtons api={api} index={index} count={urls.length} dark />
      </div>
      {urls.length > 1 && (
        <div className="flex gap-2 overflow-x-auto px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3">
          {urls.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => api?.scrollTo(i)}
              aria-label={`Show photo ${i + 1}`}
              className={cn(
                "h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 transition",
                i === index ? "border-white" : "border-transparent opacity-60",
              )}
            >
              {isVideo(url) ? (
                <div className="flex h-full w-full items-center justify-center bg-neutral-800 text-[10px] text-white">Video</div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt="" className="h-full w-full object-cover" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Full-width, swipeable photo/video carousel at the top of a post, with a
 * counter, dots, thumbnail strip and a tap-to-open fullscreen viewer.
 */
export function DemandMediaGallery({ urls, overlay }: { urls: string[]; overlay?: React.ReactNode }) {
  const { ref, api, index } = useGallery();
  const [viewerAt, setViewerAt] = useState<number | null>(null);
  const closeViewer = useCallback(() => setViewerAt(null), []);

  if (urls.length === 0) {
    return (
      <div className="relative flex aspect-[4/3] max-h-[55vh] w-full flex-col items-center justify-center gap-2 bg-neutral-100 text-neutral-400 dark:bg-neutral-900 sm:rounded-2xl">
        {overlay}
        <ImageOff className="h-8 w-8" />
        <span className="text-xs">No photos added</span>
      </div>
    );
  }

  return (
    <div>
      <div className="relative w-full overflow-hidden bg-black sm:rounded-2xl">
        {overlay}
        <div ref={ref} className="overflow-hidden">
          <div className="flex">
            {urls.map((url, i) => (
              <div key={url} className="aspect-[4/3] max-h-[55vh] min-w-0 shrink-0 grow-0 basis-full">
                {isVideo(url) ? (
                  <Slide url={url} index={i} fit="contain" />
                ) : (
                  <button type="button" className="block h-full w-full" onClick={() => setViewerAt(i)} aria-label={`Open photo ${i + 1} fullscreen`}>
                    <Slide url={url} index={i} fit="contain" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <NavButtons api={api} index={index} count={urls.length} />

        <div className="pointer-events-none absolute bottom-3 left-0 right-0 flex items-center justify-center gap-1.5">
          {urls.length > 1 &&
            urls.map((url, i) => (
              <span
                key={url}
                className={cn("h-1.5 rounded-full bg-white transition-all", i === index ? "w-4" : "w-1.5 opacity-60")}
              />
            ))}
        </div>

        <div className="absolute bottom-3 right-3 flex items-center gap-2">
          <span className="rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium tabular-nums text-white">
            {index + 1}/{urls.length}
          </span>
          {!isVideo(urls[index] ?? "") && (
            <button
              type="button"
              onClick={() => setViewerAt(index)}
              aria-label="View fullscreen"
              className="rounded-full bg-black/60 p-1.5 text-white hover:bg-black/75"
            >
              <Expand className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {urls.length > 1 && (
        <div className="flex gap-2 overflow-x-auto px-4 pt-3 sm:px-0">
          {urls.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => api?.scrollTo(i)}
              aria-label={`Show photo ${i + 1}`}
              className={cn(
                "h-14 w-14 shrink-0 overflow-hidden rounded-xl border-2 bg-neutral-100 transition dark:bg-neutral-800",
                i === index ? "border-brand-500" : "border-transparent opacity-70",
              )}
            >
              {isVideo(url) ? (
                <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-neutral-500">Video</div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt="" className="h-full w-full object-cover" />
              )}
            </button>
          ))}
        </div>
      )}

      {viewerAt !== null && <FullscreenViewer urls={urls} startIndex={viewerAt} onClose={closeViewer} />}
    </div>
  );
}
