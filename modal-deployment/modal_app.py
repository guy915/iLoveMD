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
    allow_concurrent_inputs=10,  # Handle up to 10 concurrent requests
)
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
@modal.web_endpoint(method="POST")
def marker_endpoint(
    file: bytes = modal.web_endpoint.FileUpload(),
    filename: str = "document.pdf",
    output_format: str = "markdown",
    langs: Optional[str] = None,
    force_ocr: bool = False,
    paginate: bool = False,
    extract_images: bool = True,
):
    """
    Web endpoint for PDF conversion.

    POST to this endpoint with:
    - file: PDF file (multipart/form-data)
    - filename: Original filename
    - output_format: markdown, json, or html
    - langs: Language codes (comma-separated)
    - force_ocr: Force OCR (boolean)
    - paginate: Add page breaks (boolean)
    - extract_images: Extract images (boolean)
    """
    # Call the GPU conversion function
    result = convert_pdf.remote(
        pdf_bytes=file,
        filename=filename,
        output_format=output_format,
        langs=langs,
        force_ocr=force_ocr,
        paginate=paginate,
        extract_images=extract_images,
    )

    return result


# Health check endpoint
@app.function()
@modal.web_endpoint(method="GET")
def health():
    """Health check endpoint"""
    return {
        "status": "online",
        "service": "Marker PDF Converter (Modal)",
        "version": "1.0.0",
        "gpu": "NVIDIA T4",
        "platform": "Modal.com",
    }


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
