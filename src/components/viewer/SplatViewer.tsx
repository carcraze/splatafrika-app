"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";

interface SplatViewerProps {
  splatUrl: string;
  className?: string;
}

type ViewerState = "loading" | "ready" | "error" | "unsupported";

export function SplatViewer({ splatUrl, className = "" }: SplatViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [state, setState] = useState<ViewerState>("loading");
  const [progress, setProgress] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  // Check WebGL 2.0 support
  useEffect(() => {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    if (!gl) {
      setState("unsupported");
      return;
    }
    canvas.remove();
  }, []);

  // Simulate progress while loading (the iframe handles actual loading)
  useEffect(() => {
    if (state !== "loading") return;

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(interval);
          return 90;
        }
        return prev + Math.random() * 15;
      });
    }, 500);

    return () => clearInterval(interval);
  }, [state, retryCount]);

  const handleIframeLoad = useCallback(() => {
    setProgress(100);
    setTimeout(() => setState("ready"), 300);
  }, []);

  const handleIframeError = useCallback(() => {
    if (retryCount < maxRetries) {
      setRetryCount((prev) => prev + 1);
      setProgress(0);
    } else {
      setState("error");
    }
  }, [retryCount]);

  const handleRetry = useCallback(() => {
    setState("loading");
    setProgress(0);
    setRetryCount(0);
  }, []);

  // Build the viewer URL — SuperSplat viewer with the splat file as parameter
  const viewerUrl = `/viewer/index.html?url=${encodeURIComponent(splatUrl)}`;

  if (state === "unsupported") {
    return (
      <div
        className={`flex items-center justify-center bg-[#0A1628] rounded-2xl p-8 ${className}`}
      >
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-16 h-16 mx-auto rounded-full bg-[#1A3C5E] flex items-center justify-center">
            <svg
              className="w-8 h-8 text-[#8FA3B1]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white">
            Browser Not Supported
          </h3>
          <p className="text-sm text-[#8FA3B1]">
            This 3D tour requires WebGL 2.0. Please upgrade to a modern browser
            like Chrome, Firefox, or Safari 15+.
          </p>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div
        className={`flex items-center justify-center bg-[#0A1628] rounded-2xl p-8 ${className}`}
      >
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-16 h-16 mx-auto rounded-full bg-[#1A3C5E] flex items-center justify-center">
            <svg
              className="w-8 h-8 text-[#EF4444]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <p className="text-sm text-[#8FA3B1]">
            Tour content is temporarily unavailable.
          </p>
          <button
            onClick={handleRetry}
            className="px-6 py-3 bg-[#00D4AA] hover:bg-[#33DDBB] active:bg-[#00BF97] text-[#003D30] font-semibold text-sm rounded-xl transition-all duration-200 hover:shadow-[0_8px_24px_rgba(0,212,170,0.35)] active:scale-[0.98]"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative bg-[#0A1628] rounded-2xl overflow-hidden ${className}`}>
      {/* Loading overlay */}
      {state === "loading" && (
        <motion.div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0A1628]"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="space-y-6 text-center">
            <div className="w-12 h-12 mx-auto rounded-full border-2 border-[#00D4AA]/30 border-t-[#00D4AA] animate-spin" />
            <div className="w-64 space-y-2">
              <div className="h-2 bg-[#1A3C5E] rounded-full overflow-hidden">
                <motion.div
                  className="h-full progress-fill rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(progress, 100)}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <p className="text-xs text-[#8FA3B1]">
                Loading tour... {Math.round(Math.min(progress, 100))}%
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* SuperSplat viewer iframe */}
      <iframe
        ref={iframeRef}
        src={viewerUrl}
        className="w-full h-full border-0"
        style={{ minHeight: "400px" }}
        onLoad={handleIframeLoad}
        onError={handleIframeError}
        title="3D Property Tour"
        allow="fullscreen"
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  );
}
