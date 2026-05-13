#!/usr/bin/env python3
"""
SplatAfrika GPU Worker — process.py
Runs on EC2 g6.xlarge (L4 24GB). Reads env vars, executes pipeline, self-terminates.

Environment Variables:
  JOB_ID, QUALITY_TIER, S3_INPUT_PATH, TOUR_ID,
  SUPABASE_URL, SUPABASE_SERVICE_KEY, JOB_WEBHOOK_URL,
  AWS_REGION, S3_INPUT_BUCKET, S3_OUTPUT_BUCKET
"""

import os
import sys
import time
import signal
import json
import subprocess
import shutil
import threading
import tarfile
from pathlib import Path

import boto3
import requests

# ============================================================
# Configuration
# ============================================================
JOB_ID = os.environ["JOB_ID"]
QUALITY_TIER = os.environ.get("QUALITY_TIER", "standard")
S3_INPUT_PATH = os.environ["S3_INPUT_PATH"]
TOUR_ID = os.environ.get("TOUR_ID", "")
AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")
S3_INPUT_BUCKET = os.environ["S3_INPUT_BUCKET"]
S3_OUTPUT_BUCKET = os.environ["S3_OUTPUT_BUCKET"]
JOB_WEBHOOK_URL = os.environ["JOB_WEBHOOK_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

WORK_DIR = Path("/tmp/splatafrika")
FRAMES_DIR = WORK_DIR / "frames"
COLMAP_DIR = WORK_DIR / "colmap"
OUTPUT_DIR = WORK_DIR / "output"

CHECKPOINT_INTERVAL = 300  # 5 minutes
MAX_WALL_CLOCK = 2700  # 45 minutes
PREMIUM_WARN_TIME = 1500  # 25 minutes
PREMIUM_KILL_TIME = 1680  # 28 minutes
CLEANUP_TIMEOUT = 60  # seconds

s3 = boto3.client("s3", region_name=AWS_REGION)
ec2 = boto3.client("ec2", region_name=AWS_REGION)

start_time = time.time()
current_step = "init"
interrupted = False


# ============================================================
# Signal Handling (Spot Interruption)
# ============================================================
def sigterm_handler(signum, frame):
    """Handle Spot interruption (2-min warning)."""
    global interrupted
    interrupted = True
    print(f"[SIGTERM] Spot interruption received. Saving checkpoint...")
    try:
        save_checkpoint()
        update_status("interrupted", checkpoint_path=get_checkpoint_key())
    except Exception as e:
        print(f"[SIGTERM] Checkpoint save failed: {e}")
        update_status("interrupted", error_message=f"Checkpoint save failed: {e}")
    sys.exit(0)


signal.signal(signal.SIGTERM, sigterm_handler)


# ============================================================
# Utility Functions
# ============================================================
def update_status(status, **kwargs):
    """Update job status via webhook."""
    payload = {"job_id": JOB_ID, "status": status, **kwargs}
    try:
        requests.post(
            JOB_WEBHOOK_URL,
            json=payload,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            },
            timeout=10,
        )
    except Exception as e:
        print(f"[ERROR] Status update failed: {e}")


def get_checkpoint_key():
    return f"checkpoints/{JOB_ID}/checkpoint.tar.gz"


def save_checkpoint():
    """Save current processing state to S3."""
    checkpoint_path = WORK_DIR / "checkpoint.tar.gz"
    with tarfile.open(checkpoint_path, "w:gz") as tar:
        if COLMAP_DIR.exists():
            tar.add(COLMAP_DIR, arcname="colmap")
        if OUTPUT_DIR.exists():
            tar.add(OUTPUT_DIR, arcname="output")
    s3.upload_file(str(checkpoint_path), S3_INPUT_BUCKET, get_checkpoint_key())
    print(f"[CHECKPOINT] Saved to s3://{S3_INPUT_BUCKET}/{get_checkpoint_key()}")


def check_timeout():
    """Check if we've exceeded wall-clock limits."""
    elapsed = time.time() - start_time
    if elapsed > MAX_WALL_CLOCK:
        raise TimeoutError(f"Job exceeded {MAX_WALL_CLOCK}s wall-clock limit")
    if QUALITY_TIER == "premium" and elapsed > PREMIUM_KILL_TIME:
        raise TimeoutError(f"Premium job exceeded {PREMIUM_KILL_TIME}s hard kill limit")
    if QUALITY_TIER == "premium" and elapsed > PREMIUM_WARN_TIME:
        print(f"[WARN] Premium job at {int(elapsed)}s — approaching timeout")


