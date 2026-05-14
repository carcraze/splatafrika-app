/**
 * SplatAfrika Lambda Job Orchestrator
 * Triggered by Supabase webhook on jobs table INSERT (status=pending).
 * Launches EC2 g6.xlarge Spot Instance with pre-baked AMI.
 *
 * Deploy: zip this file + package.json → upload to AWS Lambda
 * Runtime: Node.js 20.x
 * Timeout: 60 seconds
 * Reserved concurrency: 5
 */

import { EC2Client, RunInstancesCommand, DescribeInstancesCommand } from "@aws-sdk/client-ec2";

const ec2 = new EC2Client({ region: process.env.AWS_REGION || "us-east-1" });

const MAX_CONCURRENT_INSTANCES = 3;
const MAX_LAUNCH_RETRIES = 3;
const RETRY_DELAY_MS = 30000;
const AMI_ID = process.env.SPLATAFRIKA_AMI_ID;
const INSTANCE_TYPE = "g6.xlarge";
const SECURITY_GROUP_ID = process.env.SECURITY_GROUP_ID;
const INSTANCE_PROFILE_ARN = process.env.INSTANCE_PROFILE_ARN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const JOB_WEBHOOK_URL = process.env.JOB_WEBHOOK_URL;

// On-demand fallback triggers
const SPOT_FAILURE_REASONS = [
  "InsufficientInstanceCapacity",
  "MaxSpotInstanceCountExceeded",
  "SpotMaxPriceTooLow",
  "InstanceLimitExceeded",
];

