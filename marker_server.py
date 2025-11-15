#!/usr/bin/env python3
"""
Modal Server - Simple HTTP server that runs Marker CLI commands

This server receives PDF files from the website and runs marker_single CLI commands.
No Docker required - just install marker-pdf via pip.

Installation:
    pip install marker-pdf fastapi uvicorn python-multipart

Usage:
    python marker_server.py

Then open http://localhost:3000 and use Local mode!
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

# Initialize FastAPI app
app = FastAPI(
    title="Modal Server",
    description="Simple server for running Marker CLI locally",
    version="1.0.0"
)

# Enable CORS so the website can talk to this server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Store conversion jobs (in-memory)
jobs: Dict[str, Dict[str, Any]] = {}

# Temp directories
UPLOAD_DIR = Path(tempfile.gettempdir()) / "marker_uploads"
OUTPUT_DIR = Path(tempfile.gettempdir()) / "marker_outputs"
UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)


def str_to_bool(value: str) -> bool:
    """Convert string to boolean."""
    return value.lower() in ('true', '1', 'yes')


@app.get("/")
async def root():
    """Health check."""
    return {
        "status": "online",
        "service": "Modal Server",
        "active_jobs": len(jobs)
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
    Convert PDF to markdown using Marker CLI.

    This runs the actual marker_single command with your options.
    """
    # Validate file
    if not file.filename or not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

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
        content = await file.read()
        f.write(content)

    # Parse boolean options
    paginate_bool = str_to_bool(paginate)
    format_lines_bool = str_to_bool(format_lines)
    use_llm_bool = str_to_bool(use_llm)
    disable_image_extraction_bool = str_to_bool(disable_image_extraction)
    redo_inline_math_bool = str_to_bool(redo_inline_math)

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
    if paginate_bool:
        cmd.append("--paginate")
    if disable_image_extraction_bool:
        cmd.append("--disable_image_extraction")

    # Set environment variables for LLM
    env = os.environ.copy()
    if use_llm_bool and api_key:
        env["GEMINI_API_KEY"] = api_key

    # Initialize job
    jobs[request_id] = {
        "status": "processing",
        "pdf_path": str(pdf_path),
        "output_dir": str(job_output_dir),
        "command": " ".join(cmd),
        "markdown": None,
        "error": None,
    }

    # Run marker_single command in background
    try:
        print(f"[{request_id}] Running: {' '.join(cmd)}")
        result = subprocess.run(
            cmd,
            env=env,
            capture_output=True,
            text=True,
            timeout=300  # 5 minute timeout
        )

        if result.returncode == 0:
            # Find the output markdown file
            markdown_files = list(job_output_dir.glob("*.md"))
            if markdown_files:
                with open(markdown_files[0], "r", encoding="utf-8") as f:
                    markdown = f.read()
                jobs[request_id]["status"] = "complete"
                jobs[request_id]["markdown"] = markdown
                print(f"[{request_id}] Conversion complete! ({len(markdown)} chars)")
            else:
                jobs[request_id]["status"] = "error"
                jobs[request_id]["error"] = "No markdown file generated"
                print(f"[{request_id}] Error: No markdown file found")
        else:
            jobs[request_id]["status"] = "error"
            jobs[request_id]["error"] = f"Marker failed: {result.stderr}"
            print(f"[{request_id}] Error: {result.stderr}")

    except subprocess.TimeoutExpired:
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
            shutil.rmtree(job_upload_dir)
        except:
            pass

    # Return response
    return JSONResponse(content={
        "success": True,
        "request_id": request_id,
        "request_check_url": f"http://localhost:8000/status/{request_id}",
    })


@app.get("/status/{request_id}")
async def check_status(request_id: str):
    """
    Check conversion status.

    The website polls this endpoint to get the result.
    """
    if request_id not in jobs:
        raise HTTPException(status_code=404, detail="Request ID not found")

    job = jobs[request_id]
    response = {"status": job["status"]}

    if job["status"] == "complete":
        response["markdown"] = job["markdown"]
        # Cleanup job after retrieval
        try:
            shutil.rmtree(job["output_dir"])
        except:
            pass
        del jobs[request_id]
    elif job["status"] == "error":
        response["error"] = job["error"]
        # Cleanup job after error
        del jobs[request_id]

    return JSONResponse(content=response)


if __name__ == "__main__":
    import uvicorn

    print("\n" + "="*60)
    print("🚀 Modal Server Starting...")
    print("="*60)
    print("📍 Server: http://localhost:8000")
    print("🌐 Website: http://localhost:3000")
    print("📝 Select 'Modal' mode in the website")
    print("✅ Keep this terminal open!")
    print("🛑 Press Ctrl+C to stop")
    print("="*60 + "\n")

    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
