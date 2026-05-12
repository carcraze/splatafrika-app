// SplatAfrika Database Types — matches Supabase schema

export type TourTier = "standard" | "premium";

export type TourStatus =
  | "awaiting_payment"
  | "paid"
  | "uploading"
  | "processing"
  | "complete"
  | "failed";

export type JobStatus =
  | "pending"
  | "processing"
  | "complete"
  | "failed"
  | "interrupted";

export type PaymentProvider = "dodo" | "paystack";
export type PaymentType = "one_off" | "subscription";
export type PaymentStatus = "pending" | "succeeded" | "failed" | "refunded";
export type InvoiceStatus = "pending" | "generated" | "failed";
export type SubscriptionStatus = "active" | "past_due" | "cancelled" | "expired";
export type InstanceType = "spot" | "on_demand";

export interface Tour {
  id: string;
  user_id: string;
  name: string;
  address: string;
  property_type: string;
  tier: TourTier;
  status: TourStatus;
  share_token: string;
  splat_url: string | null;
  stills_zip_url: string | null;
  mp4_url: string | null;
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Job {
  id: string;
  tour_id: string;
  user_id: string;
  status: JobStatus;
  quality_tier: TourTier;
  s3_input_path: string;
  s3_output_path: string | null;
  splat_url: string | null;
  stills_zip_url: string | null;
  mp4_url: string | null;
  error_message: string | null;
  failed_step: string | null;
  checkpoint_path: string | null;
  recovery_attempts: number;
  max_recovery_attempts: number;
  instance_id: string | null;
  instance_type: InstanceType;
  cumulative_wall_clock_seconds: number;
  sla_breach_flag: boolean;
  salvaged_outputs: Record<string, string> | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  user_id: string;
  tour_id: string | null;
  provider: PaymentProvider;
  provider_reference: string;
  payment_type: PaymentType;
  amount: number; // smallest currency unit (cents for KES)
  currency: string;
  status: PaymentStatus;
  invoice_status: InvoiceStatus;
  invoice_url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  provider: PaymentProvider;
  provider_subscription_id: string;
  plan_tier: TourTier;
  status: SubscriptionStatus;
  scan_allowance: number;
  scans_used_this_period: number;
  current_period_start: string;
  current_period_end: string;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}
