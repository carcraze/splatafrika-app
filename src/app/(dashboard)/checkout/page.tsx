"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { PRICING, formatCurrency } from "@/lib/constants";
import { motion } from "framer-motion";
import { CreditCard, Smartphone } from "lucide-react";

type PaymentMethod = "dodo" | "paystack";

export default function CheckoutPage() {
  const searchParams = useSearchParams();
  const tourId = searchParams.get("tour");

  const [method, setMethod] = useState<PaymentMethod>("paystack");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tier] = useState<"standard" | "premium">("standard"); // Would come from tour data

  const handlePayment = async () => {
    if (!tourId) {
      setError("No tour selected");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (method === "dodo") {
        // Redirect to Dodo hosted checkout
        const res = await fetch("/api/payments/dodo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tourId }),
        });

        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Payment failed");
          setLoading(false);
          return;
        }

        window.location.href = data.checkoutUrl;
      } else {
        // Paystack M-Pesa STK Push
        if (!phone) {
          setError("Phone number required for M-Pesa");
          setLoading(false);
          return;
        }

        // Validate phone format
        const phoneRegex = /^(254|0)(7[0-9]|1[0-1])[0-9]{7}$/;
        if (!phoneRegex.test(phone.replace(/\s/g, ""))) {
          setError("Please enter a valid Kenyan mobile number (e.g. 0712 345 678)");
          setLoading(false);
          return;
        }

        const res = await fetch("/api/payments/paystack", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tourId, phone, channel: "mobile_money" }),
        });

        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Payment failed");
          setLoading(false);
          return;
        }

        // Redirect to Paystack checkout or show STK Push waiting
        if (data.authorizationUrl) {
          window.location.href = data.authorizationUrl;
        }
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <motion.div
      className="max-w-md mx-auto space-y-8 py-8"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[#0D1B23]">Checkout</h1>
        <p className="text-sm text-[#4A6070] mt-1">
          Pay to unlock your property capture
        </p>
      </div>

      {/* Amount */}
      <div className="bg-white rounded-2xl border border-[#E2E8ED] p-6 text-center">
        <p className="text-sm text-[#8FA3B1]">Total</p>
        <p className="text-3xl font-bold text-[#0D1B23] mt-1">
          {formatCurrency(PRICING[tier].oneOff)}
        </p>
        <p className="text-xs text-[#8FA3B1] mt-1 capitalize">
          {PRICING[tier].label} — One-off
        </p>
      </div>

      {/* Payment method selector */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-[#1C2B36]">Payment Method</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setMethod("paystack")}
            className={`p-4 rounded-xl border-2 transition-all duration-200 text-left ${
              method === "paystack"
                ? "border-[#00D4AA] bg-[#00D4AA]/5"
                : "border-[#E2E8ED] hover:border-[#8FA3B1]"
            }`}
          >
            <Smartphone className="w-5 h-5 text-[#00D4AA] mb-2" />
            <p className="text-sm font-semibold text-[#1C2B36]">M-Pesa</p>
            <p className="text-xs text-[#8FA3B1]">STK Push</p>
          </button>
          <button
            type="button"
            onClick={() => setMethod("dodo")}
            className={`p-4 rounded-xl border-2 transition-all duration-200 text-left ${
              method === "dodo"
                ? "border-[#00D4AA] bg-[#00D4AA]/5"
                : "border-[#E2E8ED] hover:border-[#8FA3B1]"
            }`}
          >
            <CreditCard className="w-5 h-5 text-[#2563EB] mb-2" />
            <p className="text-sm font-semibold text-[#1C2B36]">Card</p>
            <p className="text-xs text-[#8FA3B1]">Visa / Mastercard</p>
          </button>
        </div>
      </div>

      {/* M-Pesa phone input */}
      {method === "paystack" && (
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-[#1C2B36]">
            M-Pesa Phone Number
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0712 345 678"
            className="w-full px-4 py-3 bg-white border border-[#E2E8ED] hover:border-[#8FA3B1] focus:border-[#00D4AA] rounded-xl text-[#1C2B36] placeholder:text-[#8FA3B1] outline-none transition-colors duration-150 focus:ring-2 focus:ring-[#00D4AA]/20 text-base"
          />
          <p className="text-xs text-[#8FA3B1]">
            You&apos;ll receive an STK Push on this number
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-sm text-[#EF4444] bg-[#EF4444]/10 px-3 py-2 rounded-lg">
          {error}
        </p>
      )}

      {/* Pay button */}
      <button
        onClick={handlePayment}
        disabled={loading || (method === "paystack" && !phone)}
        className="w-full px-8 py-4 bg-[#00D4AA] hover:bg-[#33DDBB] active:bg-[#00BF97] text-[#003D30] font-semibold text-base rounded-2xl transition-all duration-200 ease-out hover:shadow-[0_8px_24px_rgba(0,212,170,0.35)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading
          ? "Processing..."
          : method === "paystack"
            ? `Pay ${formatCurrency(PRICING[tier].oneOff)} via M-Pesa`
            : `Pay ${formatCurrency(PRICING[tier].oneOff)} via Card`}
      </button>
    </motion.div>
  );
}
