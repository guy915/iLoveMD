import { NextRequest, NextResponse } from 'next/server'
import { API_ENDPOINTS, FILE_SIZE, MARKER_CONFIG } from '@/lib/constants'
import { fetchWithTimeout, getNetworkErrorMessage, getNetworkErrorType } from '@/lib/utils/apiHelpers'
import { formatBytesToMB } from '@/lib/utils/formatUtils'
import type { MarkerUploadUrlResponse } from '@/types'

const API_KEY_REGEX = /^[A-Za-z0-9_-]{32,128}$/

/**
 * Get a presigned URL so the browser can upload a PDF straight to Datalab storage.
 *
 * PDFs can't be sent through our own API routes when they are larger than the
 * hosting platform's request body limit (about 4.5 MB on Vercel). This route only
 * handles a small JSON request; the file itself never passes through our server.
 *
 * Body (JSON): { apiKey, filename, size }
 */
export async function POST(request: NextRequest): Promise<NextResponse<MarkerUploadUrlResponse>> {
  let body: { apiKey?: unknown; filename?: unknown; size?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request format' }, { status: 400 })
  }

  const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : ''
  const filename = typeof body.filename === 'string' ? body.filename : ''
  const size = typeof body.size === 'number' ? body.size : NaN

  if (!apiKey) {
    return NextResponse.json({ success: false, error: 'API key is required' }, { status: 400 })
  }
  if (!API_KEY_REGEX.test(apiKey)) {
    return NextResponse.json(
      { success: false, error: 'Invalid API key format (must be 32-128 alphanumeric characters)' },
      { status: 400 }
    )
  }
  if (!filename || !filename.toLowerCase().endsWith('.pdf') || filename.length > 255) {
    return NextResponse.json({ success: false, error: 'Only PDF files are accepted' }, { status: 400 })
  }
  if (!Number.isFinite(size) || size <= 0) {
    return NextResponse.json({ success: false, error: 'File is empty. Please upload a valid PDF file.' }, { status: 400 })
  }
  if (size > FILE_SIZE.MAX_PDF_FILE_SIZE) {
    return NextResponse.json(
      { success: false, error: `File too large (max 200MB). Your file is ${formatBytesToMB(size)}` },
      { status: 413 }
    )
  }

  let response: Response
  try {
    response = await fetchWithTimeout(
      `${API_ENDPOINTS.DATALAB_FILES}/upload`,
      {
        method: 'POST',
        headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, content_type: 'application/pdf' }),
      },
      MARKER_CONFIG.TIMEOUTS.SUBMIT_REQUEST_MS
    )
  } catch (fetchError) {
    const errorType = getNetworkErrorType(fetchError)
    console.error('Network error requesting Datalab upload URL:', { errorType, message: String(fetchError) })
    return NextResponse.json(
      { success: false, error: getNetworkErrorMessage(errorType), details: { errorType } },
      { status: 503 }
    )
  }

  let data: Record<string, unknown> | null = null
  try {
    data = await response.json() as Record<string, unknown>
  } catch {
    // Handled below
  }

  if (!response.ok) {
    const message =
      (typeof data?.error === 'string' && data.error) ||
      (typeof data?.detail === 'string' && data.detail) ||
      `Failed to prepare upload (${response.status})`
    console.error('Datalab upload URL request failed:', { status: response.status, message })
    return NextResponse.json(
      { success: false, error: message, details: { httpStatus: response.status } },
      { status: response.status >= 500 ? 502 : response.status }
    )
  }

  const uploadUrl = data?.upload_url
  const fileId = data?.file_id
  const reference = data?.reference

  if (
    typeof uploadUrl !== 'string' || !uploadUrl.startsWith('https://') ||
    (typeof fileId !== 'number' && typeof fileId !== 'string') ||
    typeof reference !== 'string'
  ) {
    console.error('Datalab upload URL response missing fields:', { keys: data ? Object.keys(data) : [] })
    return NextResponse.json(
      { success: false, error: 'Received malformed response from Marker API' },
      { status: 502 }
    )
  }

  return NextResponse.json({
    success: true,
    upload_url: uploadUrl,
    file_id: String(fileId),
    reference,
  })
}
