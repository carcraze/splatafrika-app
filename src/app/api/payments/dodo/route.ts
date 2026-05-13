import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PRICING } from "@/lib/constants";
import type { TourTier } from "@/types";

/**
 * POST /api/payments/dodo
 * Creates a Dodo Payments checkout session for international card payments.
 */
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tourId, paymentType = "one_off" } = await request.json();

  if (!tourId) {
    return NextResponse.json({ error: "tourId required" }, { status: 400 });
  }

  // Get tour to determine tier and amount
  const { data: tour } = await supabase
    .from("tours")
    .select("id, tier, name, status")
    .eq("id", tourId)
    .eq("user_id", user.id)
    .single();

  if (!tour) {
    return NextResponse.json({ error: "Tour not found" }, { status: 404 });
  }

  const tier = tour.tier as TourTier;
  const amount =
    paymentType === "subscription"
      ? PRICING[tier].monthly
      : PRICING[tier].oneOff;

  // Create Dodo Payments session
  const dodoResponse = await fetch("https://api.dodopayments.com/payments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.DODO_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: amount * 100, // Dodo expects smallest unit
      currency: "KES",
      description: `SplatAfrika ${PRICING[tier].label} — ${tour.name}`,
      metadata: {
        tour_id: tourId,
        user_id: user.id,
        tier,
        payment_type: paymentType,
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/tour/${tourId}?payment=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout?tour=${tourId}&cancelled=true`,
    }),
  });

  if (!dodoResponse.ok) {
    const err = await dodoResponse.text();
    return NextResponse.json(
      { error: "Payment session creation failed", details: err },
      { status: 500 }
    );
  }

  const session = await dodoResponse.json();

  // Create pending payment record
  await supabase.from("payments").insert({
    user_id: user.id,
    tour_id: tourId,
    provider: "dodo",
    provider_reference: session.id || session.payment_id,
    payment_type: paymentType,
    amount: amount * 100,
    currency: "KES",
    status: "pending",
  });

  return NextResponse.json({
    checkoutUrl: session.checkout_url || session.url,
    paymentId: session.id || session.payment_id,
  });
}
