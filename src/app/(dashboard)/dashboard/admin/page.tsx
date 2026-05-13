"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Job, Tour } from "@/types";

export default function AdminOverridePage() {
  const supabase = createClient();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<(Job & { tour: Tour })[]>([]);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [splatUrl, setSplatUrl] = useState("");
  const [stillsZipUrl, setStillsZipUrl] = useState("");
  const [mp4Url, setMp4Url] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    async function checkAdmin() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.user_metadata?.role === "admin") {
        setIsAdmin(true);
        // Fetch all jobs
        const { data } = await supabase
          .from("jobs")
          .select("*, tour:tours(*)")
          .order("created_at", { ascending: false });
        if (data) setJobs(data as unknown as (Job & { tour: Tour })[]);
      }
      setLoading(false);
    }
    checkAdmin();
  }, [supabase]);

  const validateUrl = (url: string): boolean => {
    if (!url) return true; // empty is ok for optional fields
    if (!url.startsWith("https://")) return false;
    if (url.length > 2048) return false;
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!selectedJob) {
      setError("Select a job first");
      return;
    }

    // Validate URLs
    if (!splatUrl || !splatUrl.startsWith("https://")) {
      setError("Splat URL is required and must start with https://");
      return;
    }
    if (!validateUrl(splatUrl) || !validateUrl(stillsZipUrl) || !validateUrl(mp4Url)) {
      setError("URLs must start with https:// and be under 2048 characters");
      return;
    }

    const job = jobs.find((j) => j.id === selectedJob);
    if (!job) return;

    // Premium requires all three URLs
    if (job.quality_tier === "premium") {
      if (!stillsZipUrl || !mp4Url) {
        setError("Premium tier requires splat URL, stills ZIP URL, and MP4 URL");
        return;
      }
    }

    setSubmitting(true);

    // Update job
    const { error: jobError } = await supabase
      .from("jobs")
      .update({
        status: "complete",
        splat_url: splatUrl,
        stills_zip_url: stillsZipUrl || null,
        mp4_url: mp4Url || null,
        completed_at: new Date().toISOString(),
      })
      .eq("id", selectedJob);

    if (jobError) {
      setError(jobError.message);
      setSubmitting(false);
      return;
    }

    // Update tour
    const { error: tourError } = await supabase
      .from("tours")
      .update({
        status: "complete",
        splat_url: splatUrl,
        stills_zip_url: stillsZipUrl || null,
        mp4_url: mp4Url || null,
      })
      .eq("id", job.tour_id);

    if (tourError) {
      setError(tourError.message);
      setSubmitting(false);
      return;
    }

    setSuccess("Tour marked as complete and accessible!");
    setSplatUrl("");
    setStillsZipUrl("");
    setMp4Url("");
    setSelectedJob(null);
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 rounded-full border-2 border-[#00D4AA]/30 border-t-[#00D4AA] animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="text-center py-20">
        <h1 className="text-xl font-semibold text-[#1C2B36]">Access Denied</h1>
        <p className="text-sm text-[#4A6070] mt-2">
          Admin privileges required.
        </p>
      </div>
    );
  }

  const selectedJobData = jobs.find((j) => j.id === selectedJob);

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#0D1B23]">Admin Override</h1>
        <p className="text-sm text-[#4A6070] mt-1">
          Manually attach processed output URLs to any job.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Job selector */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-[#1C2B36]">
            Select Job
          </label>
          <select
            value={selectedJob || ""}
            onChange={(e) => setSelectedJob(e.target.value || null)}
            className="w-full px-4 py-3 bg-white border border-[#E2E8ED] hover:border-[#8FA3B1] focus:border-[#00D4AA] rounded-xl text-[#1C2B36] outline-none transition-colors duration-150 focus:ring-2 focus:ring-[#00D4AA]/20 text-sm"
          >
            <option value="">Choose a job...</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.tour?.name || "Unknown"} — {job.status} ({job.quality_tier})
              </option>
            ))}
          </select>
        </div>

        {selectedJobData && (
          <p className="text-xs text-[#8FA3B1]">
            Tier: <strong className="capitalize">{selectedJobData.quality_tier}</strong>
            {selectedJobData.quality_tier === "premium" && " — all 3 URLs required"}
          </p>
        )}

        {/* Splat URL (always required) */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-[#1C2B36]">
            Splat URL <span className="text-[#EF4444]">*</span>
          </label>
          <input
            type="url"
            value={splatUrl}
            onChange={(e) => setSplatUrl(e.target.value)}
            required
            maxLength={2048}
            className="w-full px-4 py-3 bg-white border border-[#E2E8ED] hover:border-[#8FA3B1] focus:border-[#00D4AA] rounded-xl text-[#1C2B36] placeholder:text-[#8FA3B1] outline-none transition-colors duration-150 focus:ring-2 focus:ring-[#00D4AA]/20 text-sm font-mono"
            placeholder="https://d3pbxhjxgl65rj.cloudfront.net/output/..."
          />
        </div>

        {/* Stills ZIP URL */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-[#1C2B36]">
            Stills ZIP URL
            {selectedJobData?.quality_tier === "premium" && (
              <span className="text-[#EF4444]"> *</span>
            )}
          </label>
          <input
            type="url"
            value={stillsZipUrl}
            onChange={(e) => setStillsZipUrl(e.target.value)}
            maxLength={2048}
            className="w-full px-4 py-3 bg-white border border-[#E2E8ED] hover:border-[#8FA3B1] focus:border-[#00D4AA] rounded-xl text-[#1C2B36] placeholder:text-[#8FA3B1] outline-none transition-colors duration-150 focus:ring-2 focus:ring-[#00D4AA]/20 text-sm font-mono"
            placeholder="https://..."
          />
        </div>

        {/* MP4 URL */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-[#1C2B36]">
            MP4 URL
            {selectedJobData?.quality_tier === "premium" && (
              <span className="text-[#EF4444]"> *</span>
            )}
          </label>
          <input
            type="url"
            value={mp4Url}
            onChange={(e) => setMp4Url(e.target.value)}
            maxLength={2048}
            className="w-full px-4 py-3 bg-white border border-[#E2E8ED] hover:border-[#8FA3B1] focus:border-[#00D4AA] rounded-xl text-[#1C2B36] placeholder:text-[#8FA3B1] outline-none transition-colors duration-150 focus:ring-2 focus:ring-[#00D4AA]/20 text-sm font-mono"
            placeholder="https://..."
          />
        </div>

        {error && (
          <p className="text-sm text-[#EF4444] bg-[#EF4444]/10 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}
        {success && (
          <p className="text-sm text-[#10B981] bg-[#10B981]/10 px-3 py-2 rounded-lg">
            {success}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || !selectedJob || !splatUrl}
          className="w-full px-8 py-4 bg-[#00D4AA] hover:bg-[#33DDBB] active:bg-[#00BF97] text-[#003D30] font-semibold text-base rounded-2xl transition-all duration-200 ease-out hover:shadow-[0_8px_24px_rgba(0,212,170,0.35)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Updating..." : "Mark as Complete"}
        </button>
      </form>
    </div>
  );
}
