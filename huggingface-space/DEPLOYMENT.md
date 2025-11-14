# Deploying to HuggingFace Spaces

## Prerequisites

1. **HuggingFace Account**: Create account at https://huggingface.co/join
2. **Git Installed**: Required for pushing code to HF Spaces

## Deployment Steps

### 1. Create New Space

1. Go to https://huggingface.co/new-space
2. Configure your Space:
   - **Owner**: Your username (e.g., `guy915`)
   - **Space name**: `marker-pdf-converter` (or your preferred name)
   - **License**: MIT
   - **SDK**: Docker
   - **Space hardware**:
     - Select **GPU: T4 - small** (FREE tier)
     - This is critical for performance
   - **Visibility**: Public (required for free GPU)

### 2. Clone the Space Repository

```bash
# Clone your new Space
git clone https://huggingface.co/spaces/<your-username>/marker-pdf-converter
cd marker-pdf-converter
```

### 3. Copy Files to Space

```bash
# Copy all files from huggingface-space directory
cp /path/to/AI-Doc-Prep/huggingface-space/* .

# Files to copy:
# - app.py
# - requirements.txt
# - README.md
# - Dockerfile
# - .gitignore
```

### 4. Push to HuggingFace

```bash
# Add all files
git add .

# Commit
git commit -m "Initial deployment of Marker PDF converter"

# Push to HuggingFace
git push
```

### 5. Wait for Build

- HuggingFace will automatically build your Docker container
- Build takes ~5-10 minutes
- Watch build logs at: `https://huggingface.co/spaces/<your-username>/marker-pdf-converter`

### 6. Verify Deployment

Once build completes, test the endpoints:

```bash
# Health check
curl https://<your-username>-marker-pdf-converter.hf.space/health

# Should return:
# {
#   "status": "healthy",
#   "active_jobs": 0,
#   "gpu": "0"
# }
```

### 7. Update AI Doc Prep

After deployment, update the Cloud Free endpoint in your Next.js app:

**File**: `src/lib/constants/endpoints.ts` (create if doesn't exist)

```typescript
export const MARKER_ENDPOINTS = {
  LOCAL: 'http://localhost:8000',
  CLOUD_FREE: 'https://<your-username>-marker-pdf-converter.hf.space',
  CLOUD_PAID: 'https://www.datalab.to/api/v1/marker',
}
```

## Space Configuration

The Space uses these settings (configured in README.md):

```yaml
---
title: Marker PDF Converter
emoji: 📄
colorFrom: blue
colorTo: purple
sdk: docker
sdk_version: "3.10"
app_file: app.py
pinned: false
license: mit
---
```

## Performance Notes

- **Cold Start**: First request after 48hr sleep takes 30-60 seconds
- **Warm Performance**: 1-3 seconds per page
- **GPU**: NVIDIA T4 (16GB VRAM) - excellent for Marker
- **Automatic Sleep**: Space sleeps after 48 hours of inactivity
- **Free Tier Limits**: No request limits, but may queue during peak times

## Troubleshooting

### Build Fails

- Check build logs in Space settings
- Common issues:
  - Missing dependencies in requirements.txt
  - Syntax errors in app.py
  - Invalid Dockerfile commands

### Space Won't Wake Up

- Cold starts can take up to 60 seconds
- Wait patiently for first request
- Subsequent requests will be fast

### GPU Not Detected

- Verify Space hardware is set to "GPU: T4 - small"
- Check Space settings at: `https://huggingface.co/spaces/<your-username>/marker-pdf-converter/settings`
- GPU only available on public Spaces

## Updating the Space

To update code after initial deployment:

```bash
# Make changes to files
# Then commit and push
git add .
git commit -m "Update: description of changes"
git push
```

HuggingFace will automatically rebuild and redeploy.

## Cost

**100% FREE** when using:
- Public Space (required for free GPU)
- T4 GPU tier
- No special hardware upgrades

Paid options (not needed):
- Private Spaces: $0.50/hour
- Upgraded GPUs: $0.60-$4/hour
- Persistent storage: $0.50/month per GB
