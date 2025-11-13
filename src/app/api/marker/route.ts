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

    // Submit to Marker API
    const response = await fetch('https://www.datalab.to/api/v1/marker', {
      method: 'POST',
      headers: {
        'X-Api-Key': trimmedKey,
      },
      body: markerFormData,
    })

    const data = await response.json() as {
      error?: string
      message?: string
      request_id?: string
      request_check_url?: string
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
    console.error('Marker API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process request' },
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

    // Poll the Marker API
    const response = await fetch(checkUrl, {
      method: 'GET',
      headers: {
        'X-Api-Key': apiKey,
      },
    })

    const data = await response.json() as {
      error?: string
      status?: string
      markdown?: string
      progress?: number
    }

    if (!response.ok) {
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
    console.error('Poll error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to check status' },
      { status: 500 }
    )
  }
}
