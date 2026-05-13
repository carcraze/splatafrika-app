import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Tour } from "@/types";
import { TOUR_STATUS_CONFIG } from "@/lib/constants";
import { Plus } from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: tours } = await supabase
    .from("tours")
    .select("*")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })
    .returns<Tour[]>();

  if (!tours || tours.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#0D1B23]">My Tours</h1>
        <a
          href="/dashboard/new"
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#00D4AA] hover:bg-[#33DDBB] active:bg-[#00BF97] text-[#003D30] font-semibold text-sm rounded-xl transition-all duration-200 hover:shadow-[0_8px_24px_rgba(0,212,170,0.35)] active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          New Tour
        </a>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tours.map((tour) => (
          <TourCard key={tour.id} tour={tour} />
        ))}
      </div>
    </div>
  );
}

function TourCard({ tour }: { tour: Tour }) {
  const statusConfig = TOUR_STATUS_CONFIG[tour.status];
  const statusColors: Record<string, string> = {
    gray: "bg-gray-50 text-gray-700 border-gray-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    red: "bg-red-50 text-red-700 border-red-200",
  };

  return (
    <a
      href={`/dashboard/tour/${tour.id}`}
      className="bg-white rounded-2xl border border-[#E2E8ED] p-5 shadow-sm hover:shadow-md transition-shadow duration-200 block"
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <h3 className="font-semibold text-[#1C2B36] text-base line-clamp-1">
            {tour.name}
          </h3>
          {tour.tier === "premium" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#003D30] text-[#00D4AA] border border-[#00D4AA]/30 shrink-0">
              ✦ Premium
            </span>
          )}
        </div>
        <p className="text-sm text-[#4A6070] line-clamp-1">{tour.address}</p>
        <div className="flex items-center justify-between">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusColors[statusConfig.color]}`}
          >
            {tour.status === "processing" && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            )}
            {statusConfig.label}
          </span>
          <span className="text-xs text-[#8FA3B1]">
            {new Date(tour.created_at).toLocaleDateString()}
          </span>
        </div>
      </div>
    </a>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-20 h-20 rounded-full bg-[#F1F4F6] flex items-center justify-center mb-6">
        <svg
          className="w-10 h-10 text-[#8FA3B1]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-[#1C2B36] mb-2">
        No tours yet
      </h2>
      <p className="text-sm text-[#4A6070] mb-6 max-w-xs">
        Create your first 3D property tour. Capture on your phone, share as a
        browser link.
      </p>
      <a
        href="/dashboard/new"
        className="inline-flex items-center gap-2 px-8 py-4 bg-[#00D4AA] hover:bg-[#33DDBB] active:bg-[#00BF97] text-[#003D30] font-semibold text-base rounded-2xl transition-all duration-200 hover:shadow-[0_8px_24px_rgba(0,212,170,0.35)] active:scale-[0.98]"
      >
        <Plus className="w-5 h-5" />
        Create First Tour
      </a>
    </div>
  );
}
