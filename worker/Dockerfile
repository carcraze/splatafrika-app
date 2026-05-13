FROM nvidia/cuda:12.2.0-devel-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive

# System dependencies
RUN apt-get update && apt-get install -y \
    python3.11 python3-pip python3.11-venv \
    git cmake build-essential \
    libboost-all-dev libcgal-dev libglew-dev \
    ffmpeg libavcodec-dev libavformat-dev \
    wget curl \
    && rm -rf /var/lib/apt/lists/*

# Set Python 3.11 as default
RUN update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1

# COLMAP 3.8 (compiled with CUDA)
RUN git clone --branch 3.8 --depth 1 https://github.com/colmap/colmap.git /opt/colmap-src && \
    cd /opt/colmap-src && mkdir build && cd build && \
    cmake .. -DCUDA_ENABLED=ON -DCMAKE_BUILD_TYPE=Release && \
    make -j$(nproc) && make install && \
    rm -rf /opt/colmap-src

# 3D Gaussian Splatting
RUN git clone --depth 1 https://github.com/graphdeco-inria/gaussian-splatting.git /opt/3dgs && \
    cd /opt/3dgs && pip install --no-cache-dir -r requirements.txt

# Python dependencies
COPY requirements.txt /opt/worker/requirements.txt
RUN pip install --no-cache-dir -r /opt/worker/requirements.txt

# Real-ESRGAN (Premium tier)
RUN pip install --no-cache-dir realesrgan

# ply-splat converter (placeholder — would be our fork)
RUN mkdir -p /opt/ply-splat

# Worker script
COPY process.py /opt/worker/process.py

WORKDIR /opt/worker
ENTRYPOINT ["python3", "process.py"]
