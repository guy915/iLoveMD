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
 * browser to the Modal endpoint (which allows cross-origin requests). Status is always
 * polled there directly, since a result with images can exceed the response limit.
 */
export class FreeModeStrategy implements IConversionStrategy {
  /** How long a new job may be missing on Modal before it is reported as lost */
  static readonly JOB_VISIBLE_GRACE_MS = 60000

  /** When each job (by status URL) was submitted */
  private submittedAt = new Map<string, number>()

  constructor(private geminiApiKey: string | null) {}

  async submitConversion(file: File, options: MarkerOptions, signal?: AbortSignal): Promise<MarkerSubmitResponse> {
    if (file.size > FILE_SIZE.MAX_PROXY_UPLOAD_SIZE) {
      return this.submitDirect(file, options, signal)
    }

    const formData = new FormData()
    formData.append('file', file)
    if (this.geminiApiKey) {
      formData.append('geminiApiKey', this.geminiApiKey)
    }
    formData.append('options', JSON.stringify(options))

    const response = await fetch(API_ENDPOINTS.MARKER_LOCAL, {
      method: 'POST',
      body: formData,
      signal
    })

    if (!response.ok) {
      const detail = await getResponseErrorDetail(response)
      throw new Error(`Modal request failed: ${response.status}${detail ? ` - ${detail}` : ''}`)
    }

    const data = await response.json()
    if (!data.success) {
      throw new Error(data.error || 'Modal request failed')
    }

    if (data.request_check_url) {
      this.submittedAt.set(data.request_check_url, Date.now())
    }
    return data
  }

  /**
   * Send the PDF straight to the Modal endpoint, bypassing our API route
   */
  private async submitDirect(file: File, options: MarkerOptions, signal?: AbortSignal): Promise<MarkerSubmitResponse> {
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

    const token = await this.getDirectUploadToken()
    if (token) {
      formData.append('token', token)
    }

    let response: Response
    try {
      response = await fetch(`${API_ENDPOINTS.LOCAL_MARKER_INSTANCE}/marker`, {
        method: 'POST',
        body: formData,
        signal
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

    this.submittedAt.set(checkUrl, Date.now())

    return { success: true, request_id: data.request_id, request_check_url: checkUrl }
  }

  /**
   * Get a short-lived token from our server; the Modal endpoint rejects direct
   * uploads without one (this stops others from using the free GPU directly).
   */
  private async getDirectUploadToken(): Promise<string | null> {
    let response: Response
    try {
      response = await fetch(API_ENDPOINTS.MARKER_TOKEN, { method: 'POST' })
    } catch (networkError) {
      const reason = networkError instanceof Error ? networkError.message : String(networkError)
      throw new Error(`Unable to prepare the upload: ${reason}`)
    }
    if (!response.ok) {
      const detail = await getResponseErrorDetail(response)
      throw new Error(`Unable to prepare the upload: ${response.status}${detail ? ` - ${detail}` : ''}`)
    }
    const data = await response.json() as { token?: string | null }
    return data.token ?? null
  }

  /**
   * Poll the Modal status endpoint directly from the browser (it allows cross-origin
   * requests). Results with images can be larger than the hosting platform's 4.5 MB
   * response limit, so they can't go through our API route.
   */
  async pollStatus(checkUrl: string, signal?: AbortSignal): Promise<MarkerPollResponse> {
    if (!this.isModalStatusUrl(checkUrl)) {
      throw new Error('Invalid status URL from the free conversion service')
    }
    if (!this.submittedAt.has(checkUrl)) {
      this.submittedAt.set(checkUrl, Date.now())
    }

    let response: Response
    try {
      response = await fetch(checkUrl, signal ? { signal } : undefined)
    } catch (networkError) {
      if (signal?.aborted) throw networkError
      const reason = networkError instanceof Error ? networkError.message : String(networkError)
      throw new Error(`Polling failed: ${reason}`)
    }

    if (response.status === 404) {
      // A brand-new job may not be visible yet (Modal volume propagation) - keep polling.
      // After that, the job is gone (for example, the service restarted).
      const submittedAt = this.submittedAt.get(checkUrl) ?? 0
      if (Date.now() - submittedAt < FreeModeStrategy.JOB_VISIBLE_GRACE_MS) {
        return { success: true, status: 'processing' }
      }
      return { success: true, status: 'error', error: 'The conversion job was lost. Please try again.' }
    }

    if (!response.ok) {
      const detail = await getResponseErrorDetail(response)
      throw new Error(`Polling failed: ${response.status}${detail ? ` - ${detail}` : ''}`)
    }

    const data = await response.json() as {
      status?: string
      markdown?: string
      images?: Record<string, string>
      progress?: number
      error?: string
    }
    return {
      success: true,
      status: data.status as MarkerPollResponse['status'],
      markdown: data.markdown,
      progress: data.progress,
      ...(data.images && typeof data.images === 'object' ? { images: data.images } : {}),
      ...(data.status === 'error' && data.error ? { error: data.error } : {})
    }
  }

  /**
   * Stop the job on Modal so it doesn't keep using GPU time
   */
  async cancelConversion(checkUrl: string): Promise<void> {
    if (!this.isModalStatusUrl(checkUrl)) return
    const cancelUrl = checkUrl.replace(/\/status\/([^/?#]+)$/, '/cancel/$1')
    if (cancelUrl === checkUrl) return
    await fetch(cancelUrl, { method: 'POST' })
  }

  /** Only poll our own Modal app */
  private isModalStatusUrl(checkUrl: string): boolean {
    return checkUrl.startsWith(`${API_ENDPOINTS.LOCAL_MARKER_INSTANCE}/status/`)
  }

  getErrorPrefix(): string {
    return 'Modal'
  }

  needsInitialDelay(): boolean {
    return true // Modal needs delay for volume propagation
  }
}
