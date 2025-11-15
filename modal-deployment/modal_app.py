"""
Marker PDF Converter - Modal Deployment

Free serverless GPU-powered PDF to Markdown conversion using Modal.com

Modal provides $30/month in free credits (renews monthly).
GPU usage is pay-per-second, only when processing.
"""

import modal
import os
import uuid
from pathlib import Path
from typing import Optional, Dict, Any

# Create Modal app
app = modal.App("marker-pdf-converter")

# Define the container image with Marker dependencies
image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install("marker-pdf")
    .pip_install("fastapi[standard]")
    .pip_install("python-multipart")
)

# Create volume for storing temporary files and job state
volume = modal.Volume.from_name("marker-temp", create_if_missing=True)
job_storage_volume = modal.Volume.from_name("marker-jobs", create_if_missing=True)

# Define the conversion function
@app.function(
    image=image,
    gpu="T4",  # Use NVIDIA T4 GPU (~$2/hour, scales to zero when idle)
    timeout=1800,  # 30 minute timeout per conversion (Marker can be slow for complex PDFs)
    volumes={"/tmp/marker": volume},
)
@modal.concurrent(max_inputs=10)  # Handle up to 10 concurrent requests
def convert_pdf(
    pdf_bytes: bytes,
    filename: str,
    output_format: str = "markdown",
    langs: Optional[str] = None,
    force_ocr: bool = False,
    paginate: bool = False,
    extract_images: bool = True,
) -> dict:
    """
    Convert a PDF file to Markdown using Marker AI.

    Args:
        pdf_bytes: PDF file content as bytes
        filename: Original filename
        output_format: Output format (markdown, json, html)
        langs: Comma-separated language codes (e.g., "en,es")
        force_ocr: Force OCR even if text is extractable
        paginate: Add page separators
        extract_images: Extract images from PDF

    Returns:
        Dictionary with conversion results
    """
    import subprocess
    import tempfile
    import shutil

    # Create unique request ID
    request_id = str(uuid.uuid4())

    # Create temporary directories
    temp_dir = Path(f"/tmp/marker/{request_id}")
    temp_dir.mkdir(parents=True, exist_ok=True)

    input_file = temp_dir / filename
    output_dir = temp_dir / "output"
    output_dir.mkdir(parents=True, exist_ok=True)

    try:
        # Write PDF bytes to file
        input_file.write_bytes(pdf_bytes)

        # Use Marker Python API directly (as per official README)
        from marker.converters.pdf import PdfConverter
        from marker.models import create_model_dict
        from marker.output import text_from_rendered
        from marker.config.parser import ConfigParser
        
        # Create configuration
        config_dict = {
            "output_format": output_format,
        }
        
        if not extract_images:
            config_dict["disable_image_extraction"] = True
        
        if paginate:
            config_dict["paginate_output"] = True
        
        if langs:
            config_dict["langs"] = langs.split(",") if "," in langs else [langs]
        
        config_parser = ConfigParser(config_dict)
        
        # Create converter with models
        converter = PdfConverter(
            artifact_dict=create_model_dict(),
            config=config_parser.generate_config_dict(),
            processor_list=config_parser.get_processors(),
            renderer=config_parser.get_renderer(),
        )
        
        # Convert PDF
        rendered = converter(str(input_file))
        
        # Extract text and images from rendered output
        markdown_content, _, images = text_from_rendered(rendered)
        
        # Get metadata from rendered object
        metadata = rendered.metadata if hasattr(rendered, 'metadata') else {}

        return {
            "success": True,
            "request_id": request_id,
            "markdown": markdown_content,
            "filename": f"{input_file.stem}.md",
            "metadata": metadata,
        }

    except Exception as e:
        # Catch all exceptions including timeouts
        error_msg = str(e)
        if "timeout" in error_msg.lower() or "timed out" in error_msg.lower():
            return {
                "success": False,
                "error": "Conversion timed out (>9 minutes)",
                "request_id": request_id,
            }
    except Exception as e:
        return {
            "success": False,
            "error": f"Unexpected error: {str(e)}",
            "request_id": request_id,
        }
    finally:
        # Cleanup temporary files
        if temp_dir.exists():
            shutil.rmtree(temp_dir, ignore_errors=True)


