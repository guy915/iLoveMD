"""
Marker PDF Converter - Modal Deployment

Free serverless GPU-powered PDF to Markdown conversion using Modal.com

Modal provides $30/month in free credits (renews monthly).
GPU usage is pay-per-second, only when processing.
"""

import modal
import os
import uuid
import threading
import time
from pathlib import Path
from typing import Optional, Dict, Any

# Lock to prevent concurrent model initialization within a container (fixes meta tensor error)
_model_init_lock = threading.Lock()
# Models loaded once per container and shared by its requests. Loading them for every
# PDF was slow and kept one copy per concurrent request in GPU memory.
_artifact_dict = None

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

# --- Abuse protection -------------------------------------------------------
# The /marker endpoint is public (the browser calls it directly for large PDFs), so
# it only accepts a short-lived token signed by the iLoveMD server with a shared
# secret (see src/lib/server/modalToken.ts). Each token works once, and conversions
# are counted per client IP (hashed) and in total per day to cap GPU spending.
#
# Create the secret once (same value as MODAL_TOKEN_SECRET on Vercel):
#   modal secret create ilovemd-modal-token MODAL_TOKEN_SECRET=<random string>
token_secret = modal.Secret.from_name("ilovemd-modal-token")
rate_limits = modal.Dict.from_name("ilovemd-rate-limits", create_if_missing=True)

MAX_CONVERSIONS_PER_IP_PER_HOUR = 20
MAX_CONVERSIONS_PER_DAY = 150
TOKEN_MAX_TTL_SECONDS = 15 * 60


def check_request_token(token: Optional[str]) -> Optional[str]:
    """Validate a request token and count it against the rate limits.

    Returns an error message, or None when the request may proceed.
    """
    import hashlib
    import hmac
    import base64

    secret = os.environ.get("MODAL_TOKEN_SECRET", "").strip()
    if not secret:
        # Not configured (e.g. a personal test deployment): allow everything
        return None
    if not token:
        return "Missing access token. Please reload the page and try again."

    parts = token.split(".")
    if len(parts) != 4:
        return "Invalid access token. Please reload the page and try again."
    expires_at_str, nonce, ip_hash, signature = parts
    payload = f"{expires_at_str}.{nonce}.{ip_hash}"
    expected = base64.urlsafe_b64encode(
        hmac.new(secret.encode(), payload.encode(), hashlib.sha256).digest()
    ).rstrip(b"=").decode()
    if not hmac.compare_digest(expected, signature):
        return "Invalid access token. Please reload the page and try again."

    now = int(time.time())
    try:
        expires_at = int(expires_at_str)
    except ValueError:
        return "Invalid access token. Please reload the page and try again."
    if expires_at < now or expires_at > now + TOKEN_MAX_TTL_SECONDS:
        return "Access token expired. Please reload the page and try again."

    # Each token works once
    nonce_key = f"nonce:{nonce}"
    if rate_limits.contains(nonce_key):
        return "Access token already used. Please try again."
    rate_limits.put(nonce_key, expires_at)

    # Per-IP hourly and global daily limits (counters are approximate under heavy concurrency)
    hour_key = f"ip:{ip_hash}:{now // 3600}"
    day_key = f"day:{now // 86400}"
    ip_count = rate_limits.get(hour_key, 0)
    day_count = rate_limits.get(day_key, 0)
    if ip_count >= MAX_CONVERSIONS_PER_IP_PER_HOUR:
        return "Too many conversions from your network. Please try again in an hour."
    if day_count >= MAX_CONVERSIONS_PER_DAY:
        return "The free converter has reached its daily limit. Please try again tomorrow, or use your own Marker API key."
    rate_limits.put(hour_key, ip_count + 1)
    rate_limits.put(day_key, day_count + 1)
    return None

def get_models():
    """Load Marker's models once per container (thread-safe), with retries for the
    intermittent "meta tensor" error in the surya library."""
    global _artifact_dict
    if _artifact_dict is not None:
        return _artifact_dict

    from marker.models import create_model_dict

    with _model_init_lock:
        if _artifact_dict is not None:
            return _artifact_dict
        max_retries = 3
        for attempt in range(max_retries):
            try:
                print(f"[get_models] Attempt {attempt + 1}: initializing models...")
                _artifact_dict = create_model_dict()
                print("[get_models] Models initialized")
                return _artifact_dict
            except Exception as e:
                error_msg = str(e)
                if "meta tensor" in error_msg.lower() and attempt < max_retries - 1:
                    wait_time = 2 ** (attempt + 1)
                    print(f"[get_models] Meta tensor error, retrying in {wait_time}s: {error_msg}")
                    time.sleep(wait_time)
                else:
                    raise
    raise RuntimeError("Failed to initialize models after all retries")


