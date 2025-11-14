# Local Marker Setup Guide

This guide explains how to set up a local Marker instance for **Local (Free)** mode in AI Doc Prep.

## Overview

Local mode allows you to run Marker PDF conversion entirely on your machine with:
- **Complete privacy** - No data sent to external servers (except Gemini API if using LLM)
- **All conversion options** - Access to all Marker features including math formatting
- **No API costs** - Free to use (except optional Gemini API usage)
- **Full control** - Run on your own hardware

**Note**: Local mode requires some technical setup. If you prefer zero setup, use **Cloud Free** mode instead.

---

## Prerequisites

- **Python 3.9 or higher** - [Download Python](https://www.python.org/downloads/)
- **pip** (comes with Python)
- **Git** (optional, for cloning Marker repo) - [Download Git](https://git-scm.com/)

**System Requirements**:
- **RAM**: 4GB minimum, 8GB recommended
- **Disk Space**: ~2GB for Marker models
- **GPU**: Optional (CPU works but slower)

---

## Installation

### Option 1: Install via pip (Recommended)

This is the simplest method - no Docker required!

```bash
# Install marker-pdf
pip install marker-pdf

# Verify installation
marker_single --help
```

### Option 2: Install from Source

```bash
# Clone Marker repository
git clone https://github.com/VikParuchuri/marker.git
cd marker

# Install dependencies
pip install -e .
```

---

## Running the Local Server

Marker needs to run as a local server on `http://localhost:8000` for AI Doc Prep to connect to it.

### Using the Standalone Server (Easiest)

1. **Install the server script**:

```bash
pip install fastapi uvicorn python-multipart
```

2. **Create server file** (`marker_server.py`):

```python
"""
Local Marker Server for AI Doc Prep
Runs on http://localhost:8000
"""
import os
import uuid
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from marker.convert import convert_single_pdf
from marker.models import load_all_models

# Initialize FastAPI
app = FastAPI(title="Local Marker Server", version="1.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Storage
conversion_jobs = {}

# Load models at startup
print("Loading Marker models...")
model_list = load_all_models()
print("✅ Models loaded")

def str_to_bool(value: str) -> bool:
    if value is None:
        return False
    return value.lower() in ('true', '1', 'yes', 'on')

@app.post("/marker")
async def convert_pdf(
    file: UploadFile = File(...),
    output_format: str = Form("markdown"),
    langs: Optional[str] = Form(None),
    paginate: str = Form("false"),
    format_lines: str = Form("false"),
    use_llm: str = Form("false"),
    disable_image_extraction: str = Form("false"),
    redo_inline_math: str = Form("false"),
    api_key: Optional[str] = Form(None),
):
    # Parse options
    paginate_bool = str_to_bool(paginate)
    format_lines_bool = str_to_bool(format_lines)
    use_llm_bool = str_to_bool(use_llm)
    disable_image_extraction_bool = str_to_bool(disable_image_extraction)
    redo_inline_math_bool = str_to_bool(redo_inline_math)

    # Generate request ID
    request_id = str(uuid.uuid4())

    # Save file temporarily
    temp_dir = Path("/tmp/marker_uploads")
    temp_dir.mkdir(exist_ok=True)
    file_path = temp_dir / f"{request_id}.pdf"

    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)

    # Store job
    conversion_jobs[request_id] = {
        "status": "processing",
        "file_path": str(file_path),
        "options": {
            "output_format": output_format,
            "langs": langs,
            "paginate": paginate_bool,
            "format_lines": format_lines_bool,
            "use_llm": use_llm_bool,
            "disable_image_extraction": disable_image_extraction_bool,
            "redo_inline_math": redo_inline_math_bool,
            "api_key": api_key,
        },
        "markdown": None,
        "error": None,
    }

    # Process PDF
    try:
        if use_llm_bool and api_key:
            os.environ["GEMINI_API_KEY"] = api_key

        full_text, images, out_meta = convert_single_pdf(
            fname=str(file_path),
            model_list=model_list,
            max_pages=None,
            langs=langs.split(",") if langs else None,
            batch_multiplier=1,
            start_page=None,
            paginate=paginate_bool,
            format_lines=format_lines_bool,
            disable_image_extraction=disable_image_extraction_bool,
            redo_inline_math=redo_inline_math_bool,
        )

        conversion_jobs[request_id]["status"] = "complete"
        conversion_jobs[request_id]["markdown"] = full_text

        # Cleanup
        if os.path.exists(file_path):
            os.remove(file_path)

    except Exception as e:
        conversion_jobs[request_id]["status"] = "error"
        conversion_jobs[request_id]["error"] = str(e)

    return JSONResponse(content={
        "success": True,
        "request_id": request_id,
        "request_check_url": f"http://localhost:8000/status/{request_id}",
    })

@app.get("/status/{request_id}")
async def check_status(request_id: str):
    if request_id not in conversion_jobs:
        raise HTTPException(status_code=404, detail="Request not found")

    job = conversion_jobs[request_id]
    response = {"status": job["status"]}

    if job["status"] == "complete":
        response["markdown"] = job["markdown"]
        del conversion_jobs[request_id]
    elif job["status"] == "error":
        response["error"] = job["error"]
        del conversion_jobs[request_id]

    return JSONResponse(content=response)

@app.get("/")
async def root():
    return {"status": "online", "service": "Local Marker Server"}

if __name__ == "__main__":
    import uvicorn
    print("Starting Local Marker Server on http://localhost:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

3. **Run the server**:

```bash
python marker_server.py
```

4. **Keep the terminal open** - The server must stay running while using AI Doc Prep.

---

## Using Local Mode in AI Doc Prep

Once your local server is running:

1. Open AI Doc Prep in your browser
2. Go to **PDF to Markdown** tool
3. Select **Local (Free)** mode
4. Upload your PDF and configure options
5. Click **Convert to Markdown**

**Optional**: If using **LLM Enhancement**:
- Get a Gemini API key: https://aistudio.google.com/app/apikey
- Enter the key in the Gemini API Key field
- Enable "Use LLM enhancement" option

---

## Troubleshooting

### Server won't start

**Error**: `Address already in use`
- **Solution**: Another process is using port 8000. Either:
  - Stop the other process
  - Or change the port in both the server script and AI Doc Prep constants

**Error**: `ModuleNotFoundError: No module named 'marker'`
- **Solution**: Install marker-pdf: `pip install marker-pdf`

### Connection errors in AI Doc Prep

**Error**: `Unable to connect to local Marker instance`
- **Solution**: Ensure the server is running (`python marker_server.py`)
- Check server output for errors
- Verify server is running on http://localhost:8000

**Error**: `Request timed out`
- **Solution**: First conversion may take longer as models load
- Wait 30-60 seconds for initial model loading
- Subsequent conversions will be faster

### Conversion errors

**Error**: `Gemini API key is required when using LLM enhancement`
- **Solution**: Either:
  - Enter a valid Gemini API key
  - Or disable "Use LLM enhancement" option

**Error**: `Conversion failed`
- Check server logs in the terminal where you ran `marker_server.py`
- Ensure PDF is not corrupted
- Try a smaller/simpler PDF first

---

## Performance Tips

1. **First Run**: Models download on first use (~2GB). This may take several minutes.
2. **GPU Acceleration**: If you have an NVIDIA GPU with CUDA, Marker will automatically use it for faster processing.
3. **Memory**: Close other applications if running out of RAM during conversion.
4. **Keep Server Running**: Don't close the terminal - keep the server running while using AI Doc Prep.

---

## Stopping the Server

When you're done:
1. Go to the terminal running the server
2. Press `Ctrl+C` to stop the server

---

## Comparison: Local vs Cloud Free vs Cloud Paid

| Feature | Local (Free) | Cloud Free | Cloud (Paid) |
|---------|-------------|------------|--------------|
| **Setup** | Python + Server | None | API Key only |
| **Cost** | Free | Free | Paid (credits) |
| **Speed** | Fast (if GPU) | Fast (GPU) | Fastest |
| **Privacy** | Complete | Minimal* | Minimal* |
| **Batch** | No | No | Yes |
| **Options** | All | All | Limited |
| **Cold Start** | No | 30-60s | No |

*Some data sent to servers for processing

**Recommendation**:
- **Local**: Best for privacy-conscious users with technical skills
- **Cloud Free**: Best for most users - no setup, fast, free
- **Cloud Paid**: Best for batch processing and guaranteed uptime

---

## Getting Help

If you encounter issues:
1. Check the [Marker documentation](https://github.com/VikParuchuri/marker)
2. Search [Marker issues](https://github.com/VikParuchuri/marker/issues)
3. Open an issue in the AI Doc Prep repository

---

## Advanced: Auto-Start Server (Optional)

### macOS/Linux: Launch on Startup

1. **Create a launch script** (`~/start_marker.sh`):

```bash
#!/bin/bash
cd /path/to/your/marker_server.py/directory
python3 marker_server.py
```

2. **Make it executable**:

```bash
chmod +x ~/start_marker.sh
```

3. **Add to startup**:
- **macOS**: Add to Login Items in System Preferences
- **Linux**: Add to Startup Applications

### Windows: Task Scheduler

1. Open Task Scheduler
2. Create Basic Task
3. Trigger: At log on
4. Action: Start a program
5. Program: `python`
6. Arguments: `C:\path\to\marker_server.py`

---

**Note**: This is an advanced setup. If this seems too complex, we recommend using **Cloud Free** mode instead, which requires zero setup and works immediately.
