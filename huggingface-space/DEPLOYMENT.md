# HuggingFace Space Deployment Guide

Step-by-step guide to deploy the Marker PDF Converter to HuggingFace Spaces (FREE GPU!).

## Prerequisites

- HuggingFace account (free): https://huggingface.co/join
- Git installed on your computer

## Step 1: Create a HuggingFace Space

1. **Go to HuggingFace**: https://huggingface.co
2. **Click your profile** → "New Space"
3. **Configure the Space**:
   - **Space name**: `marker-pdf-converter` (or whatever you want)
   - **License**: MIT
   - **SDK**: Docker
   - **Hardware**: CPU Basic (will upgrade to GPU later)
   - **Visibility**: Public
4. **Click "Create Space"**

## Step 2: Upload Files

You have two options:

### Option A: Upload via Web Interface (Easiest)

1. In your new Space, click **"Files" tab**
2. Click **"Add file" → "Upload files"**
3. Upload these 4 files from `huggingface-space/` folder:
   - `app.py`
   - `requirements.txt`
   - `Dockerfile`
   - `README.md`
4. **Commit the files**

### Option B: Upload via Git (Advanced)

```bash
# Clone the Space repository
git clone https://huggingface.co/spaces/YOUR-USERNAME/marker-pdf-converter
cd marker-pdf-converter

# Copy files from this repo
cp /path/to/AI-Doc-Prep/huggingface-space/* .

# Commit and push
git add .
git commit -m "Initial deployment"
git push
```

## Step 3: Enable GPU (Important!)

1. **In your Space**, click **"Settings" tab**
2. Scroll to **"Hardware"**
3. **Select**: "T4 small" (FREE GPU!)
4. **Click "Save"**

The Space will restart with GPU support.

## Step 4: Wait for Build

1. Go to **"App" tab**
2. You'll see: "Building..." or "Starting..."
3. **First build takes ~5-10 minutes** (downloads Marker models)
4. When ready, you'll see: "Running"

## Step 5: Get Your URL

Your Space URL is:
```
https://huggingface.co/spaces/YOUR-USERNAME/marker-pdf-converter
```

The API endpoint is:
```
https://YOUR-USERNAME-marker-pdf-converter.hf.space/marker
```

## Step 6: Test It!

```bash
# Test the health endpoint
curl https://YOUR-USERNAME-marker-pdf-converter.hf.space/

# Upload a PDF
curl -X POST \
  -F "file=@test.pdf" \
  -F "output_format=markdown" \
  https://YOUR-USERNAME-marker-pdf-converter.hf.space/marker

# You'll get back a request_id
# Then poll the status:
curl https://YOUR-USERNAME-marker-pdf-converter.hf.space/status/{request_id}
```

## Step 7: Update Your Website

In your `AI-Doc-Prep` project:

1. Open `src/lib/constants.ts`
2. Update the URL:
   ```typescript
   export const API_ENDPOINTS = {
     MARKER_FREE: 'https://YOUR-USERNAME-marker-pdf-converter.hf.space',
     // ... other endpoints
   }
   ```
3. Replace `YOUR-USERNAME` with your actual HuggingFace username
4. Save and redeploy your website

## Troubleshooting

### Space won't start

**Check logs**:
1. Go to "Logs" tab in your Space
2. Look for errors

**Common issues**:
- Missing files (upload all 4 files)
- Dockerfile syntax error (check for typos)
- Out of memory (upgrade to larger GPU in settings)

### "No GPU available"

**Solution**:
1. Go to Settings → Hardware
2. Select "T4 small" (not "CPU Basic")
3. Save and restart

### Very slow first conversion

**This is normal!**
- First run downloads ~2-3GB of ML models
- Subsequent runs are much faster (20-30 seconds)
- Space "sleeps" after 15 min idle (30s wake-up time)

### Connection errors from website

**Check CORS**:
- Make sure Space is "Public" (not private)
- Check that `app.py` has CORS enabled (it does by default)

### Rate limiting

**HuggingFace fair use**:
- Free GPU is shared
- Don't abuse it (thousands of conversions)
- If you need more, upgrade to paid GPU ($0.60/hour)

## Upgrading to Paid GPU (Optional)

If you need faster/more conversions:

1. **Settings** → **Hardware**
2. Select paid GPU tier:
   - T4 small: $0.60/hour
   - A10G small: $1.05/hour (faster)
3. Add payment method to HuggingFace account

**Cost estimate**:
- T4: ~$15/month if running 24/7
- Better for heavy usage (100s of PDFs/day)

## Monitoring

Check Space health:
```bash
curl https://YOUR-USERNAME-marker-pdf-converter.hf.space/health
```

View active jobs:
```bash
curl https://YOUR-USERNAME-marker-pdf-converter.hf.space/
```

## Updating the Space

To update code:

1. Edit files in HuggingFace web interface
2. Or push via Git:
   ```bash
   git pull
   # make changes
   git commit -am "Update"
   git push
   ```

Space auto-rebuilds on changes.

## Next Steps

After deployment:
1. ✅ Test the API works
2. ✅ Update your website code
3. ✅ Deploy website to Vercel
4. ✅ Celebrate - you have free GPU-powered PDF conversion! 🎉

## Support

- HuggingFace Docs: https://huggingface.co/docs/hub/spaces
- Marker Issues: https://github.com/VikParuchuri/marker/issues
- Your Project Issues: https://github.com/guy915/AI-Doc-Prep/issues
