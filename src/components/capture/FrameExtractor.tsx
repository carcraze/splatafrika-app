"use client";

import { useEffect, useState, useRef } from "react";
import { CAPTURE } from "@/lib/constants";

interface FrameExtractorProps {
  videoBlob: Blob;
  onComplete: (frames: Blob[]) => void;
}

export function FrameExtractor({ videoBlob, onComplete }: FrameExtractorProps) {
  const [progress, setProgress] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [extractedCount, setExtractedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    extractFrames();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function extractFrames() {
    try {
      const videoUrl = URL.createObjectURL(videoBlob);
      const video = document.createElement("video");
      video.src = videoUrl;
      video.muted = true;
      video.playsInline = true;

      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error("Failed to load video"));
      });

      const duration = video.duration;

      // Smart extraction: 1 frame every 2 seconds
      // 1-min video = ~30 frames, 3-min = ~90 frames (not 180!)
      // This is plenty for COLMAP and keeps uploads fast
      const EXTRACTION_INTERVAL = 2;
      const maxSeconds = duration > CAPTURE.MAX_EXTRACTION_SECONDS
        ? CAPTURE.MAX_EXTRACTION_SECONDS
        : Math.floor(duration);

      const expectedFrames = Math.floor(maxSeconds / EXTRACTION_INTERVAL);
      setTotalFrames(expectedFrames);

      const canvas = canvasRef.current;
      if (!canvas) return;
      // Cap resolution at 1920x1080 to keep file sizes reasonable
      const scale = Math.min(1, 1920 / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const frames: Blob[] = [];

      for (let i = 0; i < expectedFrames; i++) {
        const time = i * EXTRACTION_INTERVAL;
        video.currentTime = time;

        await new Promise<void>((resolve) => {
          video.onseeked = () => resolve();
        });

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // JPEG at 85% quality — 5-10x smaller than PNG, much faster upload
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error("Frame extraction failed"))),
            "image/jpeg",
            0.85
          );
        });

        frames.push(blob);
        setExtractedCount(i + 1);
        setProgress(((i + 1) / expectedFrames) * 100);
      }

      URL.revokeObjectURL(videoUrl);

      if (duration > CAPTURE.MAX_EXTRACTION_SECONDS) {
        console.info(`Video truncated: ${Math.round(duration)}s → ${CAPTURE.MAX_EXTRACTION_SECONDS}s`);
      }

      onComplete(frames);
    } catch (err) {
      setError(
        err instanceof Error
          ? `Frame extraction failed: ${err.message}. Try recording a shorter video (under 3 minutes).`
          : "Frame extraction failed. Try recording a shorter video (under 3 minutes)."
      );
    }
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-16 h-16 mx-auto rounded-full bg-[#EF4444]/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-[#EF4444]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
            </svg>
          </div>
          <p className="text-sm text-[#8FA3B1]">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="text-center space-y-6 w-full max-w-xs">
        <div className="w-16 h-16 mx-auto rounded-full border-2 border-[#00D4AA]/30 border-t-[#00D4AA] animate-spin" />
        <div className="space-y-2">
          <p className="text-sm text-white font-medium">Extracting frames...</p>
          <p className="text-xs text-[#8FA3B1]">
            {extractedCount} / {totalFrames} frames
          </p>
        </div>
        <div className="w-full h-2 bg-[#1A3C5E] rounded-full overflow-hidden">
          <div
            className="h-full progress-fill rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
