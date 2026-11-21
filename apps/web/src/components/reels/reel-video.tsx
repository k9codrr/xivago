"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { Play, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

function fmt(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00";
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

interface ReelVideoProps {
  src: string;
  /** Only the reel on screen plays. */
  active: boolean;
  /** Next/previous reels load ahead so the swipe is instant. */
  preload: "auto" | "metadata" | "none";
  muted: boolean;
  onMutedChange: (muted: boolean) => void;
}

/**
 * Full-screen looping video with Xivago's own controls (no browser chrome):
 * tap to pause/play, a draggable progress bar, time, and a sound toggle.
 */
export function ReelVideo({ src, active, preload, muted, onMutedChange }: ReelVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);
  const [portrait, setPortrait] = useState(true);
  const [buffering, setBuffering] = useState(false);

  // Play when on screen (unless the user paused it), pause and rewind when it leaves.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (active && !userPaused) {
      v.muted = muted;
      v.play().catch(() => {
        // Browsers block autoplay with sound until the user interacts: fall back to muted.
        if (!v.muted) {
          v.muted = true;
          onMutedChange(true);
          void v.play().catch(() => {});
        }
      });
    } else {
      v.pause();
      if (!active) {
        v.currentTime = 0;
        setUserPaused(false);
      }
    }
  }, [active, userPaused, muted, onMutedChange]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  function togglePlay() {
    const v = videoRef.current;
    if (v) setUserPaused(!v.paused);
  }

  const seekTo = useCallback((clientX: number) => {
    const v = videoRef.current;
    const bar = barRef.current;
    if (!v || !bar || !Number.isFinite(v.duration)) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    v.currentTime = ratio * v.duration;
    setProgress(ratio);
  }, []);

  function onBarDown(e: PointerEvent<HTMLDivElement>) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setScrubbing(true);
    seekTo(e.clientX);
  }

  return (
    <div className="absolute inset-0 bg-black">
      <video
        ref={videoRef}
        src={src}
        loop
        playsInline
        preload={preload}
        disablePictureInPicture
        controlsList="nodownload noplaybackrate noremoteplayback"
        onClick={togglePlay}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          setDuration(v.duration);
          setPortrait(v.videoHeight >= v.videoWidth);
        }}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          if (!scrubbing && v.duration) setProgress(v.currentTime / v.duration);
        }}
        // Upright videos fill the screen like a reel; landscape ones fit without cropping.
        className={cn("h-full w-full", portrait ? "object-cover" : "object-contain")}
      />

      {/* Paused by a tap: a play button in the centre until tapped again */}
      {active && userPaused && !playing && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur animate-in zoom-in-75 fade-in duration-150">
            <Play className="ml-1 h-8 w-8 fill-current" />
          </span>
        </span>
      )}

      {buffering && active && !userPaused && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="h-10 w-10 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        </span>
      )}

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onMutedChange(!muted);
        }}
        aria-label={muted ? "Turn sound on" : "Mute"}
        className="absolute right-4 top-[max(env(safe-area-inset-top),0.75rem)] z-20 flex h-11 w-11 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur"
      >
        {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
      </button>

      {/* Progress: thin at rest, thicker with a thumb and times while dragging */}
      <div className="absolute inset-x-0 bottom-0 z-20 px-3 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
        {scrubbing && (
          <p className="mb-2 text-center text-sm font-semibold tabular-nums text-white drop-shadow">
            {fmt(progress * duration)} / {fmt(duration)}
          </p>
        )}
        <div
          ref={barRef}
          role="slider"
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(progress * duration)}
          tabIndex={0}
          onKeyDown={(e) => {
            const v = videoRef.current;
            if (!v) return;
            if (e.key === "ArrowRight") v.currentTime = Math.min(v.duration, v.currentTime + 5);
            if (e.key === "ArrowLeft") v.currentTime = Math.max(0, v.currentTime - 5);
          }}
          onPointerDown={onBarDown}
          onPointerMove={(e) => scrubbing && seekTo(e.clientX)}
          onPointerUp={() => setScrubbing(false)}
          onPointerCancel={() => setScrubbing(false)}
          className="flex h-6 cursor-pointer touch-none items-center"
        >
          <div className={cn("relative w-full rounded-full bg-white/25 transition-[height]", scrubbing ? "h-1.5" : "h-[3px]")}>
            <div className="absolute inset-y-0 left-0 rounded-full bg-white" style={{ width: `${progress * 100}%` }} />
            {scrubbing && (
              <span
                className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow"
                style={{ left: `${progress * 100}%` }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
