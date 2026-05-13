"use client";

import { useMemo } from "react";

interface FramePreviewProps {
  frames: Blob[];
  onConfirm: () => void;
  onReRecord: () => void;
}

export function FramePreview({ frames, onConfirm, onReRecord }: FramePreviewProps) {
  const frameUrls = useMemo(
    () => frames.map((blob) => URL.createObjectURL(blob)),
    [frames]
  );

  return (
    <div className="flex-1 flex flex-col p-4">
      {/* Header */}
      <div className="text-center mb-4">
        <h2 className="text-lg font-semibold text-white">
          Review Frames ({frames.length})
        </h2>
        <p className="text-xs text-[#8FA3B1] mt-1">
          Confirm the capture quality before uploading
        </p>
      </div>

      {/* Frame grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {frameUrls.map((url, i) => (
            <div key={i} className="aspect-video rounded-lg overflow-hidden bg-[#1A3C5E]">
              <img
                src={url}
                alt={`Frame ${i + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Actions — bottom anchored */}
      <div className="pt-4 pb-6 space-y-3">
        <button
          onClick={onConfirm}
          className="w-full px-8 py-4 bg-[#00D4AA] hover:bg-[#33DDBB] active:bg-[#00BF97] text-[#003D30] font-semibold text-base rounded-2xl transition-all duration-200 ease-out hover:shadow-[0_8px_24px_rgba(0,212,170,0.35)] active:scale-[0.98]"
        >
          Confirm & Upload
        </button>
        <button
          onClick={onReRecord}
          className="w-full px-6 py-3 text-[#8FA3B1] hover:text-white text-sm font-medium transition-colors"
        >
          Re-record
        </button>
      </div>
    </div>
  );
}
