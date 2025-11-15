import { NextRequest, NextResponse } from 'next/server'
import type { MarkerSubmitResponse, MarkerPollResponse } from '@/types'

interface MarkerOptions {
  paginate: boolean
  use_llm: boolean
  force_ocr: boolean
  strip_existing_ocr: boolean
  disable_image_extraction: boolean
  output_format: 'markdown' | 'json' | 'html' | 'chunks'
  langs: string
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

    // Parse options or use defaults
    let options: MarkerOptions = {
      paginate: false,
      use_llm: false,
      force_ocr: false,
      strip_existing_ocr: false,
      disable_image_extraction: false,
      output_format: 'markdown',
      langs: 'English'
    }

    if (optionsJson) {
      try {
        options = JSON.parse(optionsJson) as MarkerOptions
      } catch (err) {
        console.error('Failed to parse options:', err)
      }
    }

    // Log the options being used
    console.log('[Marker API] Processing with options:', options)

    // Prepare form data for Marker API
    const markerFormData = new FormData()
    markerFormData.append('file', file)

    // Add all options to the request
    markerFormData.append('output_format', options.output_format)
    markerFormData.append('langs', options.langs)
    markerFormData.append('paginate', String(options.paginate))
    markerFormData.append('use_llm', String(options.use_llm))
    markerFormData.append('force_ocr', String(options.force_ocr))

    // Add conditional options
    if (options.strip_existing_ocr) {
      markerFormData.append('strip_existing_ocr', 'true')
    }

    if (options.disable_image_extraction) {
      markerFormData.append('disable_image_extraction', 'true')
    }

    // Submit to Marker API
    const response = await fetch('https://www.datalab.to/api/v1/marker', {
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
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
