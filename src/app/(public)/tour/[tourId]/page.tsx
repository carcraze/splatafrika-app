import type { Metadata } from "next";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { TourViewerPage } from "./TourViewerPage";
import type { Tour } from "@/types";

interface TourPageProps {
  params: Promise<{ tourId: string }>;
}

export async function generateMetadata({
  params,
}: TourPageProps): Promise<Metadata> {
  const { tourId } = await params;
  const supabase = createServiceRoleClient();

  const { data: tour } = await supabase
    .from("tours")
    .select("name, address, thumbnail_url, share_token")
    .eq("share_token", tourId)
    .single();

  if (!tour) {
    return { title: "Tour Not Found — SplatAfrika" };
  }

  const cloudFrontDomain = process.env.AWS_CLOUDFRONT_DOMAIN;
  const thumbnailUrl = tour.thumbnail_url
    ? `https://${cloudFrontDomain}/${tour.thumbnail_url}`
    : undefined;

  return {
    title: `${tour.name} — SplatAfrika 3D Tour`,
    description: tour.address,
    openGraph: {
      title: tour.name,
      description: tour.address,
      images: thumbnailUrl ? [{ url: thumbnailUrl }] : [],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: tour.name,
      description: tour.address,
      images: thumbnailUrl ? [thumbnailUrl] : [],
    },
  };
}

export default async function TourPage({ params }: TourPageProps) {
  const { tourId } = await params;
  const supabase = createServiceRoleClient();

  // Check if tour exists by share_token
  const { data: tour } = await supabase
    .from("tours")
    .select("*")
    .eq("share_token", tourId)
    .single<Tour>();

  if (!tour) {
    return <TourNotFound />;
  }

  if (tour.status !== "complete") {
    return <TourNotReady status={tour.status} />;
  }

  return <TourViewerPage tour={tour} />;
}

function TourNotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#0A1628]">
      <div className="text-center space-y-4 px-6 max-w-sm">
        <div className="w-20 h-20 mx-auto rounded-full bg-[#1A3C5E] flex items-center justify-center">
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
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-white">Tour Not Found</h1>
        <p className="text-sm text-[#8FA3B1]">
          This tour doesn&apos;t exist or has been removed.
        </p>
      </div>
    </main>
  );
}

function TourNotReady({ status }: { status: string }) {
  const messages: Record<string, { title: string; description: string }> = {
    awaiting_payment: {
      title: "Awaiting Payment",
      description: "This tour is waiting for payment to be confirmed.",
    },
    paid: {
      title: "Ready for Capture",
      description: "This tour is ready for the property capture.",
    },
    uploading: {
      title: "Uploading",
      description: "Property footage is being uploaded. Check back soon.",
    },
    processing: {
      title: "Processing",
      description:
        "This tour is still being processed. Check back in a few minutes.",
    },
    failed: {
      title: "Processing Failed",
      description: "There was a problem generating this tour.",
    },
  };

  const msg = messages[status] || messages.processing;

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#0A1628]">
      <div className="text-center space-y-4 px-6 max-w-sm">
        {status === "processing" && (
          <div className="w-16 h-16 mx-auto rounded-full border-2 border-[#00D4AA]/30 border-t-[#00D4AA] animate-spin" />
        )}
        {status === "failed" && (
          <div className="w-16 h-16 mx-auto rounded-full bg-[#1A3C5E] flex items-center justify-center">
            <svg
              className="w-8 h-8 text-[#EF4444]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
        )}
        <h1 className="text-xl font-semibold text-white">{msg.title}</h1>
        <p className="text-sm text-[#8FA3B1]">{msg.description}</p>
      </div>
    </main>
  );
}
