import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { Webhook } from "standardwebhooks";

/**
 * POST /api/webhooks/dodo
 * Handles Dodo Payments webhook events.
 * Verification uses standardwebhooks library with headers:
 *   webhook-id, webhook-signature, webhook-timestamp
 * Based on Dodo Payments official documentation (Context7).
 */
export async function POST(request: Request) {
  const body = await request.text();

  // Dodo uses standardwebhooks for signature verification
  const webhookId = request.headers.get("webhook-id") || "";
  const webhookSignature = request.headers.get("webhook-signature") || "";
  const webhookTimestamp = request.headers.get("webhook-timestamp") || "";

  // Verify webhook signature
  try {
    const wh = new Webhook(process.env.DODO_WEBHOOK_SECRET!);
    wh.verify(body, {
      "webhook-id": webhookId,
      "webhook-signature": webhookSignature,
      "webhook-timestamp": webhookTimestamp,
    });
  } catch (err) {
    console.error("Dodo webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(body);
  const eventType = payload.type || payload.event_type;
  const data = payload.data;

  const supabase = createServiceRoleClient();

  // Idempotency check — if payment already processed, return 200
  const paymentRef = data.payment_id || data.subscription_id || data.id;
  if (paymentRef) {
    const { data: existingPayment } = await supabase
      .from("payments")
      .select("id, status")
      .eq("provider", "dodo")
      .eq("provider_reference", paymentRef)
      .single();

    if (existingPayment?.status === "succeeded") {
      return NextResponse.json({ received: true, duplicate: true });
    }
  }

  switch (eventType) {
    case "payment.succeeded": {
      const tourId = data.metadata?.tour_id;

      // Update payment record
      await supabase
        .from("payments")
        .update({ status: "succeeded" })
        .eq("provider", "dodo")
        .eq("provider_reference", paymentRef);

      // Update tour status to PAID → unlock capture
      if (tourId) {
        await supabase
          .from("tours")
          .update({ status: "paid" })
          .eq("id", tourId);
      }
      break;
    }

    case "payment.failed":
    case "payment.cancelled": {
      await supabase
        .from("payments")
        .update({ status: "failed" })
        .eq("provider", "dodo")
        .eq("provider_reference", paymentRef);
      break;
    }

    case "subscription.active":
    case "subscription.plan_changed": {
      const userId = data.metadata?.user_id || data.customer?.customer_id;
      const tier = data.metadata?.tier || "standard";

      if (userId) {
        await supabase.from("subscriptions").upsert(
          {
            user_id: userId,
            provider: "dodo",
            provider_subscription_id: data.subscription_id,
            plan_tier: tier,
            status: "active",
            scan_allowance: tier === "premium" ? 10 : 5,
            scans_used_this_period: 0,
            current_period_start: data.previous_billing_date || new Date().toISOString(),
            current_period_end: data.next_billing_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          },
          { onConflict: "provider,provider_subscription_id" }
        );
      }
      break;
    }

    case "subscription.cancelled":
    case "subscription.expired":
    case "subscription.failed": {
      await supabase
        .from("subscriptions")
        .update({
          status: eventType === "subscription.cancelled" ? "cancelled" : "expired",
          cancelled_at: new Date().toISOString(),
        })
        .eq("provider", "dodo")
        .eq("provider_subscription_id", data.subscription_id);
      break;
    }

    case "subscription.renewed": {
      await supabase
        .from("subscriptions")
        .update({
          status: "active",
          scans_used_this_period: 0,
          current_period_start: data.previous_billing_date,
          current_period_end: data.next_billing_date,
        })
        .eq("provider", "dodo")
        .eq("provider_subscription_id", data.subscription_id);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
