// SplatAfrika Shared Constants

import type { TourTier } from "@/types";

/** Pricing in KES (Kenyan Shillings) */
export const PRICING = {
  standard: {
    oneOff: 5000,
    monthly: 8000,
    label: "Standard Tour",
  },
  premium: {
    oneOff: 15000,
    monthly: 25000,
    label: "Premium Hyperreal",
  },
} as const satisfies Record<TourTier, { oneOff: number; monthly: number; label: string }>;

/** Tour status display config */
export const TOUR_STATUS_CONFIG = {
  awaiting_payment: { label: "Awaiting Payment", color: "gray" },
  paid: { label: "Paid", color: "blue" },
  uploading: { label: "Uploading", color: "blue" },
  processing: { label: "Processing", color: "amber" },
  complete: { label: "Ready", color: "emerald" },
  failed: { label: "Failed", color: "red" },
} as const;

/** Job status display config */
export const JOB_STATUS_CONFIG = {
  pending: { label: "Pending", color: "gray" },
  processing: { label: "Processing", color: "amber" },
  complete: { label: "Complete", color: "emerald" },
  failed: { label: "Failed", color: "red" },
  interrupted: { label: "Interrupted", color: "amber" },
} as const;

/** Property types */
export const PROPERTY_TYPES = [
  "residential",
  "commercial",
  "airbnb",
  "construction",
  "land",
  "other",
] as const;

/** Capture constraints */
export const CAPTURE = {
  MAX_RECORDING_SECONDS: 600, // 10 minutes
  MIN_RECORDING_SECONDS: 30,
  MAX_EXTRACTION_SECONDS: 300, // 5 minutes of frames
  FRAMES_PER_SECOND: 1,
  MAX_VIDEO_SIZE_MB: 500,
} as const;

/** Upload constraints */
export const UPLOAD = {
  MAX_RETRIES_PER_CHUNK: 3,
  INITIAL_BACKOFF_MS: 2000,
  MAX_FRAME_SIZE_MB: 5,
  PRESIGN_EXPIRY_SECONDS: 900, // 15 minutes
} as const;

/** Format KES currency */
export function formatCurrency(amount: number, currency = "KES"): string {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
