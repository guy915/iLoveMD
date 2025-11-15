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
from typing import Optional

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

        # Build marker_single command
        cmd = [
            "marker_single",
            str(input_file),
            str(output_dir),
            "--output_format", output_format,
        ]

        # Add optional parameters
        if langs:
            cmd.extend(["--langs", langs])
        if force_ocr:
            cmd.append("--force_ocr")
        if paginate:
            cmd.append("--paginate")
        if not extract_images:
            cmd.append("--disable_image_extraction")

        # Run marker conversion
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=550,  # Slightly less than function timeout
        )

        if result.returncode != 0:
            return {
                "success": False,
                "error": f"Marker conversion failed: {result.stderr}",
                "request_id": request_id,
            }

        # Read the output markdown file
        output_files = list(output_dir.glob("*.md"))
        if not output_files:
            return {
                "success": False,
                "error": "No markdown file generated",
                "request_id": request_id,
            }

        markdown_content = output_files[0].read_text(encoding="utf-8")

        # Read metadata if available
        metadata = {}
        meta_file = output_dir / f"{input_file.stem}_meta.json"
        if meta_file.exists():
            import json
            metadata = json.loads(meta_file.read_text())

        return {
            "success": True,
            "request_id": request_id,
            "markdown": markdown_content,
            "filename": f"{input_file.stem}.md",
            "metadata": metadata,
        }

    except subprocess.TimeoutExpired:
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
    
    web_app = FastAPI()
    
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
    
    # Call the GPU conversion function
    result = convert_pdf.remote(
        pdf_bytes=content,
        filename=file.filename,
        output_format=output_format,
        langs=langs,
        paginate=paginate_bool,
        extract_images=not disable_image_extraction_bool,
    )
    
    if result.get("success"):
        return JSONResponse(content={
            "success": True,
            "request_id": request_id,
            "request_check_url": f"/status/{request_id}",
        })
    else:
        return JSONResponse(
            status_code=500,
            content={"error": result.get("error", "Conversion failed")}
        )
    
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
