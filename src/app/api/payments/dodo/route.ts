import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDodoClient } from "@/lib/dodo";
import { PRICING } from "@/lib/constants";
import type { TourTier } from "@/types";

/**
 * POST /api/payments/dodo
 * Creates a Dodo Payments checkout session for international card payments.
 * Based on Dodo Payments official documentation (Context7).
 *
 * Dodo uses product-based checkout. We create a dynamic session with product_cart.
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

  try {
    const dodoClient = getDodoClient();
    // Create Dodo Payments session using the SDK
    // Dodo uses product_cart for dynamic checkout
    const session = await dodoClient.payments.create({
      payment_link: true,
      billing: {
        city: "Nairobi",
        country: "KE",
      },
      customer: {
        email: user.email!,
        name: user.user_metadata?.full_name || user.email!,
      },
      product_cart: [
        {
          product_id: process.env[`DODO_PRODUCT_${tier.toUpperCase()}_${paymentType.toUpperCase()}`] || "default",
          quantity: 1,
        },
      ],
      metadata: {
        tour_id: tourId,
        user_id: user.id,
        tier,
        payment_type: paymentType,
      },
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/tour/${tourId}?payment=success`,
    });

    // Create pending payment record
    await supabase.from("payments").insert({
      user_id: user.id,
      tour_id: tourId,
      provider: "dodo",
      provider_reference: session.payment_id || "pending",
      payment_type: paymentType,
      amount: amount * 100, // Store in smallest unit
      currency: "KES",
      status: "pending",
    });

    return NextResponse.json({
      checkoutUrl: session.payment_link,
      paymentId: session.payment_id,
    });
  } catch (err) {
    console.error("Dodo payment creation failed:", err);
    return NextResponse.json(
      { error: "Payment session creation failed" },
      { status: 500 }
    );
  }
}