export async function handler(event) {
  console.log("Job orchestrator triggered:", JSON.stringify(event));

  // Parse job details from webhook payload
  // Function URL events have body as a JSON string
  let record;
  if (event.body) {
    try {
      const body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
      record = body.record || body;
    } catch (e) {
      console.error("Failed to parse body:", e);
      record = event.record || event;
    }
  } else {
    record = event.record || event;
  }

  const jobId = record.id;
  const qualityTier = record.quality_tier;
  const s3InputPath = record.s3_input_path;
  const tourId = record.tour_id;

  if (!jobId || !s3InputPath) {
    console.error("Missing job_id or s3_input_path. Got:", JSON.stringify(record));
    return { statusCode: 400, body: "Missing required fields" };
  }

  // Check active instance count
  const activeCount = await getActiveInstanceCount();
  if (activeCount >= MAX_CONCURRENT_INSTANCES) {
    console.warn(`Max concurrent instances (${MAX_CONCURRENT_INSTANCES}) reached. Queuing.`);
    return { statusCode: 429, body: "Max concurrent instances reached" };
  }

  // UserData script for the EC2 instance
  // Uses Deep Learning Base AMI (CUDA pre-installed) — installs COLMAP + worker at boot
  const userData = Buffer.from(`#!/bin/bash
set -ex
exec > /var/log/splatafrika-job.log 2>&1

export JOB_ID="${jobId}"
export QUALITY_TIER="${qualityTier}"
export S3_INPUT_PATH="${s3InputPath}"
export TOUR_ID="${tourId}"
export SUPABASE_URL="${SUPABASE_URL}"
export SUPABASE_SERVICE_KEY="${SUPABASE_SERVICE_KEY}"
export JOB_WEBHOOK_URL="${JOB_WEBHOOK_URL}"
export AWS_DEFAULT_REGION="${process.env.AWS_REGION || "us-east-1"}"
export S3_INPUT_BUCKET="${process.env.S3_INPUT_BUCKET}"
export S3_OUTPUT_BUCKET="${process.env.S3_OUTPUT_BUCKET}"

# Wait for cloud-init
cloud-init status --wait || true

# Install COLMAP + dependencies (if not already installed)
if ! command -v colmap &> /dev/null; then
  apt-get update -y
  apt-get install -y colmap python3-pip git ffmpeg
  pip3 install boto3 requests open3d
fi

# Install 3DGS if not present
if [ ! -d "/opt/3dgs" ]; then
  git clone --depth 1 https://github.com/graphdeco-inria/gaussian-splatting.git /opt/3dgs
  cd /opt/3dgs && pip3 install -e . 2>/dev/null || pip3 install submodules/diff-gaussian-rasterization submodules/simple-knn 2>/dev/null || true
fi

# Download and run worker script
mkdir -p /opt/worker
cat > /opt/worker/process.py << 'PYEOF'
import os,sys,time,signal,subprocess,shutil
from pathlib import Path
import boto3,requests

JOB_ID=os.environ.get("JOB_ID","test")
QUALITY_TIER=os.environ.get("QUALITY_TIER","standard")
S3_INPUT_PATH=os.environ.get("S3_INPUT_PATH","")
S3_INPUT_BUCKET=os.environ.get("S3_INPUT_BUCKET","splatafrika-input")
S3_OUTPUT_BUCKET=os.environ.get("S3_OUTPUT_BUCKET","splatafrika-output")
JOB_WEBHOOK_URL=os.environ.get("JOB_WEBHOOK_URL","")
SUPABASE_SERVICE_KEY=os.environ.get("SUPABASE_SERVICE_KEY","")
REGION=os.environ.get("AWS_DEFAULT_REGION","us-east-1")

WORK=Path("/tmp/splatafrika");FRAMES=WORK/"frames";COLMAP_OUT=WORK/"colmap";OUTPUT=WORK/"output"
s3=boto3.client("s3",region_name=REGION);ec2=boto3.client("ec2",region_name=REGION)
start=time.time()

def status(s,**kw):
    if not JOB_WEBHOOK_URL:return
    try:requests.post(JOB_WEBHOOK_URL,json={"job_id":JOB_ID,"status":s,**kw},headers={"Content-Type":"application/json","Authorization":f"Bearer {SUPABASE_SERVICE_KEY}"},timeout=10)
    except:pass

def terminate():
    try:
        iid=requests.get("http://169.254.169.254/latest/meta-data/instance-id",timeout=2).text
        ec2.terminate_instances(InstanceIds=[iid])
    except:pass

def download():
    FRAMES.mkdir(parents=True,exist_ok=True)
    n=0
    for page in s3.get_paginator("list_objects_v2").paginate(Bucket=S3_INPUT_BUCKET,Prefix=S3_INPUT_PATH):
        for obj in page.get("Contents",[]):
            k=obj["Key"]
            if k.endswith((".png",".jpg",".jpeg")):
                s3.download_file(S3_INPUT_BUCKET,k,str(FRAMES/k.split("/")[-1]));n+=1
    print(f"Downloaded {n} frames")
    if n==0:raise RuntimeError("No frames in S3")

def colmap():
    COLMAP_OUT.mkdir(parents=True,exist_ok=True)
    db=str(COLMAP_OUT/"database.db");sparse=str(COLMAP_OUT/"sparse")
    os.makedirs(sparse,exist_ok=True)
    subprocess.run(["colmap","feature_extractor","--database_path",db,"--image_path",str(FRAMES),"--ImageReader.single_camera","1"],check=True)
    subprocess.run(["colmap","exhaustive_matcher","--database_path",db],check=True)
    subprocess.run(["colmap","mapper","--database_path",db,"--image_path",str(FRAMES),"--output_path",sparse],check=True)
    if not os.listdir(sparse):raise RuntimeError("COLMAP failed")

def train(iters=15000):
    OUTPUT.mkdir(parents=True,exist_ok=True)
    subprocess.run(["python3","/opt/3dgs/train.py","-s",str(COLMAP_OUT),"--iterations",str(iters),"-m",str(OUTPUT/"model")],check=True)

def upload():
    plys=list(OUTPUT.rglob("*.ply"))
    if not plys:raise RuntimeError("No .ply output")
    key=f"output/{JOB_ID}/{JOB_ID}.ply"
    s3.upload_file(str(plys[0]),S3_OUTPUT_BUCKET,key)
    return key

print(f"[START] {JOB_ID} tier={QUALITY_TIER}")
status("processing")
try:
    download()
    colmap()
    train(30000 if QUALITY_TIER=="premium" else 15000)
    url=upload()
    status("complete",splat_url=url)
    print(f"[DONE] {int(time.time()-start)}s")
except Exception as e:
    print(f"[FAIL] {e}")
    status("failed",error_message=str(e))
finally:
    terminate()
PYEOF

cd /opt/worker && python3 process.py
`).toString("base64");

  // Attempt Spot launch with retries and on-demand fallback
  let instanceId = null;
  let instanceType = "spot";

  for (let attempt = 1; attempt <= MAX_LAUNCH_RETRIES; attempt++) {
    try {
      instanceId = await launchSpotInstance(userData);
      console.log(`Spot instance launched: ${instanceId} (attempt ${attempt})`);
      break;
    } catch (err) {
      const errorCode = err.Code || err.name || "";
      console.warn(`Spot launch attempt ${attempt} failed: ${errorCode} - ${err.message}`);

      if (SPOT_FAILURE_REASONS.some((r) => errorCode.includes(r)) || attempt === MAX_LAUNCH_RETRIES) {
        // Fall back to on-demand
        console.log("Falling back to on-demand instance");
        try {
          instanceId = await launchOnDemandInstance(userData);
          instanceType = "on_demand";
          console.log(`On-demand instance launched: ${instanceId}`);
          break;
        } catch (odErr) {
          console.error(`On-demand fallback failed: ${odErr.message}`);
          if (attempt === MAX_LAUNCH_RETRIES) {
            // All retries exhausted — mark job as failed
            await updateJobStatus(jobId, "failed", {
              error_message: `Instance launch failed after ${MAX_LAUNCH_RETRIES} attempts: ${odErr.message}`,
            });
            return { statusCode: 500, body: "Instance launch failed" };
          }
        }
      }

      // Wait before retry
      if (attempt < MAX_LAUNCH_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }
    }
  }

  // Update job with instance info
  if (instanceId) {
    await updateJobStatus(jobId, "processing", {
      instance_id: instanceId,
      instance_type: instanceType,
    });
  }

  return { statusCode: 200, body: JSON.stringify({ instanceId, instanceType }) };
}

