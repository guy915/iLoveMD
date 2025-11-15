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

    // Validate API key format (basic check)
    const trimmedKey = apiKey.trim()
    if (trimmedKey.length < MARKER_CONFIG.VALIDATION.MIN_API_KEY_LENGTH) {
      return NextResponse.json(
        { success: false, error: 'Invalid API key format' },
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
