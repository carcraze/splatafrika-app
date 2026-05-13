import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * POST /api/webhooks/job-status
 * Called by EC2 GPU worker on job state transitions.
 * Auth: shared secret in Authorization header.
 */
export async function POST(request: Request) {
  // Verify shared secret
  const authHeader = request.headers.get("authorization") || "";
  const expectedSecret = process.env.JOB_WEBHOOK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!authHeader.includes(expectedSecret!)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    job_id,
    status,
    splat_url,
    stills_zip_url,
    mp4_url,
    error_message,
    failed_step,
    checkpoint_path,
  } = body;

  if (!job_id || !status) {
    return NextResponse.json({ error: "job_id and status required" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  // Update job record
  const jobUpdate: Record<string, unknown> = { status };

  if (status === "complete") {
    jobUpdate.splat_url = splat_url;
    jobUpdate.stills_zip_url = stills_zip_url || null;
    jobUpdate.mp4_url = mp4_url || null;
    jobUpdate.completed_at = new Date().toISOString();
  }

  if (status === "failed") {
    jobUpdate.error_message = error_message;
    jobUpdate.failed_step = failed_step || null;
    jobUpdate.completed_at = new Date().toISOString();
  }

  if (status === "interrupted") {
    jobUpdate.checkpoint_path = checkpoint_path || null;
  }

  if (status === "processing") {
    jobUpdate.started_at = new Date().toISOString();
  }

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .update(jobUpdate)
    .eq("id", job_id)
    .select("tour_id, quality_tier")
    .single();

  if (jobError) {
    return NextResponse.json({ error: jobError.message }, { status: 500 });
  }

  // Update tour status to match
  if (status === "complete" && job) {
    await supabase
      .from("tours")
      .update({
        status: "complete",
        splat_url,
        stills_zip_url: stills_zip_url || null,
        mp4_url: mp4_url || null,
      })
      .eq("id", job.tour_id);
  }

  if (status === "failed" && job) {
    await supabase
      .from("tours")
      .update({ status: "failed" })
      .eq("id", job.tour_id);
  }

  return NextResponse.json({ received: true, job_id, status });
}
