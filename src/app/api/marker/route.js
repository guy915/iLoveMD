export async function POST(request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const apiKey = formData.get('apiKey')

    if (!file) {
      return Response.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!apiKey) {
      return Response.json(
        { success: false, error: 'API key is required' },
        { status: 400 }
      )
    }

    // Prepare form data for Marker API
    const markerFormData = new FormData()
    markerFormData.append('file', file)

    // Default options for now
    markerFormData.append('output_format', 'markdown')
    markerFormData.append('langs', 'English')
    markerFormData.append('paginate', 'false')
    markerFormData.append('use_llm', 'false')
    markerFormData.append('force_ocr', 'false')

    // Submit to Marker API
    const response = await fetch('https://www.datalab.to/api/v1/marker', {
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
      },
      body: markerFormData,
    })

    const data = await response.json()

    if (!response.ok) {
      return Response.json(
        {
          success: false,
          error: data.error || `API error: ${response.status}`
        },
        { status: response.status }
      )
    }

    // Return the request_check_url for polling
    return Response.json({
      success: true,
      request_id: data.request_id,
      request_check_url: data.request_check_url,
    })

  } catch (error) {
    console.error('Marker API error:', error)
    return Response.json(
      { success: false, error: 'Failed to process request' },
      { status: 500 }
    )
  }
}

// Poll endpoint to check status
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const checkUrl = searchParams.get('checkUrl')
    const apiKey = searchParams.get('apiKey')

    if (!checkUrl || !apiKey) {
      return Response.json(
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

    const data = await response.json()

    if (!response.ok) {
      return Response.json(
        {
          success: false,
          error: data.error || 'Failed to check status'
        },
        { status: response.status }
      )
    }

    return Response.json(data)

  } catch (error) {
    console.error('Poll error:', error)
    return Response.json(
      { success: false, error: 'Failed to check status' },
      { status: 500 }
    )
  }
}
