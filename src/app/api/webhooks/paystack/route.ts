import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import crypto from "crypto";

/**
 * POST /api/webhooks/paystack
 * Handles Paystack webhook events (charge.success, charge.failed).
 * Verifies HMAC SHA-512 signature, processes idempotently.
 */
export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("x-paystack-signature") || "";

  // Verify webhook signature (SHA-512 HMAC)
  const expectedSignature = crypto
    .createHmac("sha512", process.env.PAYSTACK_WEBHOOK_SECRET!)
    .update(body)
    .digest("hex");

  if (signature !== expectedSignature) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(body);
  const { event, data } = payload;

  const supabase = createServiceRoleClient();

  // Idempotency check
  const { data: existingPayment } = await supabase
    .from("payments")
    .select("id, status")
    .eq("provider", "paystack")
    .eq("provider_reference", data.reference)
    .single();

  if (existingPayment?.status === "succeeded") {
    return NextResponse.json({ received: true, duplicate: true });
  }

  switch (event) {
    case "charge.success": {
      const { tour_id } = data.metadata || {};

      // Update payment record
      await supabase
        .from("payments")
        .update({ status: "succeeded" })
        .eq("provider", "paystack")
        .eq("provider_reference", data.reference);

      // Update tour status to PAID → unlock capture
      if (tour_id) {
        await supabase
          .from("tours")
          .update({ status: "paid" })
          .eq("id", tour_id);
      }

      break;
    }

    case "charge.failed": {
      await supabase
        .from("payments")
        .update({ status: "failed" })
        .eq("provider", "paystack")
        .eq("provider_reference", data.reference);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
