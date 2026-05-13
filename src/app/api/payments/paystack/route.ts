import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PRICING } from "@/lib/constants";
import type { TourTier } from "@/types";

/**
 * POST /api/payments/paystack
 * Initiates a Paystack charge for M-Pesa STK Push or card.
 * Based on Paystack official documentation (Context7):
 *   - POST https://api.paystack.co/charge with mobile_money.provider = "mpesa"
 *   - Phone must include country code: 254XXXXXXXXX
 *   - Response includes reference and display_text
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
      return NextResponse.json(
        { error: "Phone number required for M-Pesa" },
        { status: 400 }
      );
    }

    // Kenyan mobile format: 07XXXXXXXX or 01XXXXXXXX or 254XXXXXXXXX
    const cleanPhone = phone.replace(/[\s\-+]/g, "");
    const phoneRegex = /^(254|0)(7[0-9]|1[0-1])[0-9]{7}$/;
    if (!phoneRegex.test(cleanPhone)) {
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
  const amount = PRICING[tier].oneOff * 100; // Paystack expects smallest unit (cents)

  // Normalize phone to 254 format (Paystack requires country code)
  const normalizedPhone = phone
    ?.replace(/[\s\-+]/g, "")
    .replace(/^0/, "254");

  try {
    if (channel === "mobile_money") {
      // Use Paystack Charge API for M-Pesa STK Push
      // Per docs: POST /charge with mobile_money.provider = "mpesa"
      const chargeResponse = await fetch("https://api.paystack.co/charge", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount,
          email: user.email,
          currency: "KES",
          mobile_money: {
            phone: normalizedPhone,
            provider: "mpesa",
          },
          metadata: {
            tour_id: tourId,
            user_id: user.id,
            tier,
            custom_fields: [
              {
                display_name: "Property",
                variable_name: "property",
                value: tour.name,
              },
            ],
          },
        }),
      });

      const chargeData = await chargeResponse.json();

      if (!chargeData.status) {
        return NextResponse.json(
          { error: chargeData.message || "M-Pesa charge failed" },
          { status: 400 }
        );
      }

      // Create pending payment record
      await supabase.from("payments").insert({
        user_id: user.id,
        tour_id: tourId,
        provider: "paystack",
        provider_reference: chargeData.data.reference,
        payment_type: "one_off",
        amount,
        currency: "KES",
        status: "pending",
      });

      return NextResponse.json({
        reference: chargeData.data.reference,
        status: chargeData.data.status, // "pay_offline" or "send_otp"
        displayText: chargeData.data.display_text,
      });
    } else {
      // Card payment — use Initialize Transaction (redirect-based)
      const initResponse = await fetch(
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
            metadata: {
              tour_id: tourId,
              user_id: user.id,
              tier,
            },
            callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/tour/${tourId}?payment=success`,
          }),
        }
      );

      const initData = await initResponse.json();

      if (!initData.status) {
        return NextResponse.json(
          { error: initData.message || "Payment initialization failed" },
          { status: 400 }
        );
      }

      // Create pending payment record
      await supabase.from("payments").insert({
        user_id: user.id,
        tour_id: tourId,
        provider: "paystack",
        provider_reference: initData.data.reference,
        payment_type: "one_off",
        amount,
        currency: "KES",
        status: "pending",
      });

      return NextResponse.json({
        authorizationUrl: initData.data.authorization_url,
        reference: initData.data.reference,
        accessCode: initData.data.access_code,
      });
    }
  } catch (err) {
    console.error("Paystack payment failed:", err);
    return NextResponse.json(
      { error: "Payment initiation failed" },
      { status: 500 }
    );
  }
}
