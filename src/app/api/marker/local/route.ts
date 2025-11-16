import { NextRequest, NextResponse } from 'next/server'
import { MARKER_CONFIG, FILE_SIZE, API_ENDPOINTS } from '@/lib/constants'
import { formatBytesToMB } from '@/lib/utils/formatUtils'
import type { MarkerSubmitResponse, MarkerPollResponse, MarkerOptions } from '@/types'

// Network error types for better error messaging
type NetworkErrorType = 'timeout' | 'connection' | 'dns' | 'unknown'

// Helper to identify network error type
function getNetworkErrorType(error: unknown): NetworkErrorType {
  // First check error instance and properties (more reliable than string matching)
  if (error && typeof error === 'object') {
    const err = error as any

    // Check for AbortError (fetch timeout)
    if (err.name === 'AbortError') {
      return 'timeout'
    }

    // Check for error codes (Node.js-style errors)
    if (typeof err.code === 'string') {
      const code = err.code.toUpperCase()
      if (code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT') {
        return 'timeout'
      }
      if (code === 'ECONNREFUSED') {
        return 'connection'
      }
      if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
        return 'dns'
      }
    }
  }

  // Fallback to string matching (less reliable but still useful)
  const errorMessage = String(error).toLowerCase()
  if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
    return 'timeout'
  }
  if (errorMessage.includes('econnrefused') || errorMessage.includes('connection refused')) {
    return 'connection'
  }
  if (errorMessage.includes('enotfound') || errorMessage.includes('dns')) {
    return 'dns'
  }
  return 'unknown'
}

// Helper to get user-friendly error message
function getNetworkErrorMessage(errorType: NetworkErrorType, isLocal: boolean = true): string {
  const service = isLocal ? 'local Marker instance' : 'Marker service'

  switch (errorType) {
    case 'timeout':
      return `Request timed out. The ${service} is taking too long to respond. Please try again.`
    case 'connection':
      return `Unable to connect to ${service}. ${isLocal ? 'Please ensure Docker is running and Marker is started on http://localhost:8000' : 'The service may be temporarily unavailable.'}`
    case 'dns':
      return `Unable to resolve ${service} hostname. Please check your configuration.`
    default:
      return `Network error occurred. Please check ${isLocal ? 'that Docker and Marker are running' : 'your internet connection'} and try again.`
  }
}

// Helper to validate JSON response structure
function isValidMarkerSubmitResponse(data: unknown): data is {
  error?: string
  message?: string
  request_id?: string
  request_check_url?: string
} {
  if (!data || typeof data !== 'object') return false
  const obj = data as Record<string, unknown>

  // At least one field should be present
  const hasExpectedFields =
    typeof obj.error === 'string' ||
    typeof obj.message === 'string' ||
    typeof obj.request_id === 'string' ||
    typeof obj.request_check_url === 'string'

  return hasExpectedFields
}

// Helper to validate poll response structure
function isValidMarkerPollResponse(data: unknown): data is {
  error?: string
  status?: string
  markdown?: string
  progress?: number
} {
  if (!data || typeof data !== 'object') return false
  const obj = data as Record<string, unknown>

  // At least one field should be present
  const hasExpectedFields =
    typeof obj.error === 'string' ||
    typeof obj.status === 'string' ||
    typeof obj.markdown === 'string' ||
    typeof obj.progress === 'number'

  return hasExpectedFields
}

