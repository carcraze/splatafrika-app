// SplatAfrika API Interfaces

export interface PresignRequest {
  tourId: string;
  frameCount: number;
  contentType: "image/png";
}

export interface PresignResponse {
  uploadId: string;
  urls: { partNumber: number; url: string }[];
  s3Key: string;
}

export interface JobStatusCallback {
  job_id: string;
  status: "processing" | "complete" | "failed" | "interrupted";
  splat_url?: string;
  stills_zip_url?: string;
  mp4_url?: string;
  error_message?: string;
  failed_step?: string;
  checkpoint_path?: string;
}

export interface DodoWebhookPayload {
  event_type: string;
  data: {
    payment_id: string;
    amount: number;
    currency: string;
    metadata: { tour_id: string; user_id: string };
    status: string;
  };
}

export interface PaystackWebhookPayload {
  event: string;
  data: {
    reference: string;
    amount: number;
    currency: string;
    channel: string;
    metadata: { tour_id: string; user_id: string };
    status: string;
  };
}
