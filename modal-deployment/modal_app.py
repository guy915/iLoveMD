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

# Create volume for storing temporary files
volume = modal.Volume.from_name("marker-temp", create_if_missing=True)

# Define the conversion function
@app.function(
    image=image,
    gpu="T4",  # Use NVIDIA T4 GPU (~$2/hour, scales to zero when idle)
    timeout=600,  # 10 minute timeout per conversion
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
@app.function(image=image)
@modal.asgi_app()
def create_app():
    from fastapi import FastAPI, File, UploadFile, Form
    from fastapi.responses import JSONResponse
    import asyncio
    
    web_app = FastAPI()
    
    # In-memory job storage for this app instance
    app_jobs: Dict[str, Dict[str, Any]] = {}
    
    async def run_conversion_async(
        request_id: str,
        pdf_bytes: bytes,
        filename: str,
        output_format: str,
        langs: Optional[str],
        paginate: bool,
        extract_images: bool,
    ):
        """Run conversion asynchronously and update job status"""
        try:
            # Spawn the conversion as a background task (non-blocking)
            # Modal's spawn returns a handle we can poll
            call = convert_pdf.spawn(
                pdf_bytes=pdf_bytes,
                filename=filename,
                output_format=output_format,
                langs=langs,
                paginate=paginate,
                extract_images=extract_images,
            )
            
            # Wait for the result asynchronously
            result = await call
            
            if result.get("success"):
                app_jobs[request_id]["status"] = "complete"
                app_jobs[request_id]["markdown"] = result.get("markdown", "")
            else:
                app_jobs[request_id]["status"] = "error"
                app_jobs[request_id]["error"] = result.get("error", "Conversion failed")
        except Exception as e:
            app_jobs[request_id]["status"] = "error"
            app_jobs[request_id]["error"] = f"Conversion error: {str(e)}"
    
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
        
        # Store job info (in-memory for now - Modal containers are ephemeral)
        # In production, you'd use Modal Volumes or a database
        app_jobs[request_id] = {
            "status": "processing",
            "filename": file.filename,
        }
        
        # Parse boolean options
        def str_to_bool(v: str) -> bool:
            return v.lower() in ('true', '1', 'yes', 'on')
        
        paginate_bool = str_to_bool(paginate)
        disable_image_extraction_bool = str_to_bool(disable_image_extraction)
        
        # Start conversion asynchronously (non-blocking)
        asyncio.create_task(
            run_conversion_async(
                request_id,
                content,
                file.filename,
                output_format,
                langs,
                paginate_bool,
                not disable_image_extraction_bool,
            )
        )
        
        # Return immediately with request_id for polling
        base_url = os.environ.get("MODAL_ENDPOINT_URL", "")
        return JSONResponse(content={
            "success": True,
            "request_id": request_id,
            "request_check_url": f"{base_url}/status/{request_id}",
        })
    
    @web_app.get("/status/{request_id}")
    async def check_status(request_id: str):
        """Check conversion status"""
        from fastapi import HTTPException
        
        if request_id not in app_jobs:
            raise HTTPException(status_code=404, detail="Request ID not found")
        
        job = app_jobs[request_id]
        response = {"status": job["status"]}
        
        if job["status"] == "complete":
            response["markdown"] = job["markdown"]
            # Clean up after retrieval
            del app_jobs[request_id]
        elif job["status"] == "error":
            response["error"] = job["error"]
            # Clean up after error retrieval
            del app_jobs[request_id]
        
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
