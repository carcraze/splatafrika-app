"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CaptureRecorder } from "@/components/capture/CaptureRecorder";
import { FrameExtractor } from "@/components/capture/FrameExtractor";
import { FramePreview } from "@/components/capture/FramePreview";
import { S3Uploader } from "@/components/capture/S3Uploader";

type CaptureStep = "record" | "extract" | "preview" | "upload" | "done";

export default function CapturePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0A1628] flex items-center justify-center"><div className="w-8 h-8 rounded-full border-2 border-[#00D4AA]/30 border-t-[#00D4AA] animate-spin" /></div>}>
      <CaptureContent />
    </Suspense>
  );
}

function CaptureContent() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState<CaptureStep>("record");
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [frames, setFrames] = useState<Blob[]>([]);

  // Read tour info from URL params
  const tourId = searchParams.get("tour") || "";
  const tier = (searchParams.get("tier") as "standard" | "premium") || "standard";

  // Get tour info from URL params
  // In production, this would come from the checkout flow
  // For now, we'll read from searchParams

  const handleRecordingComplete = (blob: Blob) => {
    setVideoBlob(blob);
    setStep("extract");
  };

  const handleExtractionComplete = (extractedFrames: Blob[]) => {
    setFrames(extractedFrames);
    setStep("preview");
  };

  const handleConfirmFrames = () => {
    setStep("upload");
  };

  const handleReRecord = () => {
    setVideoBlob(null);
    setFrames([]);
    setStep("record");
  };

  const handleUploadComplete = () => {
    setStep("done");
  };

  return (
    <main className="min-h-screen bg-[#0A1628] flex flex-col">
      {step === "record" && (
        <CaptureRecorder
          tier={tier}
          onComplete={handleRecordingComplete}
        />
      )}

      {step === "extract" && videoBlob && (
        <FrameExtractor
          videoBlob={videoBlob}
          onComplete={handleExtractionComplete}
        />
      )}

      {step === "preview" && (
        <FramePreview
          frames={frames}
          onConfirm={handleConfirmFrames}
          onReRecord={handleReRecord}
        />
      )}

      {step === "upload" && (
        <S3Uploader
          frames={frames}
          tourId={tourId}
          tier={tier}
          onComplete={handleUploadComplete}
        />
      )}

      {step === "done" && (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-[#00D4AA]/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-[#00D4AA]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white">Upload Complete</h2>
            <p className="text-sm text-[#8FA3B1]">
              Processing started. You&apos;ll receive an email when your tour is ready.
            </p>
            <a
              href="/dashboard"
              className="inline-block px-6 py-3 bg-[#00D4AA] hover:bg-[#33DDBB] text-[#003D30] font-semibold text-sm rounded-xl transition-all duration-200"
            >
              Go to Dashboard
            </a>
          </div>
        </div>
      )}
    </main>
  );
}
