"""
FastAPI server for Marker PDF conversion on HuggingFace Spaces
Cloud Free mode - runs on HuggingFace's free GPU tier
"""
import os
import uuid
import shutil
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import marker
from marker.convert import convert_single_pdf
from marker.models import load_all_models

# Initialize FastAPI app
app = FastAPI(title="Marker PDF Converter", version="1.0.0")

# Configure CORS to allow requests from your Next.js app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with your domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Storage for conversion jobs (in-memory for simplicity)
# In production, you'd use Redis or a database
conversion_jobs = {}

# Create temp directories
UPLOAD_DIR = Path("/tmp/marker_uploads")
OUTPUT_DIR = Path("/tmp/marker_outputs")
UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

# Load Marker models at startup (GPU optimized)
print("Loading Marker models...")
model_list = load_all_models()
print("✅ Models loaded successfully")


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
        "service": "Marker PDF Converter",
        "mode": "Cloud Free (HuggingFace GPU)",
        "gpu_available": os.environ.get("CUDA_VISIBLE_DEVICES") is not None
    }


@app.post("/convert")
async def convert_pdf(
    file: UploadFile = File(...),
    output_format: str = Form("markdown"),
    langs: Optional[str] = Form(None),
    paginate: str = Form("false"),
    format_lines: str = Form("false"),
    use_llm: str = Form("false"),
    disable_image_extraction: str = Form("false"),
    redo_inline_math: str = Form("false"),
    geminiApiKey: Optional[str] = Form(None),
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

    # Validate Gemini API key if use_llm is enabled
    if use_llm_bool and not geminiApiKey:
        raise HTTPException(
            status_code=400,
            detail="Gemini API key is required when LLM Enhancement is enabled"
        )

    # Generate unique request ID
    request_id = str(uuid.uuid4())

    # Save uploaded file
    file_path = UPLOAD_DIR / f"{request_id}.pdf"
    with open(file_path, "wb") as f:
        content = await file.read()
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
            "gemini_api_key": geminiApiKey,
        },
        "markdown": None,
        "error": None,
    }

    # Start background conversion (async processing)
    # Note: For HF Spaces, we'll process synchronously but mark as processing
    # to maintain API compatibility with local mode
    try:
        # Process the PDF
        markdown_text = await process_pdf(request_id)
        conversion_jobs[request_id]["status"] = "complete"
        conversion_jobs[request_id]["markdown"] = markdown_text
    except Exception as e:
        conversion_jobs[request_id]["status"] = "error"
        conversion_jobs[request_id]["error"] = str(e)

    # Return response
    return JSONResponse(content={
        "success": True,
        "request_id": request_id,
        "request_check_url": f"/check/{request_id}",
    })


async def process_pdf(request_id: str) -> str:
    """Process PDF file with Marker."""
    job = conversion_jobs[request_id]
    file_path = job["file_path"]
    options = job["options"]

    # Set Gemini API key if provided
    if options["use_llm"] and options["gemini_api_key"]:
        os.environ["GEMINI_API_KEY"] = options["gemini_api_key"]

    # Convert PDF to markdown
    full_text, images, out_meta = convert_single_pdf(
        fname=file_path,
        model_list=model_list,
        max_pages=None,
        langs=options["langs"].split(",") if options["langs"] else None,
        batch_multiplier=1,
        start_page=None,
        # Marker options
        paginate=options["paginate"],
        format_lines=options["format_lines"],
        disable_image_extraction=options["disable_image_extraction"],
        redo_inline_math=options["redo_inline_math"],
    )

    # Clean up uploaded file
    if os.path.exists(file_path):
        os.remove(file_path)

    return full_text


@app.get("/check/{request_id}")
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

    response = {
        "status": job["status"],
    }

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
    """Health check for HuggingFace Spaces."""
    return {
        "status": "healthy",
        "active_jobs": len(conversion_jobs),
        "gpu": os.environ.get("CUDA_VISIBLE_DEVICES", "No GPU detected"),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7860)  # HF Spaces uses port 7860
