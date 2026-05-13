"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { UPLOAD } from "@/lib/constants";
import type { TourTier } from "@/types";

interface S3UploaderProps {
  frames: Blob[];
  tourId: string;
  tier: TourTier;
  onComplete: () => void;
}

export function S3Uploader({ frames, tourId, tier, onComplete }: S3UploaderProps) {
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const abortRef = useRef(false);

  useEffect(() => {
    uploadFrames();
    return () => { abortRef.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function uploadFrames() {
    try {
      // 1. Get pre-signed URLs from our API
      const response = await fetch("/api/upload/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tourId,
          frameCount: frames.length,
          contentType: "image/png",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get upload URLs");
      }

      const { urls, s3Key } = await response.json();

      // 2. Upload each frame with retry logic
      let uploaded = 0;
      for (let i = 0; i < frames.length; i++) {
        if (abortRef.current) return;

        let success = false;
        let attempts = 0;
        let backoff = UPLOAD.INITIAL_BACKOFF_MS;

        while (!success && attempts < UPLOAD.MAX_RETRIES_PER_CHUNK) {
          try {
            const uploadResponse = await fetch(urls[i].url, {
              method: "PUT",
              body: frames[i],
              headers: { "Content-Type": "image/png" },
            });

            if (!uploadResponse.ok) {
              throw new Error(`Upload failed: ${uploadResponse.status}`);
            }

            success = true;
            uploaded++;
            setProgress((uploaded / frames.length) * 100);
          } catch {
            attempts++;
            if (attempts >= UPLOAD.MAX_RETRIES_PER_CHUNK) {
              throw new Error(
                `Failed to upload frame ${i + 1} after ${UPLOAD.MAX_RETRIES_PER_CHUNK} attempts`
              );
            }
            // Exponential backoff
            setRetrying(true);
            await new Promise((r) => setTimeout(r, backoff));
            backoff *= 2;
            setRetrying(false);
          }
        }
      }

      // 3. Create job record in Supabase
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Not authenticated");

      let jobCreated = false;
      let jobAttempts = 0;

      while (!jobCreated && jobAttempts < 3) {
        const { error: jobError } = await supabase.from("jobs").insert({
          tour_id: tourId,
          user_id: user.id,
          status: "pending",
          quality_tier: tier,
          s3_input_path: s3Key,
        });

        if (!jobError) {
          jobCreated = true;
        } else {
          jobAttempts++;
          if (jobAttempts >= 3) {
            setError(
              "Upload succeeded but job creation failed. Your frames are safe — please contact support."
            );
            return;
          }
          await new Promise((r) => setTimeout(r, 1000));
        }
      }

      // 4. Update tour status
      await supabase
        .from("tours")
        .update({ status: "processing" })
        .eq("id", tourId);

      onComplete();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Upload failed. Please try again."
      );
    }
  }

  const handleRetry = () => {
    setError(null);
    setProgress(0);
    uploadFrames();
  };

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
          <button
            onClick={handleRetry}
            className="px-6 py-3 bg-[#00D4AA] hover:bg-[#33DDBB] text-[#003D30] font-semibold text-sm rounded-xl transition-all duration-200"
          >
            Retry Upload
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="text-center space-y-6 w-full max-w-xs">
        <div className="w-16 h-16 mx-auto rounded-full border-2 border-[#00D4AA]/30 border-t-[#00D4AA] animate-spin" />
        <div className="space-y-2">
          <p className="text-sm text-white font-medium">
            {retrying ? "Retrying..." : "Uploading frames..."}
          </p>
          <p className="text-xs text-[#8FA3B1]">
            {Math.round(progress)}% complete
          </p>
        </div>
        <div className="w-full h-2 bg-[#1A3C5E] rounded-full overflow-hidden">
          <div
            className="h-full progress-fill rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-[10px] text-[#8FA3B1]">
          Do not close this page while uploading
        </p>
      </div>
    </div>
  );
}
