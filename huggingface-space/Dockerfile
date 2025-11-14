FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Install system dependencies for Marker
RUN apt-get update && apt-get install -y \
    build-essential \
    libmagic1 \
    poppler-utils \
    tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app.py .

# Expose port 7860 (HuggingFace Spaces standard)
EXPOSE 7860

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV MARKER_CACHE_DIR=/tmp/marker_cache

# Run the application
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
