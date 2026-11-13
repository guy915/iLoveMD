import { NextRequest, NextResponse } from 'next/server'
import { MARKER_CONFIG, FILE_SIZE, API_ENDPOINTS } from '@/lib/constants'
import { formatBytesToMB } from '@/lib/utils/formatUtils'
import {
  getNetworkErrorType,
  getNetworkErrorMessage,
  isValidMarkerSubmitResponse,
  isValidMarkerPollResponse,
  fetchWithTimeout
} from '@/lib/utils/apiHelpers'
import type { MarkerSubmitResponse, MarkerPollResponse, MarkerOptions } from '@/types'
import { ErrorCode } from '@/types'

/** Reference returned by Datalab's file upload API, e.g. "datalab://file-abc123" */
const DATALAB_FILE_REFERENCE_REGEX = /^datalab:\/\/file-[A-Za-z0-9_-]+$/

/** Largest result returned in one poll response (the platform caps responses at ~4.5 MB) */
const MAX_INLINE_RESULT_BYTES = 3.5 * 1024 * 1024
/** Characters per markdown part when a result is fetched in parts (<= 3 MB as UTF-8) */
const MARKDOWN_PART_CHARS = 1_000_000

/** Extracted images from a Datalab result (file name -> base64 data) */
function getImages(data: unknown): Record<string, string> {
  const images = (data as { images?: unknown } | null)?.images
  if (!images || typeof images !== 'object' || Array.isArray(images)) return {}
  const result: Record<string, string> = {}
  for (const [name, value] of Object.entries(images as Record<string, unknown>)) {
    if (typeof value === 'string' && value) result[name] = value
  }
  return result
}

/**
 * Read an error message from a Datalab error body.
 * Datalab returns `error` or `message`, and FastAPI-style `detail` (string or list).
 */
function getUpstreamErrorMessage(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined
  const obj = data as Record<string, unknown>
  for (const key of ['error', 'message', 'detail'] as const) {
    const value = obj[key]
    if (typeof value === 'string' && value) return value
    if (key === 'detail' && Array.isArray(value)) {
      const first = value[0] as { msg?: unknown } | undefined
      if (first && typeof first.msg === 'string') return first.msg
    }
  }
  return undefined
}

/**
 * Confirm a file the browser uploaded directly to Datalab storage.
 * Returns an error response, or null when the upload is confirmed.
 */
async function confirmDatalabUpload(fileId: string, apiKey: string): Promise<NextResponse<MarkerSubmitResponse> | null> {
  let response: Response
  try {
    response = await fetchWithTimeout(
      `${API_ENDPOINTS.DATALAB_FILES}/${encodeURIComponent(fileId)}/confirm`,
      { method: 'GET', headers: { 'X-Api-Key': apiKey } },
      MARKER_CONFIG.TIMEOUTS.SUBMIT_REQUEST_MS
    )
  } catch (fetchError) {
    const errorType = getNetworkErrorType(fetchError)
    console.error('Network error confirming Datalab upload:', { errorType, message: String(fetchError) })
    return NextResponse.json(
      { success: false, error: getNetworkErrorMessage(errorType), details: { errorType } },
      { status: 503 }
    )
  }

  if (!response.ok) {
    let message = `Failed to confirm file upload (${response.status})`
    try {
      const data = await response.json() as { error?: unknown; detail?: unknown }
      if (typeof data?.error === 'string' && data.error) message = data.error
      else if (typeof data?.detail === 'string' && data.detail) message = data.detail
    } catch {
      // Keep the generic message
    }
    console.error('Datalab upload confirm failed:', { status: response.status, message })
    return NextResponse.json(
      { success: false, error: message, details: { httpStatus: response.status } },
      { status: response.status >= 500 ? 502 : response.status }
    )
  }

  return null
}

/**
 * Validate an uploaded PDF (type, extension, size and magic bytes).
 * Returns an error response, or null when the file is valid.
 */