# Create FastAPI web endpoint
@app.function(
    image=image,
    volumes={"/tmp/marker-jobs": job_storage_volume}
)
@modal.asgi_app()
def create_app():
    from fastapi import FastAPI, File, UploadFile, Form
    from fastapi.responses import JSONResponse
    from fastapi.middleware.cors import CORSMiddleware
    import asyncio
    
    web_app = FastAPI()
    
    # Enable CORS for all origins (since this is a public API)
    web_app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Job storage path on volume (persists across container restarts)
    JOB_STORAGE_PATH = "/tmp/marker-jobs"
    
    def get_job_path(request_id: str) -> str:
        """Get file path for storing job data"""
        import os
        os.makedirs(JOB_STORAGE_PATH, exist_ok=True)
        return f"{JOB_STORAGE_PATH}/{request_id}.json"
    
    def load_job(request_id: str) -> Optional[Dict[str, Any]]:
        """Load job from persistent storage"""
        import json
        job_path = get_job_path(request_id)
        if os.path.exists(job_path):
            try:
                with open(job_path, 'r') as f:
                    return json.load(f)
            except:
                return None
        return None
    
    def save_job(request_id: str, job_data: Dict[str, Any]):
        """Save job to persistent storage with sync to ensure visibility"""
        import json
        import os
        job_path = get_job_path(request_id)
        os.makedirs(os.path.dirname(job_path), exist_ok=True)
        with open(job_path, 'w') as f:
            json.dump(job_data, f)
            f.flush()  # Flush to ensure data is written
            os.fsync(f.fileno())  # Force sync to disk for Modal Volume
    
    def delete_job(request_id: str):
        """Delete job from persistent storage"""
        import os
        job_path = get_job_path(request_id)
        if os.path.exists(job_path):
            os.remove(job_path)
    
    @web_app.post("/marker")
    async def marker_endpoint(
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
        Web endpoint for PDF conversion - matches HuggingFace API format.
        """
        import tempfile
        import shutil
        from pathlib import Path
        
        # Validate file
        if not file.filename or not file.filename.lower().endswith('.pdf'):
            return JSONResponse(
                status_code=400,
                content={"error": "Only PDF files are supported"}
            )
        
        # Read file content
        content = await file.read()
        
        # Validate file size (200MB limit)
        MAX_PDF_FILE_SIZE = 200 * 1024 * 1024
        if len(content) > MAX_PDF_FILE_SIZE:
            return JSONResponse(
                status_code=413,
                content={"error": f"PDF file size exceeds {MAX_PDF_FILE_SIZE // (1024 * 1024)} MB"}
            )
        
        # Generate request ID
        request_id = str(uuid.uuid4())
        
        # Parse boolean options
        def str_to_bool(v: str) -> bool:
            return v.lower() in ('true', '1', 'yes', 'on')
        
        paginate_bool = str_to_bool(paginate)
        disable_image_extraction_bool = str_to_bool(disable_image_extraction)
        
        # Store job info in persistent storage (Modal Volume) BEFORE starting conversion
        # This ensures the job exists when status is checked
        job_data = {
            "status": "processing",
            "filename": file.filename,
        }
        save_job(request_id, job_data)
        
        # Start conversion in background using asyncio.create_task (better for FastAPI)
        async def run_conversion_async():
            try:
                # Spawn the conversion (non-blocking)
                call = convert_pdf.spawn(
                    pdf_bytes=content,
                    filename=file.filename,
                    output_format=output_format,
                    langs=langs,
                    paginate=paginate_bool,
                    extract_images=not disable_image_extraction_bool,
                )
                
                # Wait for result (this will block the async task, not the endpoint)
                result = await asyncio.to_thread(call.get)
                
                # Update job data
                job_data = load_job(request_id) or {"status": "processing"}
                
                if result.get("success"):
                    job_data["status"] = "complete"
                    job_data["markdown"] = result.get("markdown", "")
                else:
                    job_data["status"] = "error"
                    job_data["error"] = result.get("error", "Conversion failed")
                
                # Save updated job data
                save_job(request_id, job_data)
            except Exception as e:
                # Update job with error
                job_data = load_job(request_id) or {"status": "processing"}
                job_data["status"] = "error"
                job_data["error"] = f"Conversion error: {str(e)}"
                save_job(request_id, job_data)
        
        # Start async task (non-blocking, better than threading for FastAPI)
        asyncio.create_task(run_conversion_async())
        
        # Return immediately with request_id for polling
        return JSONResponse(content={
            "success": True,
            "request_id": request_id,
            "request_check_url": f"/status/{request_id}",
        })
    
    @web_app.get("/status/{request_id}")
    async def check_status(request_id: str):
        """Check conversion status with retry for eventual consistency"""
        from fastapi import HTTPException
        import time
        
        # Retry loading job (Modal Volumes may have eventual consistency)
        max_retries = 3
        retry_delay = 0.1  # 100ms
        
        for attempt in range(max_retries):
            job = load_job(request_id)
            if job:
                break
            if attempt < max_retries - 1:
                time.sleep(retry_delay)
        
        if not job:
            raise HTTPException(status_code=404, detail="Request ID not found")
        
        response = {"status": job.get("status", "processing")}
        
        if job.get("status") == "complete":
            response["markdown"] = job.get("markdown", "")
            # Clean up after retrieval
            delete_job(request_id)
        elif job.get("status") == "error":
            response["error"] = job.get("error", "Unknown error")
            # Clean up after error retrieval
            delete_job(request_id)
        
        return response
    
    @web_app.get("/health")
    def health():
        """Health check endpoint"""
        return {
            "status": "online",
            "service": "Marker PDF Converter (Modal)",
            "version": "1.0.0",
            "gpu": "NVIDIA T4",
            "platform": "Modal.com",
        }
    
    return web_app


# Local testing
@app.local_entrypoint()
def test():
    """Test the conversion locally"""
    print("Testing Marker PDF Converter...")

    # Test with a small PDF (you'd need to provide test.pdf)
    test_pdf = Path("test.pdf")
    if not test_pdf.exists():
        print("No test.pdf found, skipping test")
        return

    result = convert_pdf.remote(
        pdf_bytes=test_pdf.read_bytes(),
        filename="test.pdf",
        output_format="markdown",
    )

    if result["success"]:
        print(f"✅ Conversion successful!")
        print(f"Markdown length: {len(result['markdown'])} characters")
    else:
        print(f"❌ Conversion failed: {result['error']}")
