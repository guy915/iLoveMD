# Marker PDF Converter - Modal Deployment

Free serverless GPU-powered PDF to Markdown conversion using [Modal](https://modal.com).

## What is This?

This folder contains the Modal deployment for providing **FREE** GPU-powered PDF conversion to users of the iLoveLLM website.

## Why Modal?

- **$30/month FREE credits** (renews monthly, no credit card required)
- **Pay-per-second billing** (only charged when actively processing)
- **Scales to zero** (no cost when idle)
- **NVIDIA T4 GPU** (fast processing)
- **Simple deployment** (one command)

## Quick Start

1. **Install Modal:**
   ```bash
   pip install modal
   ```

2. **Authenticate:**
   ```bash
   modal token new
   ```

3. **Deploy:**
   ```bash
   cd modal-deployment
   modal deploy modal_app.py
   ```

4. **Get your URL:**
   Modal will give you a URL like:
   ```
   https://YOUR-USERNAME--marker-pdf-converter-marker-endpoint.modal.run
   ```

5. **Update your website:**
   Add the URL to `src/lib/constants.ts`:
   ```typescript
   LOCAL_MARKER_INSTANCE: 'https://YOUR-USERNAME--marker-pdf-converter-marker-endpoint.modal.run'
   ```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

## Files

- `modal_app.py` - Main Modal application with serverless functions
- `requirements.txt` - Python dependencies for local development
- `DEPLOYMENT.md` - Detailed deployment guide
- `README.md` - This file

## API Endpoints

After deployment, you'll have:

**POST /marker_endpoint** - Convert PDF to Markdown
```bash
curl -X POST \
  -F "file=@document.pdf" \
  -F "filename=document.pdf" \
  -F "output_format=markdown" \
  https://YOUR-URL/marker_endpoint
```

**GET /health** - Health check
```bash
curl https://YOUR-URL/health
```

## Response Format

```json
{
  "success": true,
  "markdown": "# Your PDF content...",
  "filename": "document.md",
  "request_id": "uuid-here",
  "metadata": {}
}
```

## Cost Estimate

With $30/month free credits:

- **Light usage** (10-50 PDFs/month): FREE
- **Medium usage** (100-200 PDFs/month): FREE
- **Heavy usage** (500+ PDFs/month): ~$10-20/month

## Performance

- **Cold start:** 20-30 seconds (first request after idle)
- **Warm start:** 2-5 seconds (subsequent requests)
- **Processing:** 20-40 seconds per PDF (depending on size)

## Monitoring

Check your usage at: https://modal.com/apps

## Support

- [Modal Documentation](https://modal.com/docs)
- [Marker AI GitHub](https://github.com/VikParuchuri/marker)
- [iLoveLLM Issues](https://github.com/guy915/iLoveLLM/issues)