// Fetch with timeout support
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = 30000
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs / 1000} seconds`)
    }
    throw error
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<MarkerSubmitResponse>> {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const geminiApiKey = formData.get('geminiApiKey') as string | null
    const optionsJson = formData.get('options') as string | null

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type (must be PDF)
    // Check MIME type
    if (!file.type || !file.type.includes('pdf')) {
      return NextResponse.json(
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
      return NextResponse.json(
        { success: false, error: 'Only PDF files are accepted (invalid file extension)' },
        { status: 400 }
      )
    }

    // Validate file is not empty
    if (file.size === 0) {
      return NextResponse.json(
        { success: false, error: 'File is empty. Please upload a valid PDF file.' },
        { status: 400 }
      )
    }

    // Check minimum file size (realistic minimum for a PDF)
    const MIN_PDF_SIZE = 100 // PDF header + minimal content
    if (file.size < MIN_PDF_SIZE) {
      return NextResponse.json(
        { success: false, error: 'File too small to be a valid PDF' },
        { status: 400 }
      )
    }

    // Validate PDF magic bytes (PDF files start with %PDF-)
    try {
      const buffer = await file.arrayBuffer()
      const header = new TextDecoder().decode(buffer.slice(0, 5))
      if (header !== '%PDF-') {
        return NextResponse.json(
          { success: false, error: 'Invalid PDF file format (file does not appear to be a PDF)' },
          { status: 400 }
        )
      }
    } catch (magicByteError) {
      console.error('Failed to validate PDF magic bytes:', magicByteError)
      return NextResponse.json(
        { success: false, error: 'Failed to validate file format' },
        { status: 400 }
      )
    }

    // Validate file size (200MB limit per Marker API)
    if (file.size > FILE_SIZE.MAX_PDF_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: `File too large (max 200MB). Your file is ${formatBytesToMB(file.size)}`
        },
        { status: 413 }
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
        console.error('[Local Marker API] Failed to parse options:', err, 'Raw JSON:', optionsJson)
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

    // Validate Gemini API key if use_llm is enabled
    if (options.use_llm) {
      if (!geminiApiKey || geminiApiKey.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: 'Gemini API key is required when using LLM enhancement in local mode' },
          { status: 400 }
        )
      }
    }

    // Prepare form data for Local Marker
    const markerFormData = new FormData()
    markerFormData.append('file', file)

    // Add all options to the request (consistent string conversion for all booleans)
    markerFormData.append('output_format', options.output_format)
    markerFormData.append('langs', options.langs)
    markerFormData.append('paginate', String(options.paginate))
    markerFormData.append('format_lines', String(options.format_lines))
    markerFormData.append('use_llm', String(options.use_llm))
    markerFormData.append('disable_image_extraction', String(options.disable_image_extraction))

    // Add local-specific options
    if (options.redo_inline_math !== undefined) {
      markerFormData.append('redo_inline_math', String(options.redo_inline_math))
    }

    // Add Gemini API key if use_llm is enabled
    if (options.use_llm && geminiApiKey) {
      markerFormData.append('api_key', geminiApiKey.trim())
    }

    // Submit to Local Marker instance with timeout
    let response: Response
    try {
      response = await fetchWithTimeout(
        `${API_ENDPOINTS.LOCAL_MARKER_INSTANCE}/marker`,
        {
          method: 'POST',
          body: markerFormData,
        },
        300000
      ) // 5 minute timeout (Modal cold starts + initial response can take time)
    } catch (fetchError) {
      const errorType = getNetworkErrorType(fetchError)
      const errorMessage = getNetworkErrorMessage(errorType, true)
      console.error('Network error submitting to Local Marker:', {
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
      console.error('Failed to parse Local Marker response as JSON:', {
        status: response.status,
        statusText: response.statusText,
        error: parseError
      })
      return NextResponse.json(
        {
          success: false,
          error: 'Received invalid response from local Marker instance. Please ensure Marker is running correctly.',
          details: { httpStatus: response.status } // Only expose HTTP status, not parse error details
        },
        { status: 502 }
      )
    }

    // Validate response structure
    if (!isValidMarkerSubmitResponse(data)) {
      console.error('Local Marker returned unexpected response structure:', data)
      return NextResponse.json(
        {
          success: false,
          error: 'Received malformed response from local Marker instance',
          details: { receivedKeys: data && typeof data === 'object' ? Object.keys(data as object) : [] } // Only expose keys, not full data
        },
        { status: 502 }
      )
    }

    if (!response.ok) {
      // Log the full error for debugging
      console.error('Local Marker error:', {
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
          error: data.error || data.message || `API error: ${response.status}`,
          details: safeDetails
        },
        { status: response.status }
      )
    }

    // Validate required fields in successful response
    if (!data.request_id || !data.request_check_url) {
      console.error('Local Marker returned success but missing required fields:', data)
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid API response format (missing required fields)',
          details: { httpStatus: 200 } // Only expose HTTP status
        },
        { status: 502 }
      )
    }

    // Construct full URL for status checking (Modal returns relative URL like "/status/{id}")
    const statusUrl = data.request_check_url.startsWith('http')
      ? data.request_check_url
      : `${API_ENDPOINTS.LOCAL_MARKER_INSTANCE}${data.request_check_url}`

    // Return the request_check_url for polling
    return NextResponse.json({
      success: true,
      request_id: data.request_id,
      request_check_url: statusUrl,
    })

  } catch (error) {
    // Catch-all for unexpected errors
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error('Unexpected error in POST /api/marker/local:', {
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
    const { searchParams } = new URL(request.url)
    const checkUrl = searchParams.get('checkUrl')

    if (!checkUrl) {
      return NextResponse.json(
        { success: false, error: 'Missing checkUrl parameter' },
        { status: 400 }
      )
    }

    // Validate checkUrl is from expected domains (prevent SSRF)
    const allowedDomains = ['modal.run', 'localhost', '127.0.0.1']
    try {
      const url = new URL(checkUrl)
      const isAllowed = allowedDomains.some(domain => {
        // For localhost and IP addresses, require exact match only
        // This prevents "evil-localhost" or "fake127.0.0.1" from passing
        if (domain === 'localhost' || domain === '127.0.0.1') {
          return url.hostname === domain
        }
        // For modal.run, allow exact match or proper subdomains
        // This prevents "evil-modal.run" from passing
        return url.hostname === domain || url.hostname.endsWith(`.${domain}`)
      })
      if (!isAllowed) {
        console.warn('SSRF attempt detected:', { checkUrl, hostname: url.hostname })
        return NextResponse.json(
          { success: false, error: 'Invalid check URL domain' },
          { status: 400 }
        )
      }
    } catch (urlError) {
      console.error('Invalid check URL format:', { checkUrl, error: urlError })
      return NextResponse.json(
        { success: false, error: 'Invalid check URL format' },
        { status: 400 }
      )
    }

    // Poll the Local Marker instance with timeout
    let response: Response
    try {
      response = await fetchWithTimeout(checkUrl, {
        method: 'GET',
      }, 60000) // 60 second timeout (Modal status checks can take time)
    } catch (fetchError) {
      const errorType = getNetworkErrorType(fetchError)
      const errorMessage = getNetworkErrorMessage(errorType, true)
      console.error('Network error polling Local Marker:', {
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
      console.error('Failed to parse Local Marker poll response as JSON:', {
        status: response.status,
        statusText: response.statusText,
        error: parseError
      })
      return NextResponse.json(
        {
          success: false,
          error: 'Received invalid response from local Marker instance during status check.',
          details: { httpStatus: response.status } // Only expose HTTP status, not parse error details
        },
        { status: 502 }
      )
    }

    // Check for HTTP errors first (404, 500, etc.)
    if (!response.ok) {
      console.error('Local Marker poll error:', {
        status: response.status,
        statusText: response.statusText,
        data: data
      })
      // If it's a 404, the job might not exist yet (race condition with Modal Volumes)
      // Return processing status so polling continues
      if (response.status === 404) {
        return NextResponse.json(
          {
            success: true, // Return success so polling continues
            status: 'processing'
          },
          { status: 200 }
        )
      }
      return NextResponse.json(
        {
          success: false,
          error: (data && typeof data === 'object' && 'error' in data) ? (data as { error: string }).error : 'Failed to check status'
        },
        { status: response.status }
      )
    }

    // Validate response structure (only for successful responses)
    if (!isValidMarkerPollResponse(data)) {
      console.error('Local Marker poll returned unexpected response structure:', data)
      return NextResponse.json(
        {
          success: false,
          error: 'Received malformed response from local Marker instance during status check',
          details: { receivedKeys: data && typeof data === 'object' ? Object.keys(data as object) : [] } // Only expose keys, not full data
        },
        { status: 502 }
      )
    }

    // Wrap response with success flag for consistency
    return NextResponse.json({
      success: true,
      status: data.status as 'pending' | 'processing' | 'complete' | 'error' | undefined,
      markdown: data.markdown,
      progress: data.progress
    })

  } catch (error) {
    // Catch-all for unexpected errors
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error('Unexpected error in GET /api/marker/local:', {
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
