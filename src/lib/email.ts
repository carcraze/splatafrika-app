import nodemailer from "nodemailer";
import type { Tour } from "@/types";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 30000;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false, // TLS via STARTTLS
  auth: {
    user: process.env.SMTP_USERNAME,
    pass: process.env.SMTP_PASSWORD,
  },
});

const FROM = process.env.SMTP_FROM || "noreply@splatafrika.com";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://splatafrika.com";

/**
 * Send tour completion email.
 * Premium: includes HD stills + MP4 download links (or acknowledges missing outputs).
 * Standard: tour link only, no stills/MP4 links.
 */
export async function sendTourCompletionEmail(
  to: string,
  clientName: string,
  tour: Tour
): Promise<boolean> {
  const tourUrl = `${APP_URL}/tour/${tour.share_token}`;
  const cloudFrontDomain = process.env.AWS_CLOUDFRONT_DOMAIN || "";

  let premiumSection = "";
  if (tour.tier === "premium") {
    const missingOutputs: string[] = [];
    if (!tour.stills_zip_url) missingOutputs.push("HD Stills");
    if (!tour.mp4_url) missingOutputs.push("Cinematic MP4");

    if (missingOutputs.length === 0) {
      // All Premium outputs available
      premiumSection = `
        <div style="margin-top:24px;padding:16px;background:#f0fdf4;border-radius:12px;">
          <p style="font-weight:600;color:#065f46;margin:0 0 12px;">Premium Downloads:</p>
          <a href="https://${cloudFrontDomain}/${tour.stills_zip_url}" style="display:inline-block;padding:8px 16px;background:#00D4AA;color:#003D30;border-radius:8px;text-decoration:none;font-weight:600;margin-right:8px;">Download HD Stills</a>
          <a href="https://${cloudFrontDomain}/${tour.mp4_url}" style="display:inline-block;padding:8px 16px;background:#00D4AA;color:#003D30;border-radius:8px;text-decoration:none;font-weight:600;">Download MP4</a>
        </div>`;
    } else {
      // Some outputs missing — notify honestly
      premiumSection = `
        <div style="margin-top:24px;padding:16px;background:#fef3c7;border-radius:12px;">
          <p style="font-weight:600;color:#92400e;margin:0 0 8px;">Note:</p>
          <p style="color:#78350f;margin:0;">We were unable to generate ${missingOutputs.join(" and ")} for this scan. We will reprocess or issue a credit within 24 hours.</p>
          ${tour.stills_zip_url ? `<a href="https://${cloudFrontDomain}/${tour.stills_zip_url}" style="display:inline-block;margin-top:12px;padding:8px 16px;background:#00D4AA;color:#003D30;border-radius:8px;text-decoration:none;font-weight:600;">Download HD Stills</a>` : ""}
          ${tour.mp4_url ? `<a href="https://${cloudFrontDomain}/${tour.mp4_url}" style="display:inline-block;margin-top:12px;padding:8px 16px;background:#00D4AA;color:#003D30;border-radius:8px;text-decoration:none;font-weight:600;">Download MP4</a>` : ""}
        </div>`;
    }
  }

  const html = `
    <div style="font-family:'Sora',system-ui,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;">
      <h1 style="font-size:24px;font-weight:700;color:#0D1B23;margin:0 0 8px;">
        Your 3D Tour is Ready! 🎉
      </h1>
      <p style="color:#4A6070;margin:0 0 24px;">Hi ${clientName},</p>
      <p style="color:#1C2B36;line-height:1.6;">
        Your property tour for <strong>${tour.name}</strong> at <strong>${tour.address}</strong> has been processed and is ready to view.
      </p>
      <div style="margin:24px 0;">
        <a href="${tourUrl}" style="display:inline-block;padding:14px 28px;background:#00D4AA;color:#003D30;border-radius:16px;text-decoration:none;font-weight:600;font-size:16px;">
          View Your 3D Tour
        </a>
      </div>
      ${premiumSection}
      <hr style="border:none;border-top:1px solid #E2E8ED;margin:32px 0;" />
      <p style="color:#8FA3B1;font-size:12px;margin:0;">
        SplatAfrika — Hyperreal 3D Property Tours<br/>
        <a href="${APP_URL}/dashboard" style="color:#00D4AA;">Go to Dashboard</a>
      </p>
    </div>
  `;

  return sendWithRetry(to, `Your 3D Tour is Ready — ${tour.name}`, html);
}

/**
 * Send payment confirmation email.
 */
export async function sendPaymentConfirmationEmail(
  to: string,
  clientName: string,
  amount: number,
  currency: string,
  propertyName: string,
  tourUrl: string
): Promise<boolean> {
  const formattedAmount = new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(amount / 100); // Convert from smallest unit

  const html = `
    <div style="font-family:'Sora',system-ui,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;">
      <h1 style="font-size:24px;font-weight:700;color:#0D1B23;margin:0 0 8px;">
        Payment Confirmed ✓
      </h1>
      <p style="color:#4A6070;margin:0 0 24px;">Hi ${clientName},</p>
      <p style="color:#1C2B36;line-height:1.6;">
        Your payment of <strong>${formattedAmount}</strong> for <strong>${propertyName}</strong> has been confirmed.
      </p>
      <p style="color:#1C2B36;line-height:1.6;">
        You can now proceed to capture your property. Open the link below on your phone:
      </p>
      <div style="margin:24px 0;">
        <a href="${tourUrl}" style="display:inline-block;padding:14px 28px;background:#00D4AA;color:#003D30;border-radius:16px;text-decoration:none;font-weight:600;font-size:16px;">
          Start Capture
        </a>
      </div>
      <hr style="border:none;border-top:1px solid #E2E8ED;margin:32px 0;" />
      <p style="color:#8FA3B1;font-size:12px;margin:0;">
        SplatAfrika — Hyperreal 3D Property Tours
      </p>
    </div>
  `;

  return sendWithRetry(to, `Payment Confirmed — ${propertyName}`, html);
}

/**
 * Send email with retry logic (3 attempts, 30s intervals).
 * Logs every attempt. Alerts on exhaustion.
 */
async function sendWithRetry(
  to: string,
  subject: string,
  html: string
): Promise<boolean> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await transporter.sendMail({
        from: `SplatAfrika <${FROM}>`,
        to,
        subject,
        html,
      });
      console.log(`[EMAIL] Sent to ${to} (attempt ${attempt})`);
      return true;
    } catch (err) {
      console.error(
        `[EMAIL] Failed to send to ${to} (attempt ${attempt}/${MAX_RETRIES}):`,
        err
      );

      if (attempt >= MAX_RETRIES) {
        console.error(`[EMAIL] All ${MAX_RETRIES} attempts exhausted for ${to}`);
        return false;
      }

      // Wait before retry
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
  }
  return false;
}
