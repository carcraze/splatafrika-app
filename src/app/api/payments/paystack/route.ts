import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PRICING } from "@/lib/constants";
import type { TourTier } from "@/types";

/**
 * POST /api/payments/paystack
 * Initiates a Paystack charge (M-Pesa STK Push or card).
 */
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tourId, phone, channel = "mobile_money" } = await request.json();

  if (!tourId) {
    return NextResponse.json({ error: "tourId required" }, { status: 400 });
  }

  // Validate phone number for M-Pesa
  if (channel === "mobile_money") {
    if (!phone) {
      return NextResponse.json({ error: "Phone number required for M-Pesa" }, { status: 400 });
    }

    // Kenyan mobile format: 07XXXXXXXX or 01XXXXXXXX or 254XXXXXXXXX
    const phoneRegex = /^(254|0)(7[0-9]|1[0-1])[0-9]{7}$/;
    if (!phoneRegex.test(phone.replace(/\s/g, ""))) {
      return NextResponse.json(
        { error: "Please enter a valid Kenyan mobile number (e.g. 0712 345 678)" },
        { status: 400 }
      );
    }
  }

  // Get tour
  const { data: tour } = await supabase
    .from("tours")
    .select("id, tier, name")
    .eq("id", tourId)
    .eq("user_id", user.id)
    .single();

  if (!tour) {
    return NextResponse.json({ error: "Tour not found" }, { status: 404 });
  }

  const tier = tour.tier as TourTier;
  const amount = PRICING[tier].oneOff * 100; // Paystack expects kobo/cents

  // Normalize phone to 254 format
  const normalizedPhone = phone?.replace(/\s/g, "").replace(/^0/, "254");

  // Initialize Paystack transaction
  const paystackResponse = await fetch(
    "https://api.paystack.co/transaction/initialize",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: user.email,
        amount,
        currency: "KES",
        channels: [channel],
        mobile_money: channel === "mobile_money" ? { phone: normalizedPhone, provider: "mpesa" } : undefined,
        metadata: {
          tour_id: tourId,
          user_id: user.id,
          tier,
          custom_fields: [
            { display_name: "Property", variable_name: "property", value: tour.name },
          ],
        },
        callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/tour/${tourId}?payment=success`,
      }),
    }
  );

  if (!paystackResponse.ok) {
    const err = await paystackResponse.text();
    return NextResponse.json(
      { error: "Payment initiation failed", details: err },
      { status: 500 }
    );
  }

  const { data: paystackData } = await paystackResponse.json();

  // Create pending payment record
  await supabase.from("payments").insert({
    user_id: user.id,
    tour_id: tourId,
    provider: "paystack",
    provider_reference: paystackData.reference,
    payment_type: "one_off",
    amount,
    currency: "KES",
    status: "pending",
  });

  return NextResponse.json({
    authorizationUrl: paystackData.authorization_url,
    reference: paystackData.reference,
    accessCode: paystackData.access_code,
  });
}
