"""
Local Marker Server for AI Doc Prep
Runs on http://localhost:8000

This server allows you to run Marker PDF conversion locally on your machine.
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

# Configure CORS - allow all origins for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# File size limit (200MB)
MAX_PDF_FILE_SIZE = 200 * 1024 * 1024  # 200MB in bytes

# Storage for conversion jobs (in-memory)
conversion_jobs = {}

# Create temp directories
UPLOAD_DIR = Path("/tmp/marker_uploads")
OUTPUT_DIR = Path("/tmp/marker_outputs")
UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

# Load models at startup
print("🔄 Loading Marker models (this may take a few minutes on first run)...")
model_list = load_all_models()
print("✅ Models loaded successfully! Server is ready.")


def str_to_bool(value: str) -> bool:
    """Convert string to boolean."""
    if value is None:
        return False
    return value.lower() in ('true', '1', 'yes', 'on')


@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "status": "online",
        "service": "Local Marker Server",
        "mode": "Local (Free)",
        "active_jobs": len(conversion_jobs)
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

    Returns request_id and check URL for polling status.
    """
    # Validate file
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    # Parse boolean options
    paginate_bool = str_to_bool(paginate)
    format_lines_bool = str_to_bool(format_lines)
    use_llm_bool = str_to_bool(use_llm)
    disable_image_extraction_bool = str_to_bool(disable_image_extraction)
    redo_inline_math_bool = str_to_bool(redo_inline_math)

    # Generate unique request ID
    request_id = str(uuid.uuid4())

    # Save uploaded file with size validation
    file_path = UPLOAD_DIR / f"{request_id}.pdf"
    job_initialized = False

    try:
        # Read file content with size validation
        content = await file.read()
        if len(content) > MAX_PDF_FILE_SIZE:
            raise HTTPException(
                status_code=413,
                detail=f"PDF file size exceeds the maximum allowed size of {MAX_PDF_FILE_SIZE // (1024 * 1024)} MB"
            )

        # Save file
        with open(file_path, "wb") as f:
            f.write(content)

        # Initialize job status
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
        job_initialized = True

        # Process PDF
        try:
            # Set Gemini API key if using LLM
            original_key = os.environ.get("GEMINI_API_KEY")
            if use_llm_bool and api_key:
                os.environ["GEMINI_API_KEY"] = api_key

            try:
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

                # Cleanup uploaded file
                if os.path.exists(file_path):
                    os.remove(file_path)
            finally:
                # Restore original API key
                if original_key:
                    os.environ["GEMINI_API_KEY"] = original_key
                elif "GEMINI_API_KEY" in os.environ:
                    del os.environ["GEMINI_API_KEY"]

        except Exception as e:
            conversion_jobs[request_id]["status"] = "error"
            conversion_jobs[request_id]["error"] = str(e)

        # Return response
        return JSONResponse(content={
            "success": True,
            "request_id": request_id,
            "request_check_url": f"http://localhost:8000/status/{request_id}",
        })

    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        # Cleanup orphaned file if job not initialized
        if file_path.exists() and not job_initialized:
            try:
                file_path.unlink()
            except Exception:
                pass
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process file: {str(e)}"
        )


@app.get("/status/{request_id}")
async def check_status(request_id: str):
    """
    Check conversion status.

    Returns:
    - status: "processing" | "complete" | "error"
    - markdown: converted text (if complete)
    - error: error message (if error)
    """
    if request_id not in conversion_jobs:
        raise HTTPException(status_code=404, detail="Request ID not found")

    job = conversion_jobs[request_id]
    response = {"status": job["status"]}

    if job["status"] == "complete":
        response["markdown"] = job["markdown"]
        # Clean up job after successful retrieval
        del conversion_jobs[request_id]
    elif job["status"] == "error":
        response["error"] = job["error"]
        # Clean up job after error retrieval
        del conversion_jobs[request_id]

    return JSONResponse(content=response)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "active_jobs": len(conversion_jobs),
    }


if __name__ == "__main__":
    import uvicorn
    print("\n" + "="*60)
    print("🚀 Starting Local Marker Server")
    print("="*60)
    print(f"📍 Server will run on: http://localhost:8000")
    print(f"✅ Keep this terminal open while using AI Doc Prep")
    print(f"🛑 Press Ctrl+C to stop the server")
    print("="*60 + "\n")
    uvicorn.run(app, host="0.0.0.0", port=8000)
