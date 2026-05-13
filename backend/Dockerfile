FROM python:3.11-slim

# System deps required by opencv-python (libGL, glib)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install PyTorch first from the CPU-only wheel index — avoids ~2GB of CUDA we don't need.
# Versions match those pinned in requirements.txt.
RUN pip install --no-cache-dir \
    torch==2.9.1 torchvision==0.24.1 \
    --index-url https://download.pytorch.org/whl/cpu

# Install the rest of the Python deps (pip will skip torch/torchvision since already satisfied).
COPY backend/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

# Copy application code, including the bundled ResNet50 weights in ml_engine/.
COPY backend /app/backend
COPY ml_engine /app/ml_engine

WORKDIR /app/backend

ENV PYTHONUNBUFFERED=1
ENV FLASK_DEBUG=false

# Render injects $PORT; bind gunicorn to it. Single eventlet worker because the
# loaded models hold ~1.5GB and a native cv2 crash takes the worker with it —
# one worker keeps memory bounded and the failure mode predictable.
EXPOSE 5000
CMD ["sh", "-c", "gunicorn --worker-class eventlet -w 1 --timeout 300 -b 0.0.0.0:${PORT:-5000} app:app"]
