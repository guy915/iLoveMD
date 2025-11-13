import { NextRequest, NextResponse } from 'next/server'
import type { MarkerSubmitResponse, MarkerPollResponse, MarkerOptions } from '@/types'

const DEFAULT_OPTIONS: MarkerOptions = {
  paginate: false,
  format_lines: false,
  use_llm: false,
  disable_image_extraction: false,
  output_format: 'markdown',
  langs: 'English'
}

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
function getNetworkErrorMessage(errorType: NetworkErrorType): string {
  switch (errorType) {
    case 'timeout':
      return 'Request timed out. The Marker API is taking too long to respond. Please try again.'
    case 'connection':
      return 'Unable to connect to Marker API. The service may be temporarily unavailable.'
    case 'dns':
      return 'Unable to resolve Marker API hostname. Please check your internet connection.'
    default:
      return 'Network error occurred. Please check your internet connection and try again.'
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
    const apiKey = formData.get('apiKey') as string | null
    const optionsJson = formData.get('options') as string | null

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'API key is required' },
        { status: 400 }
      )
    }

    // Validate file type (must be PDF)
    if (!file.type || !file.type.includes('pdf')) {
      return NextResponse.json(
        { success: false, error: 'Only PDF files are accepted' },
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

    // Validate file size (200MB limit)
    const maxSize = 200 * 1024 * 1024 // 200MB
    if (file.size > maxSize) {
      return NextResponse.json(
        {
          success: false,
          error: `File too large (max 200MB). Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB`
        },
        { status: 413 }
      )
    }

    // Validate API key format (basic check)
    const trimmedKey = apiKey.trim()
    if (trimmedKey.length < 10) {
      return NextResponse.json(
        { success: false, error: 'Invalid API key format' },
        { status: 400 }
      )
    }

    // Parse options or use defaults
    let options: MarkerOptions = DEFAULT_OPTIONS

    if (optionsJson) {
      try {
        const parsed = JSON.parse(optionsJson) as Partial<MarkerOptions>
        // Merge with defaults to handle missing fields
        options = { ...DEFAULT_OPTIONS, ...parsed }
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
    markerFormData.append('file', file)

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
      response = await fetchWithTimeout('https://www.datalab.to/api/v1/marker', {
        method: 'POST',
        headers: {
          'X-Api-Key': trimmedKey,
        },
        body: markerFormData,
      }, 30000) // 30 second timeout
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

    if (!response.ok) {
      // Log the full error for debugging
      console.error('Marker API error:', {
        status: response.status,
        statusText: response.statusText,
        data: data
      })

      return NextResponse.json(
        {
          success: false,
          error: data.error || data.message || `API error: ${response.status}`,
          details: data
        },
        { status: response.status }
      )
    }

    // Validate required fields in successful response
    if (!data.request_id || !data.request_check_url) {
      console.error('Marker API returned success but missing required fields:', data)
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid API response format (missing required fields)',
          details: data
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
    const { searchParams } = new URL(request.url)
    const checkUrl = searchParams.get('checkUrl')
    const apiKey = request.headers.get('x-api-key')

    if (!checkUrl || !apiKey) {
      return NextResponse.json(
        { success: false, error: 'Missing parameters' },
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
      }, 30000) // 30 second timeout
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

    if (!response.ok) {
      console.error('Marker API poll error:', {
        status: response.status,
        statusText: response.statusText,
        data: data
      })
      return NextResponse.json(
        {
          success: false,
          error: data.error || 'Failed to check status'
        },
        { status: response.status }
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
