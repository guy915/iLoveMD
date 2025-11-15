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
# Note: We can't pre-initialize models during image build (needs GPU),
# but models will be cached after first use in warm containers
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
    scaledown_window=3600,  # Keep containers alive for 1 hour after last use (free, helps with session-based usage)
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
    # Ensure parent directories exist (in case filename includes folder path like "folder/file.pdf")
    input_file.parent.mkdir(parents=True, exist_ok=True)
    
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
        import traceback
        print(f"[convert_pdf] Error: {error_msg}")
        print(f"[convert_pdf] Traceback: {traceback.format_exc()}")
        if "timeout" in error_msg.lower() or "timed out" in error_msg.lower():
            return {
                "success": False,
                "error": "Conversion timed out (>9 minutes)",
                "request_id": request_id,
            }
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
    volumes={"/tmp/marker-jobs": job_storage_volume},
    scaledown_window=3600,  # Keep containers alive for 1 hour after last use (free, helps with session-based usage)
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
    
    # Store background tasks to prevent garbage collection
    if not hasattr(web_app.state, 'conversion_tasks'):
        web_app.state.conversion_tasks = {}
    
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
        
        # Define async task to run conversion (non-blocking)
        async def run_conversion_task():
            try:
                print(f"[marker_endpoint] Starting conversion for {file.filename}, request_id={request_id}, file_size={len(content)} bytes")
                # Use remote() instead of spawn() - this ensures the function actually runs
                # We run it in a thread pool to avoid blocking the FastAPI event loop
                loop = asyncio.get_event_loop()
                import concurrent.futures
                
                def run_conversion():
                    """Run the conversion in a blocking way"""
                    print(f"[run_conversion] Calling convert_pdf.remote() for {file.filename}")
                    return convert_pdf.remote(
                        pdf_bytes=content,
                        filename=file.filename,
                        output_format=output_format,
                        langs=langs,
                        paginate=paginate_bool,
                        extract_images=not disable_image_extraction_bool,
                    )
                
                print(f"[marker_endpoint] About to call convert_pdf.remote() in thread pool...")
                with concurrent.futures.ThreadPoolExecutor() as executor:
                    result = await loop.run_in_executor(executor, run_conversion)
                
                print(f"[marker_endpoint] convert_pdf result received: success={result.get('success') if result else 'None'}")
                if result:
                    print(f"[marker_endpoint] Result keys: {list(result.keys())}")
                    if result.get("markdown"):
                        print(f"[marker_endpoint] Markdown length: {len(result.get('markdown', ''))}")
                    else:
                        print(f"[marker_endpoint] WARNING: No markdown in result!")
                
                # Update job data
                job_data = load_job(request_id) or {"status": "processing"}
                
                if result and result.get("success"):
                    job_data["status"] = "complete"
                    markdown = result.get("markdown", "")
                    job_data["markdown"] = markdown
                    print(f"[marker_endpoint] Saving job with markdown length: {len(markdown)}")
                else:
                    job_data["status"] = "error"
                    job_data["error"] = result.get("error", "Conversion failed") if result else "No result returned"
                    print(f"[marker_endpoint] Saving job with error: {job_data['error']}")
                
                # Save updated job data
                save_job(request_id, job_data)
                print(f"[marker_endpoint] Job saved. Status: {job_data.get('status')}")
            except Exception as e:
                # Update job with error
                import traceback
                error_msg = f"Conversion error: {str(e)}"
                print(f"[marker_endpoint] Exception in run_conversion_task: {error_msg}")
                print(f"[marker_endpoint] Traceback: {traceback.format_exc()}")
                job_data = load_job(request_id) or {"status": "processing"}
                job_data["status"] = "error"
                job_data["error"] = error_msg
                save_job(request_id, job_data)
            finally:
                # Remove task from storage when done
                if request_id in web_app.state.conversion_tasks:
                    del web_app.state.conversion_tasks[request_id]
        
        # Create and store task to prevent garbage collection
        task = asyncio.create_task(run_conversion_task())
        web_app.state.conversion_tasks[request_id] = task
        
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
            print(f"[check_status] Job not found for request_id: {request_id}")
            raise HTTPException(status_code=404, detail="Request ID not found")
        
        status = job.get("status", "processing")
        print(f"[check_status] Job status for {request_id}: {status}")
        
        response = {"status": status}
        
        if status == "complete":
            markdown = job.get("markdown", "")
            print(f"[check_status] Returning markdown, length: {len(markdown)}")
            response["markdown"] = markdown
            # Clean up after retrieval
            delete_job(request_id)
        elif status == "error":
            error = job.get("error", "Unknown error")
            print(f"[check_status] Returning error: {error}")
            response["error"] = error
            # Clean up after error retrieval
            delete_job(request_id)
        else:
            print(f"[check_status] Job still processing")
        
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
