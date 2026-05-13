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
  const record = event.record || event.body?.record || event;
  const jobId = record.id;
  const qualityTier = record.quality_tier;
  const s3InputPath = record.s3_input_path;
  const tourId = record.tour_id;

  if (!jobId || !s3InputPath) {
    console.error("Missing job_id or s3_input_path");
    return { statusCode: 400, body: "Missing required fields" };
  }

  // Check active instance count
  const activeCount = await getActiveInstanceCount();
  if (activeCount >= MAX_CONCURRENT_INSTANCES) {
    console.warn(`Max concurrent instances (${MAX_CONCURRENT_INSTANCES}) reached. Queuing.`);
    return { statusCode: 429, body: "Max concurrent instances reached" };
  }

  // UserData script for the EC2 instance
  const userData = Buffer.from(`#!/bin/bash
export JOB_ID="${jobId}"
export QUALITY_TIER="${qualityTier}"
export S3_INPUT_PATH="${s3InputPath}"
export TOUR_ID="${tourId}"
export SUPABASE_URL="${SUPABASE_URL}"
export SUPABASE_SERVICE_KEY="${SUPABASE_SERVICE_KEY}"
export JOB_WEBHOOK_URL="${JOB_WEBHOOK_URL}"
export AWS_REGION="${process.env.AWS_REGION || "us-east-1"}"
export S3_INPUT_BUCKET="${process.env.S3_INPUT_BUCKET}"
export S3_OUTPUT_BUCKET="${process.env.S3_OUTPUT_BUCKET}"

# Run the processing pipeline
cd /opt/worker
python3 process.py
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
