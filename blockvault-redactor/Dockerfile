# syntax=docker/dockerfile:1
FROM python:3.11-slim

# Install system dependencies for PyMuPDF, OCR (PaddleOCR/OpenCV), and security sandboxing
RUN apt-get update && apt-get install -y --no-install-recommends \
    poppler-utils \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libmupdf-dev \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security sandbox
RUN useradd -m -s /bin/bash redactoruser

WORKDIR /app

# Install Python requirements
# We install spacy models here so they are baked into the image
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && python -m spacy download en_core_web_sm \
    && python -m spacy download en_core_web_lg

# Copy app code
COPY app /app/app

# Set permissions
RUN chown -R redactoruser:redactoruser /app

# Switch to non-root user
USER redactoruser

# Expose port
EXPOSE 8000

# Run FastAPI with uvicorn (use threads for async, processes managed by executor)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