async function launchSpotInstance(userData) {
  const command = new RunInstancesCommand({
    ImageId: AMI_ID,
    InstanceType: INSTANCE_TYPE,
    MinCount: 1,
    MaxCount: 1,
    InstanceMarketOptions: {
      MarketType: "spot",
      SpotOptions: {
        MaxPrice: "0.50",
        SpotInstanceType: "one-time",
        InstanceInterruptionBehavior: "terminate",
      },
    },
    UserData: userData,
    IamInstanceProfile: INSTANCE_PROFILE_ARN ? { Arn: INSTANCE_PROFILE_ARN } : undefined,
    SecurityGroupIds: SECURITY_GROUP_ID ? [SECURITY_GROUP_ID] : undefined,
    TagSpecifications: [
      {
        ResourceType: "instance",
        Tags: [
          { Key: "Name", Value: "splatafrika-gpu-worker" },
          { Key: "Project", Value: "splatafrika" },
        ],
      },
    ],
  });

  const result = await ec2.send(command);
  return result.Instances[0].InstanceId;
}

async function launchOnDemandInstance(userData) {
  const command = new RunInstancesCommand({
    ImageId: AMI_ID,
    InstanceType: INSTANCE_TYPE,
    MinCount: 1,
    MaxCount: 1,
    UserData: userData,
    IamInstanceProfile: INSTANCE_PROFILE_ARN ? { Arn: INSTANCE_PROFILE_ARN } : undefined,
    SecurityGroupIds: SECURITY_GROUP_ID ? [SECURITY_GROUP_ID] : undefined,
    TagSpecifications: [
      {
        ResourceType: "instance",
        Tags: [
          { Key: "Name", Value: "splatafrika-gpu-worker-ondemand" },
          { Key: "Project", Value: "splatafrika" },
          { Key: "FallbackReason", Value: "spot_unavailable" },
        ],
      },
    ],
  });

  const result = await ec2.send(command);
  return result.Instances[0].InstanceId;
}

async function getActiveInstanceCount() {
  try {
    const command = new DescribeInstancesCommand({
      Filters: [
        { Name: "tag:Project", Values: ["splatafrika"] },
        { Name: "instance-state-name", Values: ["pending", "running"] },
      ],
    });
    const result = await ec2.send(command);
    let count = 0;
    for (const reservation of result.Reservations || []) {
      count += (reservation.Instances || []).length;
    }
    return count;
  } catch {
    return 0; // If we can't check, allow the launch
  }
}

async function updateJobStatus(jobId, status, extra = {}) {
  try {
    const body = { job_id: jobId, status, ...extra };
    await fetch(JOB_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error(`Failed to update job status: ${err.message}`);
  }
}