def encode_images(images: Dict[str, Any]) -> Dict[str, str]:
    """Encode Marker's extracted images (name -> PIL image) as base64 strings."""
    import base64
    import io

    encoded: Dict[str, str] = {}
    for name, image in (images or {}).items():
        try:
            fmt = "PNG" if name.lower().endswith(".png") else "JPEG"
            if fmt == "JPEG" and image.mode not in ("RGB", "L"):
                image = image.convert("RGB")
            buffer = io.BytesIO()
            image.save(buffer, format=fmt)
            encoded[name] = base64.b64encode(buffer.getvalue()).decode("ascii")
        except Exception as e:
            print(f"[encode_images] Skipping image {name}: {e}")
    return encoded


# Define the conversion function
@app.function(
    image=image,
    gpu="T4",  # Use NVIDIA T4 GPU (~$2/hour, scales to zero when idle)
    timeout=7200,  # 2 hour timeout per conversion (safe buffer for very large/complex academic PDFs)
    volumes={"/tmp/marker": volume},
    # Stay warm for 2 minutes after the last job: covers back-to-back files in a batch
    # without paying for 15 idle GPU minutes after every visit
    scaledown_window=120,
    max_containers=2,  # Hard cap on parallel GPUs (cost limit)
)
@modal.concurrent(max_inputs=4)  # Up to 4 PDFs at once per GPU (T4 has 16 GB)
def convert_pdf(
    pdf_bytes: bytes,
    filename: str,
    output_format: str = "markdown",
    langs: Optional[str] = None,
    force_ocr: bool = False,
    paginate: bool = False,
    extract_images: bool = True,
    use_llm: bool = False,
    api_key: Optional[str] = None,
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
        use_llm: Enable LLM enhancement (requires api_key)
        api_key: Gemini API key (required if use_llm=True)

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

    # Use only the base name: the filename comes from the client, and a value like
    # "../../x.pdf" or "/abs/x.pdf" would otherwise write outside temp_dir
    safe_name = Path(filename).name or "input.pdf"
    input_file = temp_dir / safe_name
    
    output_dir = temp_dir / "output"
    output_dir.mkdir(parents=True, exist_ok=True)

    try:
        # Write PDF bytes to file
        input_file.write_bytes(pdf_bytes)

        # Use Marker Python API directly (as per official README)
        from marker.converters.pdf import PdfConverter
        from marker.output import text_from_rendered
        from marker.config.parser import ConfigParser
        
        # Pass the Gemini key only through this request's config. Never set it in
        # os.environ: the container serves up to 10 requests at once and stays warm,
        # so an env var would leak one user's key to other users' requests.
        if use_llm and not api_key:
            print(f"[convert_pdf] WARNING: use_llm=True but no api_key provided")
        
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
        
        # Enable LLM if requested
        if use_llm:
            config_dict["use_llm"] = True
            if api_key:
                config_dict["gemini_api_key"] = api_key
        
        config_parser = ConfigParser(config_dict)
        
        # DIAGNOSTIC: Check cache locations and container info
        cache_locations = {
            "HF_HOME": os.environ.get("HF_HOME", "NOT SET"),
            "HUGGINGFACE_HUB_CACHE": os.environ.get("HUGGINGFACE_HUB_CACHE", "NOT SET"),
            "HOME": os.environ.get("HOME", "NOT SET"),
            "default_cache": str(Path.home() / ".cache" / "huggingface"),
            "container_id": os.environ.get("MODAL_CONTAINER_ID", "NOT SET"),
        }
        print(f"[DIAGNOSTIC] Cache locations: {cache_locations}")
        print(f"[DIAGNOSTIC] Process ID: {os.getpid()}")
        print(f"[DIAGNOSTIC] Thread ID: {threading.get_ident()}")
        
        artifact_dict = get_models()
        
        if artifact_dict is None:
            raise RuntimeError("Failed to initialize models after all retries")
        
        # Get generated config (generate once and reuse)
        generated_config = config_parser.generate_config_dict()
        
        # Ensure gemini_api_key is in the config if LLM is enabled
        # ConfigParser may filter it out, so we add it manually as a safety measure
        if use_llm and api_key and "gemini_api_key" not in generated_config:
            generated_config["gemini_api_key"] = api_key
        
        converter = PdfConverter(
            artifact_dict=artifact_dict,
            config=generated_config,
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
            "images": encode_images(images) if extract_images else {},
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
                "error": "Conversion timed out",
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
    secrets=[token_secret],
    scaledown_window=900,  # Keep containers alive for 15 minutes after last use (covers typical sessions, you pay for GPU time during this period)
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

    # A finished job is kept this long, so a client whose status response got lost
    # can ask again (it used to be deleted on the first read, and then reported
    # "processing" forever).
    FINISHED_JOB_TTL_SECONDS = 6 * 60 * 60
    # A job still "processing" after this long was interrupted (for example, the
    # container stopped). The conversion function itself times out at 7200 s.
    MAX_PROCESSING_SECONDS = 7200 + 600
    
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
        # Write to a temp file and rename, so a reader never sees half-written JSON
        tmp_path = f"{job_path}.tmp"
        with open(tmp_path, 'w') as f:
            json.dump(job_data, f)
            f.flush()  # Flush to ensure data is written
            os.fsync(f.fileno())  # Force sync to disk for Modal Volume
        os.replace(tmp_path, job_path)
        # Make the change visible to other web containers (they only see committed data)
        try:
            job_storage_volume.commit()
        except Exception as e:
            print(f"[save_job] Volume commit failed (will be committed in the background): {e}")
    
    async def reload_jobs():
        """Pick up jobs saved by other web containers"""
        try:
            await job_storage_volume.reload.aio()
        except Exception as e:
            print(f"[reload_jobs] Volume reload failed: {e}")

    def cleanup_old_jobs():
        """Delete finished jobs older than the TTL"""
        import os
        now = time.time()
        try:
            names = os.listdir(JOB_STORAGE_PATH)
        except FileNotFoundError:
            return
        for name in names:
            path = os.path.join(JOB_STORAGE_PATH, name)
            try:
                if now - os.path.getmtime(path) > MAX_PROCESSING_SECONDS + FINISHED_JOB_TTL_SECONDS:
                    os.remove(path)
            except OSError:
                pass
    
    def record_result(request_id: str, result: Optional[Dict[str, Any]]):
        """Save a finished conversion's result to the job (unless it already finished)"""
        job_data = load_job(request_id) or {"status": "processing"}
        if job_data.get("status") in ("complete", "error"):
            return job_data
        job_data["finished_at"] = time.time()
        if result and result.get("success"):
            job_data["status"] = "complete"
            job_data["markdown"] = result.get("markdown", "")
            job_data["images"] = result.get("images") or {}
            print(f"[record_result] {request_id}: markdown length {len(job_data['markdown'])}, {len(job_data['images'])} images")
        else:
            job_data["status"] = "error"
            job_data["error"] = (result or {}).get("error", "Conversion failed") if result else "No result returned"
            print(f"[record_result] {request_id}: error {job_data['error']}")
        save_job(request_id, job_data)
        return job_data

    async def collect_finished_call(request_id: str, job: Dict[str, Any]) -> Dict[str, Any]:
        """If the job's conversion call already finished (for example, the web container
        that started it restarted), save and return its result."""
        call_id = job.get("call_id")
        if not call_id:
            return job
        try:
            result = await modal.FunctionCall.from_id(call_id).get.aio(timeout=0)
        except Exception as e:
            name = type(e).__name__
            if name == "FunctionTimeoutError":
                result = {"success": False, "error": "Conversion timed out"}
            elif "cancel" in name.lower():
                result = {"success": False, "error": "Conversion cancelled"}
            elif name == "OutputExpiredError":
                result = {"success": False, "error": "Conversion result expired. Please try again."}
            elif "timeout" in name.lower():
                return job  # get(timeout=0): still running
            else:
                result = {"success": False, "error": f"Conversion error: {e}"}
        return record_result(request_id, result)

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
        token: Optional[str] = Form(None),
    ):
        """
        Web endpoint for PDF conversion - matches HuggingFace API format.
        """
        import tempfile
        import shutil
        from pathlib import Path
        
        # Only accept requests that come through the iLoveMD site, within rate limits
        token_error = check_request_token(token)
        if token_error:
            status = 429 if "limit" in token_error or "Too many" in token_error else 401
            return JSONResponse(status_code=status, content={"error": token_error})

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
            "created_at": time.time(),
        }
        save_job(request_id, job_data)
        cleanup_old_jobs()
        
        # Start the conversion on a GPU container. spawn() returns at once; the call id is
        # saved with the job, so the status endpoint can still collect the result (and
        # /cancel can stop it) even if this web container restarts.
        try:
            call = await convert_pdf.spawn.aio(
                pdf_bytes=content,
                filename=file.filename,
                output_format=output_format,
                langs=langs,
                paginate=paginate_bool,
                extract_images=not disable_image_extraction_bool,
                use_llm=str_to_bool(use_llm),
                api_key=api_key,
            )
        except Exception as e:
            print(f"[marker_endpoint] Failed to start conversion: {e}")
            job_data.update({"status": "error", "error": "Could not start the conversion. Please try again.", "finished_at": time.time()})
            save_job(request_id, job_data)
            return JSONResponse(status_code=503, content={"error": "Could not start the conversion. Please try again."})

        job_data["call_id"] = call.object_id
        save_job(request_id, job_data)
        print(f"[marker_endpoint] Started conversion for {file.filename}, request_id={request_id}, call_id={call.object_id}, size={len(content)} bytes")

        async def run_conversion_task():
            try:
                result = await call.get.aio()
            except Exception as e:
                name = type(e).__name__
                if "cancel" in name.lower() or "cancel" in str(e).lower():
                    return  # /cancel already recorded the outcome
                if name == "FunctionTimeoutError":
                    result = {"success": False, "error": "Conversion timed out"}
                else:
                    print(f"[marker_endpoint] Conversion call failed: {e}")
                    result = {"success": False, "error": f"Conversion error: {e}"}
            finally:
                web_app.state.conversion_tasks.pop(request_id, None)
            record_result(request_id, result)

        # Create and store task to prevent garbage collection
        task = asyncio.create_task(run_conversion_task())
        web_app.state.conversion_tasks[request_id] = task
        
        # Return immediately with request_id for polling
        return JSONResponse(content={
            "success": True,
            "request_id": request_id,
            "request_check_url": f"/status/{request_id}",
        })
    
    @web_app.post("/cancel/{request_id}")
    async def cancel_job(request_id: str):
        """Stop a running conversion (the user cancelled it), so it stops using the GPU"""
        job = load_job(request_id)
        if not job:
            await reload_jobs()
            job = load_job(request_id)
        if not job:
            return JSONResponse(status_code=404, content={"error": "Conversion job not found"})
        if job.get("status") != "processing":
            return {"status": job.get("status")}

        call_id = job.get("call_id")
        if call_id:
            try:
                await modal.FunctionCall.from_id(call_id).cancel.aio()
            except Exception as e:
                print(f"[cancel_job] Cancel failed for {request_id}: {e}")
        task = web_app.state.conversion_tasks.pop(request_id, None)
        if task:
            task.cancel()
        record_result(request_id, {"success": False, "error": "Conversion cancelled"})
        return {"status": "cancelled"}

    @web_app.get("/status/{request_id}")
    async def check_status(request_id: str):
        """Check conversion status with retry for eventual consistency"""
        # Retry loading job (Modal Volumes may have eventual consistency).
        # asyncio.sleep, not time.sleep: a blocking sleep here would stall every
        # other request and background conversion task in this container.
        max_retries = 10
        retry_delay = 0.5  # 500ms - longer delay for volume consistency
        
        job = None
        for attempt in range(max_retries):
            job = load_job(request_id)
            if job:
                break
            # The job may have been saved by another web container
            await reload_jobs()
            if attempt < max_retries - 1:
                await asyncio.sleep(retry_delay)
        
        if not job:
            print(f"[check_status] Job not found for request_id: {request_id} after {max_retries} attempts")
            # The client keeps polling through 404s for a short while after submitting
            return JSONResponse(status_code=404, content={"status": "error", "error": "Conversion job not found"})

        if job.get("status", "processing") == "processing":
            job = await collect_finished_call(request_id, job)
        
        status = job.get("status", "processing")
        print(f"[check_status] Job status for {request_id}: {status}")

        created_at = job.get("created_at")
        if status == "processing" and created_at and time.time() - created_at > MAX_PROCESSING_SECONDS:
            status = "error"
            job["error"] = "Conversion was interrupted. Please try again."
        
        response = {"status": status}
        
        if status == "complete":
            markdown = job.get("markdown", "")
            print(f"[check_status] Returning markdown, length: {len(markdown)}")
            response["markdown"] = markdown
            response["images"] = job.get("images") or {}
            # Kept until cleanup_old_jobs() removes it, so the result can be fetched again
        elif status == "error":
            error = job.get("error", "Unknown error")
            print(f"[check_status] Returning error: {error}")
            response["error"] = error
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
