# Modal Deployment Guide

Step-by-step guide to deploy the Marker PDF Converter to Modal (FREE $30/month credits!).

## What You Get with Modal

- **$30/month FREE credits** (renews every month)
- **~15 hours of GPU time/month** with free credits
- **Pay-per-second billing** (only pay when processing, scales to zero)
- **NVIDIA T4 GPU** (~$2/hour, but only when running)
- **No credit card required** for free tier

## Prerequisites

1. Modal account (free): https://modal.com/signup
2. Python 3.8+ installed locally
3. Terminal access

## Step 1: Create Modal Account

1. Go to https://modal.com/signup
2. Sign up (free, no credit card needed)
3. You'll get $30/month in credits automatically

## Step 2: Install Modal CLI

Open your terminal and run:

```bash
pip install modal
```

## Step 3: Authenticate with Modal

```bash
modal token new
```

This will:
1. Open your browser
2. Ask you to log in to Modal
3. Create an authentication token
4. Save it locally

You should see: "Token created and stored successfully!"

## Step 4: Deploy the App

Navigate to your project directory:

```bash
cd /path/to/iLoveMD/modal-deployment
```

Deploy the app:

```bash
modal deploy modal_app.py
```

This will:
1. Build the container image (~2-3 minutes first time)
2. Download Marker models (~2GB)
3. Deploy the serverless functions
4. Give you a public HTTPS URL

## Step 5: Get Your API URL

After deployment, Modal will show you the URL:

```
✓ Created web function marker_endpoint => https://YOUR-USERNAME--marker-pdf-converter-marker-endpoint.modal.run
```

Copy this URL - you'll need it for your website!

The health check URL is:
```
https://YOUR-USERNAME--marker-pdf-converter-health.modal.run
```

## Step 6: Test It

Test the health endpoint:

```bash
curl https://YOUR-USERNAME--marker-pdf-converter-health.modal.run
```

Test a PDF conversion:

```bash
curl -X POST \
  -F "file=@test.pdf" \
  -F "filename=test.pdf" \
  -F "output_format=markdown" \
  https://YOUR-USERNAME--marker-pdf-converter-marker-endpoint.modal.run
```

You should get back:
```json
{
  "success": true,
  "markdown": "# Your PDF content here...",
  "filename": "test.md",
  "request_id": "..."
}
```

## Step 7: Update Your Website Code

Open `src/lib/constants.ts` in your iLoveMD project:

```typescript
export const API_ENDPOINTS = {
  // ... other endpoints
  LOCAL_MARKER_INSTANCE: 'https://YOUR-USERNAME--marker-pdf-converter-marker-endpoint.modal.run',
} as const
```

Replace `YOUR-USERNAME` with your actual Modal username.

## Step 8: Update API Route

You'll need to update `src/app/api/marker/local/route.ts` to work with Modal's response format.

Modal returns the markdown directly in the response (no polling needed!), so the integration is simpler:

```typescript
// Modal returns immediately (no polling)
const response = await fetch(`${API_ENDPOINTS.LOCAL_MARKER_INSTANCE}`, {
  method: 'POST',
  body: formData,
})

const result = await response.json()

if (result.success) {
  return NextResponse.json({
    success: true,
    markdown: result.markdown,
    filename: result.filename,
  })
}
```

## Pricing Breakdown

**Free Tier:**
- $30/month in credits (renews monthly)
- ~15 hours of T4 GPU time
- ~90-180 PDF conversions/month (depending on PDF size)

**After Free Credits:**
- NVIDIA T4 GPU: ~$2.00/hour
- Only charged when actively processing (scales to zero)
- Typical conversion: 20-40 seconds = $0.01-0.02 per PDF

**Example monthly costs:**
- 10 PDFs/month: FREE (well within $30 credits)
- 100 PDFs/month: FREE (still within credits)
- 500 PDFs/month: ~$10-20 (beyond free tier)

## Key Features

**Automatic Scaling:**
- Scales to zero when idle (no cost)
- Spins up in ~10-20 seconds on first request
- Subsequent requests: instant (if still warm)

**Concurrency:**
- Handles 10 concurrent conversions
- Auto-scales to more instances if needed

**Timeout:**
- 10 minutes per conversion
- More than enough for large PDFs

## Monitoring

Check your usage:
```bash
modal app list
modal app logs marker-pdf-converter
```

Or visit: https://modal.com/apps

You can see:
- Credit usage
- Number of requests
- Errors and logs
- Performance metrics

## Updating the App

Make changes to `modal_app.py`, then:

```bash
modal deploy modal_app.py
```

Modal will redeploy with zero downtime!

## Troubleshooting

### "Modal token not found"

**Solution:**
```bash
modal token new
```

### "Build failed"

**Check logs:**
```bash
modal app logs marker-pdf-converter
```

**Common issues:**
- Python version mismatch (need 3.11)
- Missing dependencies (check requirements.txt)

### "Conversion times out"

**Solution:**
- Increase timeout in modal_app.py (line 35)
- Default is 600 seconds (10 minutes)

### "Out of credits"

**Check usage:**
Visit https://modal.com/settings/billing

**Solution:**
- Wait for monthly reset ($30 renews)
- Add payment method for overage

### Cold starts are slow

**This is normal:**
- First request after idle: ~20-30 seconds (cold start)
- Subsequent requests: ~2-5 seconds (warm start)
- Modal keeps functions warm for ~10 minutes

**To reduce cold starts:**
- Pay for "warm pool" (keeps instances running)
- Only needed for high-traffic apps

## Cost Optimization Tips

1. **Free tier is generous:** $30/month = ~100-200 conversions
2. **Scales to zero:** No idle costs (unlike always-on servers)
3. **Pay-per-second:** Only pay for actual processing time
4. **Monitor usage:** Check dashboard regularly

## Comparison: Modal vs Others

| Platform | Free Tier | Speed | Scaling | Complexity |
|----------|-----------|-------|---------|------------|
| **Modal** | $30/month credits | Fast | Auto, to zero | Low |
| HuggingFace T4 | $0 (paid) | Fast | Manual | Medium |
| HuggingFace CPU | Free | Slow | Auto | Low |
| Replicate | $0.50/day | Fast | Auto | Low |

## Next Steps

After deployment:
1. ✅ Test the API works
2. ✅ Update your website code
3. ✅ Deploy website to Vercel
4. ✅ Monitor credit usage
5. ✅ Celebrate - you have serverless GPU processing!

## Support

- Modal Docs: https://modal.com/docs
- Modal Discord: https://discord.gg/modal
- Marker Issues: https://github.com/VikParuchuri/marker/issues
- Your Project Issues: https://github.com/guy915/iLoveMD/issues