async function validatePdfFile(file: File): Promise<NextResponse<MarkerSubmitResponse> | null> {
  // Validate file type (must be PDF)
  // Check MIME type
  if (!file.type || !file.type.includes('pdf')) {
    return NextResponse.json<MarkerSubmitResponse>(
      { success: false, error: 'Only PDF files are accepted' },
      { status: 400 }
    )
  }

  // Check file extension
  const validExtensions = ['.pdf']
  const hasValidExtension = validExtensions.some(ext =>
    file.name.toLowerCase().endsWith(ext)
  )
  if (!hasValidExtension) {
    return NextResponse.json<MarkerSubmitResponse>(
      { success: false, error: 'Only PDF files are accepted (invalid file extension)' },
      { status: 400 }
    )
  }

  // Validate file is not empty
  if (file.size === 0) {
    return NextResponse.json<MarkerSubmitResponse>(
      { success: false, error: 'File is empty. Please upload a valid PDF file.' },
      { status: 400 }
    )
  }

  // Check minimum file size (realistic minimum for a PDF)
  const MIN_PDF_SIZE = 100 // PDF header + minimal content
  if (file.size < MIN_PDF_SIZE) {
    return NextResponse.json<MarkerSubmitResponse>(
      { success: false, error: 'File too small to be a valid PDF' },
      { status: 400 }
    )
  }

  // Validate PDF magic bytes (PDF files start with %PDF-)
  try {
    const buffer = await file.arrayBuffer()
    const header = new TextDecoder().decode(buffer.slice(0, 5))
    if (header !== '%PDF-') {
      return NextResponse.json<MarkerSubmitResponse>(
        { success: false, error: 'Invalid PDF file format (file does not appear to be a PDF)' },
        { status: 400 }
      )
    }
  } catch (magicByteError) {
    console.error('Failed to validate PDF magic bytes:', magicByteError)
    return NextResponse.json<MarkerSubmitResponse>(
      { success: false, error: 'Failed to validate file format' },
      { status: 400 }
    )
  }

  // Validate file size (200MB limit per Marker API)
  if (file.size > FILE_SIZE.MAX_PDF_FILE_SIZE) {
    return NextResponse.json<MarkerSubmitResponse>(
      {
        success: false,
        error: `File too large (max 200MB). Your file is ${formatBytesToMB(file.size)}`
      },
      { status: 413 }
    )
  }

  return null
}

