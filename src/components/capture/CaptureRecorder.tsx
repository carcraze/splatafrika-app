"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { CAPTURE } from "@/lib/constants";
import type { TourTier } from "@/types";

interface CaptureRecorderProps {
  tier: TourTier;
  onComplete: (blob: Blob) => void;
}

export function CaptureRecorder({ tier, onComplete }: CaptureRecorderProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const elapsedRef = useRef(0);

  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Request camera access
  useEffect(() => {
    async function initCamera() {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        if (err instanceof Error) {
          if (err.name === "NotAllowedError") {
            setError(
              "Camera access is required. Please enable camera permissions in your browser settings."
            );
          } else if (err.name === "NotFoundError") {
            setError("No camera found on this device.");
          } else {
            setError(
              "Camera access is required. Please enable camera permissions in your browser settings."
            );
          }
        }
      }
    }
    initCamera();

    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Elapsed timer
  useEffect(() => {
    if (!isRecording) return;
    const interval = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;
        elapsedRef.current = next;
        if (next >= CAPTURE.MAX_RECORDING_SECONDS) {
          stopRecording();
          return prev;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording]);

  const startRecording = useCallback(() => {
    if (!stream) return;
    chunksRef.current = [];
    elapsedRef.current = 0;
    const recorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : "video/webm",
    });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const recordedSeconds = elapsedRef.current;
      // Show warning for short recordings but don't block — let them proceed
      if (recordedSeconds < CAPTURE.MIN_RECORDING_SECONDS) {
        console.warn(`Short recording: ${recordedSeconds}s (recommended: 30s+)`);
      }
      onComplete(blob);
    };
    mediaRecorderRef.current = recorder;
    recorder.start(1000);
    setIsRecording(true);
    setElapsed(0);
    setError(null);
  }, [stream, onComplete]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-16 h-16 mx-auto rounded-full bg-[#EF4444]/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-[#EF4444]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <p className="text-sm text-[#8FA3B1]">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-[#00D4AA] hover:bg-[#33DDBB] text-[#003D30] font-semibold text-sm rounded-xl transition-all duration-200"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col relative">
      {/* Camera feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="flex-1 object-cover w-full"
      />

      {/* Tier badge — shown before AND during recording */}
      <div className="absolute top-4 left-4">
        <span
          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-sm ${
            tier === "premium"
              ? "bg-[#003D30]/80 text-[#00D4AA] border border-[#00D4AA]/30"
              : "bg-white/10 text-white border border-white/20"
          }`}
        >
          {tier === "premium" ? "✦ Premium Hyperreal" : "Standard"}
        </span>
      </div>

      {/* Guidance overlay — shown during recording */}
      {isRecording && (
        <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-sm rounded-xl px-3 py-2 space-y-1">
          <p className="text-xs text-[#00D4AA] font-medium">Tips:</p>
          <p className="text-[10px] text-white/80">• Move slowly</p>
          <p className="text-[10px] text-white/80">• Cover all corners</p>
        </div>
      )}

      {/* Timer */}
      {isRecording && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2">
          <div className="flex items-center gap-2 bg-black/50 backdrop-blur-sm rounded-full px-4 py-2">
            <span className="w-2 h-2 rounded-full bg-[#EF4444] animate-pulse" />
            <span className="text-sm font-mono text-white">
              {formatTime(elapsed)}
            </span>
          </div>
        </div>
      )}

      {/* Controls — bottom anchored for mobile */}
      <div className="absolute bottom-0 left-0 right-0 p-6 pb-10 bg-gradient-to-t from-black/60 to-transparent">
        <div className="flex items-center justify-center">
          {!isRecording ? (
            <button
              onClick={startRecording}
              disabled={!stream}
              className="w-20 h-20 rounded-full bg-[#00D4AA] hover:bg-[#33DDBB] active:scale-95 transition-all duration-200 flex items-center justify-center shadow-[0_0_24px_rgba(0,212,170,0.4)] disabled:opacity-50"
              aria-label="Start recording"
            >
              <div className="w-6 h-6 rounded-full bg-[#003D30]" />
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="w-20 h-20 rounded-full bg-[#EF4444] hover:bg-[#DC2626] active:scale-95 transition-all duration-200 flex items-center justify-center shadow-[0_0_24px_rgba(239,68,68,0.4)]"
              aria-label="Stop recording"
            >
              <div className="w-6 h-6 rounded-sm bg-white" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
