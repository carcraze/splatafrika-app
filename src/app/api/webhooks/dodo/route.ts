import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import crypto from "crypto";

/**
 * POST /api/webhooks/dodo
 * Handles Dodo Payments webhook events.
 * Verifies HMAC signature, processes idempotently.
 */
export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("x-dodo-signature") || "";

  // Verify webhook signature
  const expectedSignature = crypto
    .createHmac("sha256", process.env.DODO_WEBHOOK_SECRET!)
    .update(body)
    .digest("hex");

  if (signature !== expectedSignature) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(body);
  const { event_type, data } = payload;

  const supabase = createServiceRoleClient();

  // Idempotency check — if payment already processed, return 200
  const { data: existingPayment } = await supabase
    .from("payments")
    .select("id, status")
    .eq("provider", "dodo")
    .eq("provider_reference", data.payment_id)
    .single();

  if (existingPayment?.status === "succeeded") {
    return NextResponse.json({ received: true, duplicate: true });
  }

  switch (event_type) {
    case "payment.succeeded": {
      const { tour_id } = data.metadata || {};

      // Update payment record
      await supabase
        .from("payments")
        .update({ status: "succeeded" })
        .eq("provider", "dodo")
        .eq("provider_reference", data.payment_id);

      // Update tour status to PAID → unlock capture
      if (tour_id) {
        await supabase
          .from("tours")
          .update({ status: "paid" })
          .eq("id", tour_id);
      }

      break;
    }

    case "payment.failed": {
      await supabase
        .from("payments")
        .update({ status: "failed" })
        .eq("provider", "dodo")
        .eq("provider_reference", data.payment_id);
      break;
    }

    case "subscription.active": {
      const { user_id, tier } = data.metadata || {};
      if (user_id) {
        await supabase.from("subscriptions").insert({
          user_id,
          provider: "dodo",
          provider_subscription_id: data.subscription_id || data.payment_id,
          plan_tier: tier || "standard",
          status: "active",
          scan_allowance: tier === "premium" ? 10 : 5,
          scans_used_this_period: 0,
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000
          ).toISOString(),
        });
      }
      break;
    }

    case "subscription.cancelled": {
      await supabase
        .from("subscriptions")
        .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
        .eq("provider", "dodo")
        .eq("provider_subscription_id", data.subscription_id || data.payment_id);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
