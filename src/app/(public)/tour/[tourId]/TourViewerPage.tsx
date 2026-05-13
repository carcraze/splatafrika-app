"use client";

import { useState } from "react";
import { Check, Copy, Code } from "lucide-react";
import { SplatViewer } from "@/components/viewer/SplatViewer";
import { StillsGallery } from "@/components/viewer/StillsGallery";
import { CinematicPlayer } from "@/components/viewer/CinematicPlayer";
import type { Tour } from "@/types";

interface TourViewerPageProps {
  tour: Tour;
}

export function TourViewerPage({ tour }: TourViewerPageProps) {
  const [copied, setCopied] = useState(false);
  const [showEmbed, setShowEmbed] = useState(false);

  const cloudFrontDomain = process.env.NEXT_PUBLIC_CLOUDFRONT_DOMAIN || "";
  const splatUrl = tour.splat_url
    ? `https://${cloudFrontDomain}/${tour.splat_url}`
    : "";

  const publicUrl =
    typeof window !== "undefined"
      ? window.location.href
      : `${process.env.NEXT_PUBLIC_APP_URL}/tour/${tour.share_token}`;

  const embedCode = `<iframe src="${publicUrl}" width="100%" style="aspect-ratio:16/9;border:none;border-radius:16px;" allow="fullscreen"></iframe>`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard failed — show URL in fallback
      setShowEmbed(true);
    }
  };

  // Parse stills from ZIP URL (individual stills would come from a separate field in production)
  const stills: string[] = [];

  return (
    <main className="min-h-screen bg-[#0A1628]">
      {/* Header */}
      <header className="px-4 py-4 sm:px-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">
            Splat<span className="text-[#00D4AA]">Afrika</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyLink}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#8FA3B1] hover:text-[#00D4AA] border border-white/10 hover:border-[#00D4AA] rounded-xl transition-all duration-200"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-[#10B981]" />
                <span className="text-[#10B981]">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Share Link
              </>
            )}
          </button>
          <button
            onClick={() => setShowEmbed(!showEmbed)}
            className="p-2 text-[#8FA3B1] hover:text-[#00D4AA] border border-white/10 hover:border-[#00D4AA] rounded-xl transition-all duration-200"
            aria-label="Get embed code"
          >
            <Code className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Embed code panel */}
      {showEmbed && (
        <div className="mx-4 sm:mx-6 mb-4 p-4 bg-[#0F2040] rounded-xl border border-white/10">
          <p className="text-xs text-[#8FA3B1] mb-2">Embed this tour:</p>
          <input
            type="text"
            readOnly
            value={embedCode}
            className="w-full px-3 py-2 bg-[#0A1628] border border-white/10 rounded-lg text-xs text-[#8FA3B1] font-mono select-all"
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
        </div>
      )}

      {/* Tour info */}
      <div className="px-4 sm:px-6 pb-4">
        <h2 className="text-xl font-semibold text-white">{tour.name}</h2>
        <p className="text-sm text-[#8FA3B1] mt-1">{tour.address}</p>
        {tour.tier === "premium" && (
          <span className="inline-flex items-center gap-1 mt-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#003D30] text-[#00D4AA] border border-[#00D4AA]/30">
            ✦ Premium Hyperreal
          </span>
        )}
      </div>

      {/* 3D Viewer */}
      <div className="px-4 sm:px-6">
        <SplatViewer
          splatUrl={splatUrl}
          className="w-full aspect-video sm:aspect-[16/10] rounded-2xl"
        />
      </div>

      {/* Premium content — conditional rendering, NOT CSS hide (REQ-10.3) */}
      {tour.tier === "premium" && (
        <div className="px-4 sm:px-6 py-8 space-y-8">
          <StillsGallery stills={stills} stillsZipUrl={tour.stills_zip_url || undefined} />
          {tour.mp4_url && (
            <CinematicPlayer
              mp4Url={`https://${cloudFrontDomain}/${tour.mp4_url}`}
            />
          )}
        </div>
      )}
    </main>
  );
}
