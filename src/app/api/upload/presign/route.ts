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
  // Verify auth
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { tourId, frameCount, contentType } = body;

  if (!tourId || !frameCount || frameCount > 600) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Verify tour belongs to user
  const { data: tour } = await supabase
    .from("tours")
    .select("id")
    .eq("id", tourId)
    .eq("user_id", user.id)
    .single();

  if (!tour) {
    return NextResponse.json({ error: "Tour not found" }, { status: 404 });
  }

  // Generate pre-signed URLs for each frame
  const jobId = uuidv4();
  const s3Key = `input/${jobId}/frames`;
  const urls = [];

  for (let i = 0; i < frameCount; i++) {
    const key = `${s3Key}/frame_${String(i).padStart(5, "0")}.jpg`;
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_INPUT_BUCKET!,
      Key: key,
      ContentType: contentType || "image/jpeg",
    });

    const url = await getSignedUrl(s3, command, { expiresIn: 900 }); // 15 min
    urls.push({ partNumber: i, url });
  }

  return NextResponse.json({
    uploadId: jobId,
    urls,
    s3Key,
  });
}
