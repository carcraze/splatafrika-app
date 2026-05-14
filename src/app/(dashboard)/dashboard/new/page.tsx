"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PRICING, PROPERTY_TYPES, formatCurrency } from "@/lib/constants";
import type { TourTier } from "@/types";
import { motion } from "framer-motion";
import { Check } from "lucide-react";

export default function NewTourPage() {
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [propertyType, setPropertyType] = useState("residential");
  const [tier, setTier] = useState<TourTier>("standard");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side validation
    if (name.length > 100) {
      setError("Property name must be 100 characters or less");
      return;
    }
    if (address.length > 200) {
      setError("Address must be 200 characters or less");
      return;
    }

    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { data: tour, error: insertError } = await supabase
      .from("tours")
      .insert({
        user_id: user.id,
        name: name.trim(),
        address: address.trim(),
        property_type: propertyType,
        tier,
        // TODO: Re-enable payment flow when Dodo/Paystack keys are configured
        // status: "awaiting_payment",
        status: "paid", // BYPASS: Skip payment for testing
      })
      .select()
      .single();

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    // TODO: Re-enable payment redirect when ready
    // router.push(`/checkout?tour=${tour.id}`);
    router.push(`/capture?tour=${tour.id}&tier=${tier}`); // BYPASS: Go straight to capture
  };

  return (
    <motion.div
      className="max-w-2xl mx-auto space-y-8"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <div>
        <h1 className="text-2xl font-bold text-[#0D1B23]">New Tour</h1>
        <p className="text-sm text-[#4A6070] mt-1">
          Create a 3D property tour. You&apos;ll capture the video after
          payment.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Property Name */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-[#1C2B36] tracking-wide">
            Property Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
            className="w-full px-4 py-3 bg-white border border-[#E2E8ED] hover:border-[#8FA3B1] focus:border-[#00D4AA] rounded-xl text-[#1C2B36] placeholder:text-[#8FA3B1] outline-none transition-colors duration-150 focus:ring-2 focus:ring-[#00D4AA]/20 text-base"
            placeholder="e.g. Kilimani 3BR Apartment"
          />
          <p className="text-xs text-[#8FA3B1]">{name.length}/100</p>
        </div>

        {/* Address */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-[#1C2B36] tracking-wide">
            Property Address
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
            maxLength={200}
            className="w-full px-4 py-3 bg-white border border-[#E2E8ED] hover:border-[#8FA3B1] focus:border-[#00D4AA] rounded-xl text-[#1C2B36] placeholder:text-[#8FA3B1] outline-none transition-colors duration-150 focus:ring-2 focus:ring-[#00D4AA]/20 text-base"
            placeholder="e.g. Argwings Kodhek Rd, Kilimani, Nairobi"
          />
          <p className="text-xs text-[#8FA3B1]">{address.length}/200</p>
        </div>

        {/* Property Type */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-[#1C2B36] tracking-wide">
            Property Type
          </label>
          <select
            value={propertyType}
            onChange={(e) => setPropertyType(e.target.value)}
            className="w-full px-4 py-3 bg-white border border-[#E2E8ED] hover:border-[#8FA3B1] focus:border-[#00D4AA] rounded-xl text-[#1C2B36] outline-none transition-colors duration-150 focus:ring-2 focus:ring-[#00D4AA]/20 text-base capitalize"
          >
            {PROPERTY_TYPES.map((type) => (
              <option key={type} value={type} className="capitalize">
                {type}
              </option>
            ))}
          </select>
        </div>

        {/* Quality Tier Selection */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-[#1C2B36] tracking-wide">
            Quality Tier
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TierCard
              tier="standard"
              selected={tier === "standard"}
              onSelect={() => setTier("standard")}
            />
            <TierCard
              tier="premium"
              selected={tier === "premium"}
              onSelect={() => setTier("premium")}
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-[#EF4444] bg-[#EF4444]/10 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || !name.trim() || !address.trim()}
          className="w-full px-8 py-4 bg-[#00D4AA] hover:bg-[#33DDBB] active:bg-[#00BF97] text-[#003D30] font-semibold text-base rounded-2xl transition-all duration-200 ease-out hover:shadow-[0_8px_24px_rgba(0,212,170,0.35)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading
            ? "Creating..."
            : `Create Tour — ${formatCurrency(PRICING[tier].oneOff)}`}
        </button>
      </form>
    </motion.div>
  );
}

function TierCard({
  tier,
  selected,
  onSelect,
}: {
  tier: TourTier;
  selected: boolean;
  onSelect: () => void;
}) {
  const config = PRICING[tier];
  const features =
    tier === "standard"
      ? ["Interactive 3D walkthrough", "~8 min processing", "Shareable browser link"]
      : [
          "Everything in Standard",
          "30k iterations (2x detail)",
          "HD still renders (8K)",
          "Cinematic MP4 flythrough",
          "~18 min processing",
        ];

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative text-left p-5 rounded-2xl border-2 transition-all duration-200 ${
        selected
          ? "border-[#00D4AA] bg-[#00D4AA]/5 shadow-[0_0_0_1px_rgba(0,212,170,0.3)]"
          : "border-[#E2E8ED] bg-white hover:border-[#8FA3B1]"
      }`}
    >
      {selected && (
        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-[#00D4AA] flex items-center justify-center">
          <Check className="w-3 h-3 text-[#003D30]" />
        </div>
      )}
      <div className="space-y-3">
        <div>
          <h3 className="font-semibold text-[#1C2B36]">{config.label}</h3>
          <p className="text-lg font-bold text-[#0D1B23] mt-1">
            {formatCurrency(config.oneOff)}
            <span className="text-xs font-normal text-[#8FA3B1] ml-1">
              one-off
            </span>
          </p>
        </div>
        <ul className="space-y-1.5">
          {features.map((f) => (
            <li
              key={f}
              className="text-xs text-[#4A6070] flex items-start gap-2"
            >
              <span className="text-[#00D4AA] mt-0.5">•</span>
              {f}
            </li>
          ))}
        </ul>
      </div>
    </button>
  );
}