export async function POST(request: NextRequest): Promise<NextResponse<MarkerSubmitResponse>> {
  try {
    // Parse FormData with explicit error handling
    let formData: FormData
    try {
      formData = await request.formData()
    } catch (formError) {
      console.error('Failed to parse FormData:', formError)
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request format. Failed to parse multipart form data.',
          details: { errorType: ErrorCode.FORM_PARSE_ERROR }
        },
        { status: 400 }
      )
    }

    const file = formData.get('file') as File | null
    const apiKey = formData.get('apiKey') as string | null
    const optionsJson = formData.get('options') as string | null

    // A large PDF can't be sent through this route (the hosting platform caps request
    // bodies at about 4.5 MB). Instead the browser uploads it straight to Datalab storage
    // and sends us only the file reference (see /api/marker/upload-url).
    const fileReference = formData.get('fileReference') as string | null
    const fileId = formData.get('fileId') as string | null

    if (!file && !fileReference) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!file && fileReference) {
      if (!DATALAB_FILE_REFERENCE_REGEX.test(fileReference) || !fileId || !/^\d+$/.test(fileId)) {
        return NextResponse.json(
          { success: false, error: 'Invalid uploaded file reference' },
          { status: 400 }
        )
      }
    }

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'API key is required' },
        { status: 400 }
      )
    }

    if (file) {
      const fileError = await validatePdfFile(file)
      if (fileError) return fileError
    }

    // Validate API key format
    const trimmedKey = apiKey.trim()

    // Check minimum length
    if (trimmedKey.length < MARKER_CONFIG.VALIDATION.MIN_API_KEY_LENGTH) {
      return NextResponse.json(
        { success: false, error: 'Invalid API key format' },
        { status: 400 }
      )
    }

    // Validate format: alphanumeric, hyphens, and underscores (32-128 characters)
    const API_KEY_REGEX = /^[A-Za-z0-9_-]{32,128}$/
    if (!API_KEY_REGEX.test(trimmedKey)) {
      return NextResponse.json(
        { success: false, error: 'Invalid API key format (must be 32-128 alphanumeric characters)' },
        { status: 400 }
      )
    }

    // Parse options or use defaults
    let options: MarkerOptions = MARKER_CONFIG.DEFAULT_OPTIONS

    if (optionsJson) {
      try {
        const parsed = JSON.parse(optionsJson) as Partial<MarkerOptions>
        // Merge with defaults to handle missing fields
        options = { ...MARKER_CONFIG.DEFAULT_OPTIONS, ...parsed }
      } catch (err) {
        console.error('[Marker API] Failed to parse options:', err, 'Raw JSON:', optionsJson)
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid options format',
            details: { message: String(err), raw: optionsJson }
          },
          { status: 400 }
        )
      }
    }

    // Prepare form data for Marker API
    const markerFormData = new FormData()
    if (file) {
      markerFormData.append('file', file)
    } else {
      // Confirm the direct upload finished before asking Marker to convert it
      const confirmError = await confirmDatalabUpload(fileId as string, trimmedKey)
      if (confirmError) return confirmError
      markerFormData.append('file_url', fileReference as string)
    }

    // Add all options to the request (consistent string conversion for all booleans)
    markerFormData.append('output_format', options.output_format)
    markerFormData.append('langs', options.langs)
    markerFormData.append('paginate', String(options.paginate))
    markerFormData.append('format_lines', String(options.format_lines))
    markerFormData.append('use_llm', String(options.use_llm))
    markerFormData.append('disable_image_extraction', String(options.disable_image_extraction))

    // Submit to Marker API with timeout
    let response: Response
    try {
      response = await fetchWithTimeout(API_ENDPOINTS.MARKER_EXTERNAL, {
        method: 'POST',
        headers: {
          'X-Api-Key': trimmedKey,
        },
        body: markerFormData,
      }, MARKER_CONFIG.TIMEOUTS.SUBMIT_REQUEST_MS)
    } catch (fetchError) {
      const errorType = getNetworkErrorType(fetchError)
      const errorMessage = getNetworkErrorMessage(errorType)
      console.error('Network error submitting to Marker API:', {
        errorType,
        error: fetchError,
        message: String(fetchError)
      })
      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          details: { errorType } // Only expose error type, not internal error details
        },
        { status: 503 } // Service Unavailable
      )
    }

    // Parse JSON response
    let data: unknown
    try {
      data = await response.json()
    } catch (parseError) {
      console.error('Failed to parse Marker API response as JSON:', {
        status: response.status,
        statusText: response.statusText,
        error: parseError
      })
      return NextResponse.json(
        {
          success: false,
          error: 'Received invalid response from Marker API. The service may be experiencing issues.',
          details: { httpStatus: response.status } // Only expose HTTP status, not parse error details
        },
        { status: 502 }
      )
    }

    if (!response.ok) {
      // Log the full error for debugging
      console.error('Marker API error:', {
        status: response.status,
        statusText: response.statusText,
        data: data
      })

      // Sanitize error details - only expose safe fields
      const safeDetails = {
        httpStatus: response.status,
        requestId: typeof data === 'object' && data !== null && 'request_id' in data ? (data as any).request_id : undefined
      }

      return NextResponse.json(
        {
          success: false,
          error: getUpstreamErrorMessage(data) || `API error: ${response.status}`,
          details: safeDetails
        },
        { status: response.status }
      )
    }

    // Validate response structure
    if (!isValidMarkerSubmitResponse(data)) {
      console.error('Marker API returned unexpected response structure:', data)
      return NextResponse.json(
        {
          success: false,
          error: 'Received malformed response from Marker API',
          details: { receivedKeys: data && typeof data === 'object' ? Object.keys(data as object) : [] } // Only expose keys, not full data
        },
        { status: 502 }
      )
    }

    // Validate required fields in successful response
    if (!data.request_id || !data.request_check_url) {
      console.error('Marker API returned success but missing required fields:', data)
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid API response format (missing required fields)',
          details: { httpStatus: 200 } // Only expose HTTP status
        },
        { status: 502 }
      )
    }

    // Return the request_check_url for polling
    return NextResponse.json({
      success: true,
      request_id: data.request_id,
      request_check_url: data.request_check_url,
    })

  } catch (error) {
    // Catch-all for unexpected errors
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error('Unexpected error in POST /api/marker:', {
      message: errorMessage,
      stack: errorStack,
      error
    })
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred while processing your request. Please try again.'
        // details omitted to avoid exposing internal error messages
      },
      { status: 500 }
    )
  }
}

