/**
 * SplatAfrika Data Lifecycle Lambda
 * Scheduled daily via CloudWatch Events.
 * - Marks stuck jobs (PROCESSING/INTERRUPTED >14 days) as FAILED
 * - Cleans up orphaned data
 *
 * Runtime: Node.js 20.x
 * Trigger: CloudWatch Events rule (rate(1 day))
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

export async function handler() {
  console.log("[LIFECYCLE] Starting daily cleanup...");

  const cutoffDate = new Date(Date.now() - FOURTEEN_DAYS_MS).toISOString();
  let cleanedCount = 0;

  // Find stuck jobs (PROCESSING or INTERRUPTED for >14 days)
  const stuckJobsResponse = await supabaseQuery(
    `id, tour_id, status, created_at`,
    "jobs",
    `status=in.(processing,interrupted)&created_at=lt.${cutoffDate}`
  );

  if (stuckJobsResponse && stuckJobsResponse.length > 0) {
    console.log(`[LIFECYCLE] Found ${stuckJobsResponse.length} stuck jobs`);

    for (const job of stuckJobsResponse) {
      // Mark job as FAILED
      await supabaseUpdate("jobs", job.id, {
        status: "failed",
        error_message: `Job stuck for >14 days. Automatically marked as failed by lifecycle cleanup.`,
        completed_at: new Date().toISOString(),
      });

      // Update tour status
      await supabaseUpdate("tours", job.tour_id, { status: "failed" });

      cleanedCount++;
      console.log(`[LIFECYCLE] Cleaned job ${job.id} (was ${job.status} since ${job.created_at})`);
    }
  }

  console.log(`[LIFECYCLE] Cleanup complete. ${cleanedCount} jobs cleaned.`);
  return { statusCode: 200, body: JSON.stringify({ cleaned: cleanedCount }) };
}

async function supabaseQuery(select, table, filter) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=${select}&${filter}`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  });
  return res.json();
}

async function supabaseUpdate(table, id, data) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`;
  await fetch(url, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(data),
  });
}