def run_command(cmd, step_name):
    """Run a shell command with error handling."""
    global current_step
    current_step = step_name
    print(f"[{step_name}] Running: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=1800)
    if result.returncode != 0:
        raise RuntimeError(f"{step_name} failed: {result.stderr[:500]}")
    return result.stdout


def self_terminate():
    """Terminate this EC2 instance."""
    try:
        instance_id = requests.get(
            "http://169.254.169.254/latest/meta-data/instance-id", timeout=2
        ).text
        ec2.terminate_instances(InstanceIds=[instance_id])
        print(f"[TERMINATE] Instance {instance_id} termination requested")
    except Exception as e:
        print(f"[ERROR] Self-terminate failed: {e}")


# ============================================================
# Checkpoint Background Thread
# ============================================================
def checkpoint_loop():
    """Background thread: save checkpoint every 5 minutes."""
    while not interrupted:
        time.sleep(CHECKPOINT_INTERVAL)
        if interrupted:
            break
        try:
            save_checkpoint()
        except Exception as e:
            print(f"[CHECKPOINT] Background save failed: {e}")


# ============================================================
# Pipeline Steps
# ============================================================
def download_frames():
    """Download extracted frames from S3."""
    FRAMES_DIR.mkdir(parents=True, exist_ok=True)
    paginator = s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=S3_INPUT_BUCKET, Prefix=S3_INPUT_PATH):
        for obj in page.get("Contents", []):
            key = obj["Key"]
            filename = key.split("/")[-1]
            if filename.endswith(".png"):
                local_path = FRAMES_DIR / filename
                s3.download_file(S3_INPUT_BUCKET, key, str(local_path))
    frame_count = len(list(FRAMES_DIR.glob("*.png")))
    print(f"[DOWNLOAD] {frame_count} frames downloaded")
    if frame_count == 0:
        raise RuntimeError("No frames found in S3 input path")


def run_colmap():
    """Run COLMAP Structure-from-Motion."""
    COLMAP_DIR.mkdir(parents=True, exist_ok=True)
    db_path = COLMAP_DIR / "database.db"
    sparse_dir = COLMAP_DIR / "sparse"
    sparse_dir.mkdir(exist_ok=True)

    # Feature extraction
    run_command([
        "colmap", "feature_extractor",
        "--database_path", str(db_path),
        "--image_path", str(FRAMES_DIR),
        "--ImageReader.single_camera", "1",
    ], "colmap_features")

    check_timeout()

    # Feature matching
    run_command([
        "colmap", "exhaustive_matcher",
        "--database_path", str(db_path),
    ], "colmap_matching")

    check_timeout()

    # Sparse reconstruction
    run_command([
        "colmap", "mapper",
        "--database_path", str(db_path),
        "--image_path", str(FRAMES_DIR),
        "--output_path", str(sparse_dir),
    ], "colmap_mapper")

    # Verify reconstruction exists
    if not any(sparse_dir.iterdir()):
        raise RuntimeError("COLMAP failed: insufficient frame overlap or quality")

    check_timeout()


def run_3dgs(iterations=15000):
    """Run 3D Gaussian Splatting training."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    run_command([
        "python3", "/opt/3dgs/train.py",
        "-s", str(COLMAP_DIR),
        "--iterations", str(iterations),
        "-m", str(OUTPUT_DIR / "model"),
    ], f"3dgs_{iterations}")
    check_timeout()


def clean_point_cloud():
    """Clean point cloud with Open3D."""
    run_command([
        "python3", "-c",
        f"""