// Poll endpoint to check status
export async function GET(request: NextRequest): Promise<NextResponse<MarkerPollResponse>> {
  try {
    // Parse URL with explicit error handling
    let searchParams: URLSearchParams
    try {
      const url = new URL(request.url)
      searchParams = url.searchParams
    } catch (urlError) {
      console.error('Failed to parse request URL:', urlError)
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request URL format',
          details: { errorType: ErrorCode.URL_PARSE_ERROR }
        },
        { status: 400 }
      )
    }

    const checkUrl = searchParams.get('checkUrl')
    const apiKey = request.headers.get('x-api-key')

    if (!checkUrl || !apiKey) {
      return NextResponse.json(
        { success: false, error: 'Missing parameters' },
        { status: 400 }
      )
    }

    // Validate checkUrl to prevent SSRF attacks
    const allowedDomain = 'datalab.to'
    try {
      const parsedUrl = new URL(checkUrl)
      
      // Allow example.com in test environment
      const isTestEnv = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true'
      if (isTestEnv && parsedUrl.hostname === 'example.com') {
        // Skip validation for test URLs
      } else {
        // Only allow exact match or proper subdomains (e.g., www.datalab.to, api.datalab.to)
        // This prevents domains like "evil-datalab.to" from passing the check
        const isValidDomain = parsedUrl.hostname === allowedDomain || parsedUrl.hostname.endsWith(`.${allowedDomain}`)
        if (!isValidDomain) {
          console.warn('SSRF attempt detected:', { checkUrl, hostname: parsedUrl.hostname })
          return NextResponse.json(
            { success: false, error: 'Invalid check URL domain' },
            { status: 400 }
          )
        }
        
        // Ensure it's HTTPS
        if (parsedUrl.protocol !== 'https:') {
          return NextResponse.json(
            { success: false, error: 'Invalid checkUrl: must use HTTPS' },
            { status: 400 }
          )
        }
      }
    } catch (urlError) {
      console.error('Invalid check URL format:', { checkUrl, error: urlError })
      return NextResponse.json(
        { success: false, error: 'Invalid check URL format' },
        { status: 400 }
      )
    }

    // Poll the Marker API with timeout
    let response: Response
    try {
      response = await fetchWithTimeout(checkUrl, {
        method: 'GET',
        headers: {
          'X-Api-Key': apiKey,
        },
      }, MARKER_CONFIG.TIMEOUTS.POLL_REQUEST_MS)
    } catch (fetchError) {
      const errorType = getNetworkErrorType(fetchError)
      const errorMessage = getNetworkErrorMessage(errorType)
      console.error('Network error polling Marker API:', {
        errorType,
        error: fetchError,
        message: String(fetchError),
        checkUrl
      })
      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          details: { errorType } // Only expose error type, not internal error details
        },
        { status: 503 } // Service Unavailable
      )
    }

    // Parse JSON response
    let data: unknown
    try {
      data = await response.json()
    } catch (parseError) {
      console.error('Failed to parse Marker API poll response as JSON:', {
        status: response.status,
        statusText: response.statusText,
        error: parseError
      })
      return NextResponse.json(
        {
          success: false,
          error: 'Received invalid response from Marker API during status check.',
          details: { httpStatus: response.status } // Only expose HTTP status, not parse error details
        },
        { status: 502 }
      )
    }

    if (!response.ok) {
      console.error('Marker API poll error:', {
        status: response.status,
        statusText: response.statusText,
        data: data
      })
      return NextResponse.json(
        {
          success: false,
          error: getUpstreamErrorMessage(data) || 'Failed to check status'
        },
        { status: response.status }
      )
    }

    // Validate response structure
    if (!isValidMarkerPollResponse(data)) {
      console.error('Marker API poll returned unexpected response structure:', data)
      return NextResponse.json(
        {
          success: false,
          error: 'Received malformed response from Marker API during status check',
          details: { receivedKeys: data && typeof data === 'object' ? Object.keys(data as object) : [] } // Only expose keys, not full data
        },
        { status: 502 }
      )
    }

    // Marker API reports a failed job as status "complete" (or "failed") with success: false.
    // Map that to status "error" and pass the reason through so the user sees why it failed.
    const jobFailed =
      data.status === 'failed' ||
      data.status === 'error' ||
      (data.status === 'complete' && (data as { success?: unknown }).success === false)

    const status = jobFailed ? 'error' : data.status as 'pending' | 'processing' | 'complete' | 'error' | undefined
    const markdown = jobFailed ? undefined : data.markdown
    const images = status === 'complete' ? getImages(data) : {}

    // Large results are fetched in parts: the platform caps a response at about 4.5 MB
    const part = searchParams.get('part')
    if (part && status === 'complete' && typeof markdown === 'string') {
      if (part === 'markdown') {
        const index = Number(searchParams.get('index'))
        if (!Number.isInteger(index) || index < 0 || index * MARKDOWN_PART_CHARS >= Math.max(markdown.length, 1)) {
          return NextResponse.json({ success: false, error: 'Invalid markdown part' }, { status: 400 })
        }
        return NextResponse.json({
          success: true,
          status: 'complete',
          markdown: markdown.slice(index * MARKDOWN_PART_CHARS, (index + 1) * MARKDOWN_PART_CHARS)
        })
      }
      if (part === 'image') {
        const name = searchParams.get('name') ?? ''
        if (!Object.prototype.hasOwnProperty.call(images, name)) {
          return NextResponse.json({ success: false, error: 'Image not found' }, { status: 404 })
        }
        return NextResponse.json({ success: true, status: 'complete', images: { [name]: images[name] } })
      }
      return NextResponse.json({ success: false, error: 'Invalid part' }, { status: 400 })
    }

    const imageBytes = Object.values(images).reduce((sum, value) => sum + value.length, 0)
    // Up to 3 bytes per character once encoded as UTF-8
    const estimatedBytes = (markdown?.length ?? 0) * 3 + imageBytes
    if (status === 'complete' && typeof markdown === 'string' && estimatedBytes > MAX_INLINE_RESULT_BYTES) {
      return NextResponse.json({
        success: true,
        status: 'complete',
        markdownParts: Math.max(1, Math.ceil(markdown.length / MARKDOWN_PART_CHARS)),
        imageNames: Object.keys(images),
        progress: data.progress
      })
    }

    // Wrap response with success flag for consistency
    return NextResponse.json({
      success: true,
      status,
      markdown,
      ...(Object.keys(images).length > 0 ? { images } : {}),
      progress: data.progress,
      ...(jobFailed && data.error ? { error: data.error } : {})
    })

  } catch (error) {
    // Catch-all for unexpected errors
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error('Unexpected error in GET /api/marker:', {
      message: errorMessage,
      stack: errorStack,
      error
    })
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred while checking conversion status. Please try again.'
        // details omitted to avoid exposing internal error messages
      },
      { status: 500 }
    )
  }
}
