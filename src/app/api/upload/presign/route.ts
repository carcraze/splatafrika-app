import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";

const s3 = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function POST(request: Request) {
  try {
    // Verify auth
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { tourId, frameCount, contentType } = body;

    // Detailed validation with specific error messages
    if (!tourId || typeof tourId !== "string") {
      return NextResponse.json(
        { error: "Missing tourId. Please return to dashboard and try again." },
        { status: 400 }
      );
    }

    if (!frameCount || typeof frameCount !== "number" || frameCount < 1) {
      return NextResponse.json(
        { error: "Invalid frame count" },
        { status: 400 }
      );
    }

    if (frameCount > 600) {
      return NextResponse.json(
        { error: `Too many frames (${frameCount}). Maximum is 600.` },
        { status: 400 }
      );
    }

    // Verify tour belongs to user
    const { data: tour, error: tourError } = await supabase
      .from("tours")
      .select("id, user_id")
      .eq("id", tourId)
      .eq("user_id", user.id)
      .single();

    if (tourError || !tour) {
      return NextResponse.json(
        { error: "Tour not found or access denied" },
        { status: 404 }
      );
    }

    // Verify AWS credentials are configured
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_S3_INPUT_BUCKET) {
      return NextResponse.json(
        { error: "Storage not configured. Contact support." },
        { status: 500 }
      );
    }

    // Generate pre-signed URLs for each frame
    const jobId = uuidv4();
    const s3Key = `input/${jobId}/frames`;
    const urls = [];

    for (let i = 0; i < frameCount; i++) {
      const key = `${s3Key}/frame_${String(i).padStart(5, "0")}.jpg`;
      const command = new PutObjectCommand({
        Bucket: process.env.AWS_S3_INPUT_BUCKET,
        Key: key,
        ContentType: contentType || "image/jpeg",
      });

      const url = await getSignedUrl(s3, command, { expiresIn: 900 });
      urls.push({ partNumber: i, url });
    }

    return NextResponse.json({
      uploadId: jobId,
      urls,
      s3Key,
    });
  } catch (err) {
    console.error("Presign error:", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Internal error generating upload URLs",
      },
      { status: 500 }
    );
  }
}