import open3d as o3d
import numpy as np
pcd = o3d.io.read_point_cloud('{OUTPUT_DIR}/model/point_cloud/iteration_15000/point_cloud.ply')
cl, ind = pcd.remove_statistical_outlier(nb_neighbors=20, std_ratio=2.0)
pcd_clean = pcd.select_by_index(ind)
o3d.io.write_point_cloud('{OUTPUT_DIR}/model/point_cloud.ply', pcd_clean)
"""
    ], "clean_pointcloud")
    check_timeout()


def convert_to_splat():
    """Convert .ply to optimized .splat format."""
    run_command([
        "python3", "/opt/ply-splat/convert.py",
        "--input", str(OUTPUT_DIR / "model/point_cloud.ply"),
        "--output", str(OUTPUT_DIR / f"{JOB_ID}.splat"),
        "--sort-by-opacity",
    ], "ply_to_splat")
    check_timeout()


def upload_outputs():
    """Upload outputs to S3. S3 MUST succeed before DB update (REQ-5.5)."""
    output_prefix = f"output/{JOB_ID}"
    splat_key = f"{output_prefix}/{JOB_ID}.splat"
    splat_path = OUTPUT_DIR / f"{JOB_ID}.splat"

    if not splat_path.exists():
        raise RuntimeError("Splat file not generated")

    # Upload splat
    s3.upload_file(str(splat_path), S3_OUTPUT_BUCKET, splat_key)
    splat_url = splat_key

    stills_url = None
    mp4_url = None

    if QUALITY_TIER == "premium":
        # Upload stills ZIP if exists
        stills_path = OUTPUT_DIR / "stills.zip"
        if stills_path.exists():
            stills_key = f"{output_prefix}/stills.zip"
            s3.upload_file(str(stills_path), S3_OUTPUT_BUCKET, stills_key)
            stills_url = stills_key

        # Upload MP4 if exists
        mp4_path = OUTPUT_DIR / "cinematic.mp4"
        if mp4_path.exists():
            mp4_key = f"{output_prefix}/cinematic.mp4"
            s3.upload_file(str(mp4_path), S3_OUTPUT_BUCKET, mp4_key)
            mp4_url = mp4_key

    return splat_url, stills_url, mp4_url


def run_premium_pipeline():
    """Additional Premium steps after Standard pipeline."""
    # Continue training to 30k iterations
    run_3dgs(iterations=30000)

    # Render key views (placeholder — requires headless renderer)
    print("[PREMIUM] Key view rendering (placeholder)")

    # Real-ESRGAN upscaling (placeholder)
    print("[PREMIUM] Real-ESRGAN upscaling (placeholder)")

    # FFmpeg cinematic MP4 (placeholder)
    print("[PREMIUM] Cinematic MP4 assembly (placeholder)")

    check_timeout()


# ============================================================
# Main Pipeline
# ============================================================
def main():
    print(f"[START] Job {JOB_ID} | Tier: {QUALITY_TIER} | Input: {S3_INPUT_PATH}")
    update_status("processing")

    # Start checkpoint background thread
    checkpoint_thread = threading.Thread(target=checkpoint_loop, daemon=True)
    checkpoint_thread.start()

    try:
        # Phase 1: Download frames
        download_frames()

        # Phase 2: COLMAP
        run_colmap()

        # Phase 3: 3DGS Training (Standard: 15k)
        run_3dgs(iterations=15000)

        # Phase 4: Clean point cloud
        clean_point_cloud()

        # Phase 5: Convert to .splat
        convert_to_splat()

        # Phase 6: Premium extensions
        if QUALITY_TIER == "premium":
            run_premium_pipeline()

        # Phase 7: Upload to S3 FIRST (before DB update)
        splat_url, stills_url, mp4_url = upload_outputs()

        # Phase 8: Update status to COMPLETE (only after S3 success)
        elapsed = time.time() - start_time
        sla_breach = QUALITY_TIER == "premium" and elapsed > PREMIUM_WARN_TIME

        update_status(
            "complete",
            splat_url=splat_url,
            stills_zip_url=stills_url,
            mp4_url=mp4_url,
        )

        if sla_breach:
            print(f"[SLA] Premium job completed in {int(elapsed)}s — SLA breach flagged")

        print(f"[COMPLETE] Job {JOB_ID} finished in {int(elapsed)}s")

    except TimeoutError as e:
        print(f"[TIMEOUT] {e}")
        update_status("failed", error_message=str(e), failed_step=current_step)

    except RuntimeError as e:
        print(f"[FAILED] {e}")

        # Premium cleanup: salvage completed outputs (60s time-box)
        if QUALITY_TIER == "premium":
            salvage_premium_outputs()

        update_status("failed", error_message=str(e), failed_step=current_step)

    except Exception as e:
        print(f"[ERROR] Unexpected: {e}")
        update_status("failed", error_message=f"Unexpected error: {e}", failed_step=current_step)

    finally:
        # Always self-terminate
        print("[TERMINATE] Self-terminating instance...")
        self_terminate()


def salvage_premium_outputs():
    """Time-boxed cleanup: salvage any completed outputs (60s max)."""
    deadline = time.time() + CLEANUP_TIMEOUT
    salvaged = {}

    splat_path = OUTPUT_DIR / f"{JOB_ID}.splat"
    if splat_path.exists() and time.time() < deadline:
        try:
            key = f"partial/{JOB_ID}/{JOB_ID}.splat"
            s3.upload_file(str(splat_path), S3_OUTPUT_BUCKET, key)
            salvaged["splat"] = key
            print(f"[SALVAGE] Saved splat to {key}")
        except Exception as e:
            print(f"[SALVAGE] Failed to save splat: {e}")

    if salvaged:
        print(f"[SALVAGE] Salvaged outputs: {list(salvaged.keys())}")


if __name__ == "__main__":
    main()
