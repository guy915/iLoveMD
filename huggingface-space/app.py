"""
Marker PDF Converter - HuggingFace Space
Free GPU-powered PDF to Markdown conversion

This Space runs on HuggingFace's free GPU tier (NVIDIA T4)
and provides a REST API for the AI Doc Prep website.
"""

import os
import uuid
import subprocess
import tempfile
import shutil
from pathlib import Path
from typing import Optional, Dict, Any
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Initialize FastAPI
app = FastAPI(
    title="Marker PDF Converter",
    description="Free GPU-powered PDF to Markdown conversion using Marker AI",
    version="1.0.0"
)

# Get base URL from environment or use default
BASE_URL = os.environ.get("BASE_URL", "https://huggingface.co/spaces/YOUR-USERNAME/marker-pdf-converter")

# Configure CORS - allow all origins for public API
# You can restrict this to your domain later: ["https://ai-doc-prep.com"]
allowed_origins_str = os.environ.get("ALLOWED_ORIGINS", "*")
if allowed_origins_str == "*":
    allowed_origins = ["*"]
else:
    allowed_origins = [origin.strip() for origin in allowed_origins_str.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# File size limit (200MB to match Marker API)
MAX_PDF_FILE_SIZE = 200 * 1024 * 1024  # 200MB in bytes

# In-memory job storage
jobs: Dict[str, Dict[str, Any]] = {}

# Temp directories
UPLOAD_DIR = Path(tempfile.gettempdir()) / "marker_uploads"
OUTPUT_DIR = Path(tempfile.gettempdir()) / "marker_outputs"
UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)


def str_to_bool(value: str) -> bool:
    """Convert string to boolean."""
    if value is None:
        return False
    return value.lower() in ('true', '1', 'yes', 'on')


@app.get("/")
async def root():
    """Health check and info endpoint."""
    return {
        "status": "online",
        "service": "Marker PDF Converter",
        "gpu": "NVIDIA T4" if os.path.exists("/dev/nvidia0") else "CPU",
        "mode": "HuggingFace Space (Free)",
        "active_jobs": len(jobs),
        "docs": f"{BASE_URL}/docs"
    }


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
    """
    Convert PDF to markdown using Marker.

    This endpoint receives a PDF, runs marker_single CLI command,
    and returns a request_id for polling status.
    """
    # Validate file
    if not file.filename or not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    # Read file content and validate size
    content = await file.read()
    if len(content) > MAX_PDF_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"PDF file size exceeds the maximum allowed size of {MAX_PDF_FILE_SIZE // (1024 * 1024)} MB"
        )

    if len(content) == 0:
        raise HTTPException(status_code=400, detail="File is empty")

    # Generate unique request ID
    request_id = str(uuid.uuid4())

    # Create temp directories for this job
    job_upload_dir = UPLOAD_DIR / request_id
    job_output_dir = OUTPUT_DIR / request_id
    job_upload_dir.mkdir(exist_ok=True)
    job_output_dir.mkdir(exist_ok=True)

    # Save uploaded PDF
    pdf_path = job_upload_dir / file.filename
    with open(pdf_path, "wb") as f:
        f.write(content)

    # Parse boolean options
    options = {
        "paginate": str_to_bool(paginate),
        "format_lines": str_to_bool(format_lines),
        "use_llm": str_to_bool(use_llm),
        "disable_image_extraction": str_to_bool(disable_image_extraction),
        "redo_inline_math": str_to_bool(redo_inline_math),
    }

    # Build marker_single CLI command
    cmd = [
        "marker_single",
        str(pdf_path),
        str(job_output_dir),
        "--output_format", output_format,
    ]

    # Add optional flags
    if langs:
        cmd.extend(["--langs", langs])
    if options["paginate"]:
        cmd.append("--paginate")
    if options["disable_image_extraction"]:
        cmd.append("--disable_image_extraction")

    # Initialize job
    jobs[request_id] = {
        "status": "processing",
        "pdf_path": str(pdf_path),
        "output_dir": str(job_output_dir),
        "upload_dir": str(job_upload_dir),
        "command": " ".join(cmd),
        "markdown": None,
        "error": None,
    }

    # Start conversion in background (non-blocking)
    import asyncio
    asyncio.create_task(run_conversion(request_id, cmd, options, api_key, pdf_path, job_output_dir, job_upload_dir))

    # Return response immediately
    return JSONResponse(content={
        "success": True,
        "request_id": request_id,
        "request_check_url": f"{BASE_URL}/status/{request_id}",
    })


