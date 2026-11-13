/**
 * Free mode conversion strategy (Modal)
 */

import type { MarkerOptions, MarkerSubmitResponse, MarkerPollResponse } from '@/types'
import { getResponseErrorDetail, type IConversionStrategy } from '../conversionStrategy'
import { API_ENDPOINTS, FILE_SIZE } from '@/lib/constants'

/**
 * Strategy for free mode conversion using Modal
 *
 * Files larger than the hosting platform's request limit are sent straight from the
 * browser to the Modal endpoint (which allows cross-origin requests), and their status
 * is polled there directly too, since a large result could also exceed the limit.
 */
export class FreeModeStrategy implements IConversionStrategy {
  /** Status URLs of jobs submitted directly to Modal (polled directly as well) */
  private directCheckUrls = new Set<string>()

  constructor(private geminiApiKey: string | null) {}

  async submitConversion(file: File, options: MarkerOptions): Promise<MarkerSubmitResponse> {
    if (file.size > FILE_SIZE.MAX_PROXY_UPLOAD_SIZE) {
      return this.submitDirect(file, options)
    }

    const formData = new FormData()
    formData.append('file', file)
    if (this.geminiApiKey) {
      formData.append('geminiApiKey', this.geminiApiKey)
    }
    formData.append('options', JSON.stringify(options))

    const response = await fetch(API_ENDPOINTS.MARKER_LOCAL, {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      const detail = await getResponseErrorDetail(response)
      throw new Error(`Modal request failed: ${response.status}${detail ? ` - ${detail}` : ''}`)
    }

    const data = await response.json()
    if (!data.success) {
      throw new Error(data.error || 'Modal request failed')
    }

    return data
  }

  /**
   * Send the PDF straight to the Modal endpoint, bypassing our API route
   */
  private async submitDirect(file: File, options: MarkerOptions): Promise<MarkerSubmitResponse> {
    if (options.use_llm && !this.geminiApiKey?.trim()) {
      throw new Error('Gemini API key is required when using LLM enhancement in free mode')
    }

    const formData = new FormData()
    formData.append('file', file)
    formData.append('output_format', options.output_format)
    formData.append('langs', options.langs)
    formData.append('paginate', String(options.paginate))
    formData.append('format_lines', String(options.format_lines))
    formData.append('use_llm', String(options.use_llm))
    formData.append('disable_image_extraction', String(options.disable_image_extraction))
    if (options.redo_inline_math !== undefined) {
      formData.append('redo_inline_math', String(options.redo_inline_math))
    }
    if (options.use_llm && this.geminiApiKey) {
      formData.append('api_key', this.geminiApiKey.trim())
    }

    let response: Response
    try {
      response = await fetch(`${API_ENDPOINTS.LOCAL_MARKER_INSTANCE}/marker`, {
        method: 'POST',
        body: formData
      })
    } catch (networkError) {
      const reason = networkError instanceof Error ? networkError.message : String(networkError)
      throw new Error(`Unable to reach the free conversion service: ${reason}`)
    }

    if (!response.ok) {
      const detail = await getResponseErrorDetail(response)
      throw new Error(`Modal request failed: ${response.status}${detail ? ` - ${detail}` : ''}`)
    }

    const data = await response.json() as { request_id?: string; request_check_url?: string; error?: string }
    if (!data.request_id || !data.request_check_url) {
      throw new Error(data.error || 'Invalid response from the free conversion service')
    }

    // Modal returns a relative status URL like "/status/{id}"
    const checkUrl = data.request_check_url.startsWith('http')
      ? data.request_check_url
      : `${API_ENDPOINTS.LOCAL_MARKER_INSTANCE}${data.request_check_url}`

    this.directCheckUrls.add(checkUrl)

    return { success: true, request_id: data.request_id, request_check_url: checkUrl }
  }

  async pollStatus(checkUrl: string): Promise<MarkerPollResponse> {
    if (this.directCheckUrls.has(checkUrl)) {
      return this.pollDirect(checkUrl)
    }

    const response = await fetch(
      `${API_ENDPOINTS.MARKER_LOCAL}?checkUrl=${encodeURIComponent(checkUrl)}`
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

  /**
   * Poll the Modal status endpoint directly (same handling as the /api/marker/local route)
   */
  private async pollDirect(checkUrl: string): Promise<MarkerPollResponse> {
    const response = await fetch(checkUrl)

    // The job may not be visible yet (Modal volume propagation) - keep polling
    if (response.status === 404) {
      return { success: true, status: 'processing' }
    }

    if (!response.ok) {
      const detail = await getResponseErrorDetail(response)
      throw new Error(`Polling failed: ${response.status}${detail ? ` - ${detail}` : ''}`)
    }

    const data = await response.json() as { status?: string; markdown?: string; progress?: number; error?: string }
    return {
      success: true,
      status: data.status as MarkerPollResponse['status'],
      markdown: data.markdown,
      progress: data.progress,
      ...(data.status === 'error' && data.error ? { error: data.error } : {})
    }
  }

  getErrorPrefix(): string {
    return 'Modal'
  }

  needsInitialDelay(): boolean {
    return true // Modal needs delay for volume propagation
  }
}
