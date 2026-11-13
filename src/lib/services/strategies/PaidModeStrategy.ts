/**
 * Paid mode conversion strategy (Marker API)
 */

import type { MarkerOptions, MarkerSubmitResponse, MarkerPollResponse, MarkerUploadUrlResponse } from '@/types'
import { getResponseErrorDetail, type IConversionStrategy } from '../conversionStrategy'
import { API_ENDPOINTS, FILE_SIZE } from '@/lib/constants'

/**
 * Strategy for paid mode conversion using Marker API
 *
 * Files larger than the hosting platform's request limit are uploaded straight from the
 * browser to Datalab storage with a presigned URL; only small JSON/form requests go
 * through our API routes.
 */
export class PaidModeStrategy implements IConversionStrategy {
  constructor(private apiKey: string) {}

  async submitConversion(file: File, options: MarkerOptions, signal?: AbortSignal): Promise<MarkerSubmitResponse> {
    // Small files keep the simple path through our API route; larger ones would be
    // rejected by the platform's request limit, so they go straight to storage
    if (file.size <= FILE_SIZE.MAX_PROXY_UPLOAD_SIZE) {
      return this.submitViaServer(file, options, signal)
    }
    return this.submitViaDirectUpload(file, options, signal)
  }

  /**
   * Upload the PDF directly to Datalab storage, then start the conversion by reference
   */
  private async submitViaDirectUpload(file: File, options: MarkerOptions, signal?: AbortSignal): Promise<MarkerSubmitResponse> {
    // 1. Get a presigned upload URL (small JSON request through our API route)
    const uploadUrlResponse = await fetch(API_ENDPOINTS.MARKER_UPLOAD_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: this.apiKey, filename: file.name, size: file.size }),
      signal
    })

    if (!uploadUrlResponse.ok) {
      const detail = await getResponseErrorDetail(uploadUrlResponse)
      const message = `API request failed: ${uploadUrlResponse.status}${detail ? ` - ${detail}` : ''}`
      throw new Error(message)
    }

    const upload = await uploadUrlResponse.json() as MarkerUploadUrlResponse
    if (!upload.success || !upload.upload_url || !upload.file_id || !upload.reference) {
      throw new Error(upload.error || 'Failed to prepare upload')
    }

    // 2. Upload the file straight to storage (bypasses our server)
    let putResponse: Response
    try {
      putResponse = await fetch(upload.upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/pdf' },
        body: file,
        signal
      })
    } catch (networkError) {
      // Network or CORS failure
      const reason = networkError instanceof Error ? networkError.message : String(networkError)
      throw new Error(`Failed to upload the file to Marker storage: ${reason}`)
    }
    if (!putResponse.ok) {
      throw new Error(`Failed to upload the file to Marker storage: ${putResponse.status}`)
    }

    // 3. Start the conversion using the uploaded file reference
    const formData = new FormData()
    formData.append('fileReference', upload.reference)
    formData.append('fileId', upload.file_id)
    formData.append('apiKey', this.apiKey)
    formData.append('options', JSON.stringify(options))

    return this.postToMarkerRoute(formData, signal)
  }

  /**
   * Send the PDF through our API route (only works for files under the platform body limit)
   */
  private async submitViaServer(file: File, options: MarkerOptions, signal?: AbortSignal): Promise<MarkerSubmitResponse> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('apiKey', this.apiKey)
    formData.append('options', JSON.stringify(options))

    return this.postToMarkerRoute(formData, signal)
  }

  private async postToMarkerRoute(formData: FormData, signal?: AbortSignal): Promise<MarkerSubmitResponse> {
    const response = await fetch(API_ENDPOINTS.MARKER, {
      method: 'POST',
      body: formData,
      signal
    })

    if (!response.ok) {
      const detail = await getResponseErrorDetail(response)
      throw new Error(`API request failed: ${response.status}${detail ? ` - ${detail}` : ''}`)
    }

    const data = await response.json()
    if (!data.success) {
      throw new Error(data.error || 'API request failed')
    }

    return data
  }

  async pollStatus(checkUrl: string, signal?: AbortSignal): Promise<MarkerPollResponse> {
    const data = await this.getStatus(checkUrl, '', signal)

    // A large result comes back in parts (the platform caps one response at ~4.5 MB)
    if (data.status === 'complete' && data.markdownParts) {
      const parts: string[] = []
      for (let index = 0; index < data.markdownParts; index++) {
        const part = await this.getStatus(checkUrl, `&part=markdown&index=${index}`, signal)
        parts.push(part.markdown ?? '')
      }
      const images: Record<string, string> = {}
      for (const name of data.imageNames ?? []) {
        const part = await this.getStatus(checkUrl, `&part=image&name=${encodeURIComponent(name)}`, signal)
        if (part.images?.[name]) images[name] = part.images[name]
      }
      return {
        success: true,
        status: 'complete',
        markdown: parts.join(''),
        ...(Object.keys(images).length > 0 ? { images } : {})
      }
    }

    return data
  }

  private async getStatus(checkUrl: string, extraQuery: string, signal?: AbortSignal): Promise<MarkerPollResponse> {
    const response = await fetch(
      `${API_ENDPOINTS.MARKER}?checkUrl=${encodeURIComponent(checkUrl)}${extraQuery}`,
      {
        headers: {
          'x-api-key': this.apiKey
        },
        signal
      }
    )

    if (!response.ok) {
      const detail = await getResponseErrorDetail(response)
      throw new Error(`Polling failed: ${response.status}${detail ? ` - ${detail}` : ''}`)
    }

    const data = await response.json()
    if (!data.success) {
      throw new Error(data.error || 'Polling failed')
    }

    return data
  }

  getErrorPrefix(): string {
    return 'API'
  }

  needsInitialDelay(): boolean {
    return false // Marker API doesn't need initial delay
  }
}