async def run_conversion(request_id: str, cmd: list, options: dict, api_key: Optional[str], pdf_path: Path, output_dir: Path, upload_dir: Path):
    """Run the marker_single conversion in background."""
    import asyncio

    try:
        # Set environment for LLM
        env = os.environ.copy()
        if options["use_llm"] and api_key:
            env["GEMINI_API_KEY"] = api_key

        print(f"[{request_id}] Starting conversion: {' '.join(cmd)}")

        # Run marker_single command
        process = await asyncio.create_subprocess_exec(
            *cmd,
            env=env,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )

        stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=300)  # 5 min timeout

        if process.returncode == 0:
            # Find the output markdown file
            markdown_files = list(output_dir.glob("*.md"))
            if markdown_files:
                with open(markdown_files[0], "r", encoding="utf-8") as f:
                    markdown = f.read()
                jobs[request_id]["status"] = "complete"
                jobs[request_id]["markdown"] = markdown
                print(f"[{request_id}] Success! ({len(markdown)} chars)")
            else:
                jobs[request_id]["status"] = "error"
                jobs[request_id]["error"] = "No markdown file generated"
                print(f"[{request_id}] Error: No markdown output")
        else:
            error_msg = stderr.decode() if stderr else "Unknown error"
            jobs[request_id]["status"] = "error"
            jobs[request_id]["error"] = f"Marker failed: {error_msg}"
            print(f"[{request_id}] Error: {error_msg}")

    except asyncio.TimeoutError:
        jobs[request_id]["status"] = "error"
        jobs[request_id]["error"] = "Conversion timed out (5 minutes)"
        print(f"[{request_id}] Timeout!")
    except Exception as e:
        jobs[request_id]["status"] = "error"
        jobs[request_id]["error"] = str(e)
        print(f"[{request_id}] Exception: {e}")
    finally:
        # Cleanup temp files
        try:
            shutil.rmtree(upload_dir)
        except:
            pass
        try:
            shutil.rmtree(output_dir)
        except:
            pass


@app.get("/status/{request_id}")
async def check_status(request_id: str):
    """
    Check conversion status.

    Returns:
        - status: "processing" | "complete" | "error"
        - markdown: converted markdown text (if complete)
        - error: error message (if error)
    """
    if request_id not in jobs:
        raise HTTPException(status_code=404, detail="Request ID not found")

    job = jobs[request_id]
    response = {"status": job["status"]}

    if job["status"] == "complete":
        response["markdown"] = job["markdown"]
        # Clean up job after successful retrieval
        del jobs[request_id]
    elif job["status"] == "error":
        response["error"] = job["error"]
        # Clean up job after error retrieval
        del jobs[request_id]

    return JSONResponse(content=response)


@app.get("/health")
async def health_check():
    """Health check for monitoring."""
    return {
        "status": "healthy",
        "active_jobs": len(jobs),
        "gpu_available": os.path.exists("/dev/nvidia0")
    }


# For HuggingFace Spaces gradio interface (optional)
if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting Marker PDF Converter on HuggingFace Space...")
    print(f"📍 GPU: {'NVIDIA T4' if os.path.exists('/dev/nvidia0') else 'CPU (waiting for GPU)'}")
    uvicorn.run(app, host="0.0.0.0", port=7860)
