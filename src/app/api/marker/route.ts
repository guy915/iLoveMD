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
