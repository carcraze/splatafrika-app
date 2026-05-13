import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Tour, Job } from "@/types";
import { TOUR_STATUS_CONFIG } from "@/lib/constants";
import { Download, ExternalLink } from "lucide-react";
import { CopyLinkButton } from "./CopyLinkButton";

interface TourDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function TourDetailPage({ params }: TourDetailPageProps) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: tour } = await supabase
    .from("tours")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single<Tour>();

  if (!tour) redirect("/dashboard");

  const { data: job } = await supabase
    .from("jobs")
    .select("*")
    .eq("tour_id", tour.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single<Job>();

  const statusConfig = TOUR_STATUS_CONFIG[tour.status];
  const isComplete = tour.status === "complete";
  const publicUrl = `${process.env.NEXT_PUBLIC_APP_URL}/tour/${tour.share_token}`;
  const embedCode = `<iframe src="${publicUrl}" width="100%" style="aspect-ratio:16/9;border:none;border-radius:16px;" allow="fullscreen"></iframe>`;

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0D1B23]">{tour.name}</h1>
          <p className="text-sm text-[#4A6070] mt-1">{tour.address}</p>
        </div>
        <div className="flex items-center gap-3">
          {tour.tier === "premium" && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#003D30] text-[#00D4AA] border border-[#00D4AA]/30">
              ✦ Premium
            </span>
          )}
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
              statusConfig.color === "emerald"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : statusConfig.color === "amber"
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : statusConfig.color === "red"
                    ? "bg-red-50 text-red-700 border-red-200"
                    : "bg-gray-50 text-gray-700 border-gray-200"
            }`}
          >
            {tour.status === "processing" && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            )}
            {statusConfig.label}
          </span>
        </div>
      </div>

      {/* Viewer preview — only for complete tours */}
      {isComplete && tour.splat_url && (
        <div className="bg-white rounded-2xl border border-[#E2E8ED] overflow-hidden">
          <div className="aspect-video bg-[#0A1628] flex items-center justify-center">
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#00D4AA] hover:bg-[#33DDBB] text-[#003D30] font-semibold text-sm rounded-xl transition-all duration-200"
            >
              <ExternalLink className="w-4 h-4" />
              Open 3D Tour
            </a>
          </div>
        </div>
      )}

      {/* Processing status for non-complete tours */}
      {!isComplete && (
        <div className="bg-white rounded-2xl border border-[#E2E8ED] p-6">
          <div className="text-center space-y-3">
            {tour.status === "processing" && (
              <div className="w-12 h-12 mx-auto rounded-full border-2 border-[#00D4AA]/30 border-t-[#00D4AA] animate-spin" />
            )}
            <p className="text-sm text-[#4A6070]">
              {tour.status === "processing"
                ? "Your tour is being processed. This usually takes 8-18 minutes."
                : tour.status === "failed"
                  ? `Processing failed${job?.error_message ? `: ${job.error_message}` : ""}`
                  : "Waiting for next step..."}
            </p>
          </div>
        </div>
      )}

      {/* Share & Embed — only for complete tours */}
      {isComplete && (
        <div className="bg-white rounded-2xl border border-[#E2E8ED] p-5 sm:p-6 space-y-4">
          <h2 className="text-lg font-semibold text-[#1C2B36]">
            Share & Embed
          </h2>

          {/* Share link */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-[#4A6070]">
              Public Link
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={publicUrl}
                className="flex-1 px-4 py-2.5 bg-[#F8FAFB] border border-[#E2E8ED] rounded-xl text-sm text-[#1C2B36] font-mono select-all"
              />
              <CopyLinkButton url={publicUrl} />
            </div>
          </div>

          {/* Embed code */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-[#4A6070]">
              Embed Code
            </label>
            <input
              type="text"
              readOnly
              value={embedCode}
              className="w-full px-4 py-2.5 bg-[#F8FAFB] border border-[#E2E8ED] rounded-xl text-xs text-[#4A6070] font-mono select-all"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
          </div>
        </div>
      )}

      {/* Premium downloads — only for complete Premium tours */}
      {isComplete && tour.tier === "premium" && (
        <div className="bg-white rounded-2xl border border-[#E2E8ED] p-5 sm:p-6 space-y-4">
          <h2 className="text-lg font-semibold text-[#1C2B36]">Downloads</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            {tour.stills_zip_url && (
              <a
                href={tour.stills_zip_url}
                download
                className="inline-flex items-center gap-2 px-5 py-3 border border-[#E2E8ED] hover:border-[#00D4AA] text-[#4A6070] hover:text-[#00D4AA] rounded-xl font-medium text-sm transition-all duration-200"
              >
                <Download className="w-4 h-4" />
                HD Stills (ZIP)
              </a>
            )}
            {tour.mp4_url && (
              <a
                href={tour.mp4_url}
                download
                className="inline-flex items-center gap-2 px-5 py-3 border border-[#E2E8ED] hover:border-[#00D4AA] text-[#4A6070] hover:text-[#00D4AA] rounded-xl font-medium text-sm transition-all duration-200"
              >
                <Download className="w-4 h-4" />
                Cinematic MP4
              </a>
            )}
          </div>
        </div>
      )}

      {/* Tour details */}
      <div className="bg-white rounded-2xl border border-[#E2E8ED] p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-[#1C2B36] mb-4">Details</h2>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-[#8FA3B1]">Property Type</dt>
            <dd className="text-[#1C2B36] font-medium capitalize">
              {tour.property_type}
            </dd>
          </div>
          <div>
            <dt className="text-[#8FA3B1]">Quality Tier</dt>
            <dd className="text-[#1C2B36] font-medium capitalize">
              {tour.tier}
            </dd>
          </div>
          <div>
            <dt className="text-[#8FA3B1]">Created</dt>
            <dd className="text-[#1C2B36] font-medium">
              {new Date(tour.created_at).toLocaleDateString()}
            </dd>
          </div>
          <div>
            <dt className="text-[#8FA3B1]">Tour ID</dt>
            <dd className="text-[#1C2B36] font-mono text-xs">
              {tour.share_token}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
