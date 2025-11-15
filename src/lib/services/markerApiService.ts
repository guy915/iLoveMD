/**
 * Marker API Service - Client-side service for PDF to Markdown conversion
 *
 * This service provides a clean interface for interacting with the Marker API
 * through our Next.js API routes. It handles:
 * - File submission
 * - Status polling
 * - Error handling
 * - Response parsing
 *
 * Benefits of this service layer:
 * - Reusable across multiple components
 * - Easier to test (can be mocked)
 * - Centralized error handling
 * - Consistent API interface
 */

import { API_ENDPOINTS, MARKER_CONFIG, FILE_SIZE } from '@/lib/constants'
import type { MarkerSubmitResponse, MarkerPollResponse, MarkerOptions } from '@/types'

/**
 * Result of a conversion operation
 */
export interface ConversionResult {
  success: boolean
  markdown?: string
  error?: string
}

/**
 * Progress callback for polling
 */
export type ProgressCallback = (status: string, attemptNumber: number, elapsedSeconds: number) => void

/**
 * Submit a PDF file for conversion
 *
 * @param file - The PDF file to convert
 * @param apiKey - The Marker API key
 * @param options - Conversion options
 * @returns Submit response with request_check_url for polling
 */
export async function submitPdfConversion(
  file: File,
  apiKey: string,
  options: MarkerOptions
): Promise<MarkerSubmitResponse> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('apiKey', apiKey)
  formData.append('options', JSON.stringify(options))

  const response = await fetch(API_ENDPOINTS.MARKER, {
    method: 'POST',
    body: formData,
  })

  const data = await response.json() as MarkerSubmitResponse

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to submit file for conversion')
  }

  return data
}

/**
 * Poll for conversion status
 *
 * @param checkUrl - The status check URL from submit response
 * @param apiKey - The Marker API key
 * @returns Poll response with status and markdown (if complete)
 */
export async function pollConversionStatus(
  checkUrl: string,
  apiKey: string
): Promise<MarkerPollResponse> {
  const response = await fetch(
    `${API_ENDPOINTS.MARKER}?checkUrl=${encodeURIComponent(checkUrl)}`,
    {
      headers: {
        'x-api-key': apiKey
      }
    }
  )

  const data = await response.json() as MarkerPollResponse

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to check conversion status')
  }

  return data
}

/**
 * Convert a PDF file to Markdown with automatic polling
 *
 * This is a high-level function that handles the entire conversion flow:
 * 1. Submit file
 * 2. Poll for completion
 * 3. Return markdown content
 *
 * @param file - The PDF file to convert
 * @param apiKey - The Marker API key
 * @param options - Conversion options
 * @param onProgress - Optional callback for progress updates
 * @param signal - Optional AbortSignal for cancellation
 * @returns The converted markdown content
 */
export async function convertPdfToMarkdown(
  file: File,
  apiKey: string,
  options: MarkerOptions,
  onProgress?: ProgressCallback,
  signal?: AbortSignal
): Promise<ConversionResult> {
  try {
    // Check if already cancelled
    if (signal?.aborted) {
      return { success: false, error: 'Conversion cancelled' }
    }

    // Submit file
    const submitResponse = await submitPdfConversion(file, apiKey, options)

    if (!submitResponse.request_check_url) {
      return { success: false, error: 'No status check URL returned from API' }
    }

    // Poll for results
    const checkUrl = submitResponse.request_check_url
    const pollInterval = MARKER_CONFIG.POLLING.INTERVAL_MS
    const maxAttempts = MARKER_CONFIG.POLLING.MAX_ATTEMPTS
    const startTime = Date.now()

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // Check if cancelled
      if (signal?.aborted) {
        return { success: false, error: 'Conversion cancelled' }
      }

      const elapsedSeconds = (Date.now() - startTime) / 1000

      // Poll status
      const pollResponse = await pollConversionStatus(checkUrl, apiKey)

      // Notify progress
      if (onProgress && pollResponse.status) {
        onProgress(pollResponse.status, attempt, elapsedSeconds)
      }

      // Check if complete
      if (pollResponse.status === 'complete') {
        if (!pollResponse.markdown) {
          return { success: false, error: 'No content received from API' }
        }
        return { success: true, markdown: pollResponse.markdown }
      }

      // Check if error
      if (pollResponse.status === 'error') {
        return { success: false, error: 'Conversion failed on server' }
      }

      // Wait before next poll (unless this is the last attempt)
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, pollInterval))

        // Check if cancelled during the wait
        if (signal?.aborted) {
          return { success: false, error: 'Conversion cancelled' }
        }
      }
    }

    // Timeout
    return { success: false, error: 'Conversion timeout. Please try again.' }

  } catch (error) {
    const err = error as Error
    return { success: false, error: err.message || 'An error occurred during conversion' }
  }
}

/**
 * Validate API key format
 *
 * @param apiKey - The API key to validate
 * @returns True if valid, false otherwise
 */
export function validateApiKey(apiKey: string): boolean {
  const trimmed = apiKey.trim()
  return trimmed.length >= MARKER_CONFIG.VALIDATION.MIN_API_KEY_LENGTH
}

/**
 * Validate file for PDF conversion
 *
 * @param file - The file to validate
 * @returns Validation result with error message if invalid
 */
export function validatePdfFile(file: File): { valid: boolean; error?: string } {
  // Check file type
  const validTypes = MARKER_CONFIG.VALIDATION.ACCEPTED_MIME_TYPES as readonly string[]
  if (!file.type || !validTypes.includes(file.type)) {
    return { valid: false, error: 'Only PDF files are accepted' }
  }

  // Check file size
  if (file.size > FILE_SIZE.MAX_PDF_FILE_SIZE) {
    const sizeMB = (file.size / FILE_SIZE.BYTES_PER_MB).toFixed(2)
    return { valid: false, error: `File too large (max 200MB). Your file is ${sizeMB}MB` }
  }

  return { valid: true }
}

// ============================================================================
// LOCAL MARKER FUNCTIONS
// ============================================================================

/**
 * Submit a PDF file for conversion to local Marker instance
 *
 * @param file - The PDF file to convert
 * @param geminiApiKey - The Gemini API key (required if use_llm is enabled)
 * @param options - Conversion options
 * @returns Submit response with request_check_url for polling
 */
export async function submitPdfConversionLocal(
  file: File,
  geminiApiKey: string | null,
  options: MarkerOptions
): Promise<MarkerSubmitResponse> {
  const formData = new FormData()
  formData.append('file', file)
  if (geminiApiKey) {
    formData.append('geminiApiKey', geminiApiKey)
  }
  formData.append('options', JSON.stringify(options))

  const response = await fetch(API_ENDPOINTS.MARKER_LOCAL, {
    method: 'POST',
    body: formData,
  })

  const data = await response.json() as MarkerSubmitResponse

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to submit file for local conversion')
  }

  return data
}

/**
 * Poll for conversion status from local Marker instance
 *
 * @param checkUrl - The status check URL from submit response
 * @returns Poll response with status and markdown (if complete)
 */
export async function pollConversionStatusLocal(
  checkUrl: string
): Promise<MarkerPollResponse> {
  const response = await fetch(
    `${API_ENDPOINTS.MARKER_LOCAL}?checkUrl=${encodeURIComponent(checkUrl)}`
  )

  const data = await response.json() as MarkerPollResponse

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to check local conversion status')
  }

  return data
}

/**
 * Convert a PDF file to Markdown using local Marker instance with automatic polling
 *
 * This is a high-level function that handles the entire conversion flow:
 * 1. Submit file
 * 2. Poll for completion
 * 3. Return markdown content
 *
 * @param file - The PDF file to convert
 * @param geminiApiKey - The Gemini API key (required if use_llm is enabled)
 * @param options - Conversion options
 * @param onProgress - Optional callback for progress updates
 * @param signal - Optional AbortSignal for cancellation
 * @returns The converted markdown content
 */
export async function convertPdfToMarkdownLocal(
  file: File,
  geminiApiKey: string | null,
  options: MarkerOptions,
  onProgress?: ProgressCallback,
  signal?: AbortSignal
): Promise<ConversionResult> {
  try {
    // Check if already cancelled
    if (signal?.aborted) {
      return { success: false, error: 'Conversion cancelled' }
    }

    // Submit file
    const submitResponse = await submitPdfConversionLocal(file, geminiApiKey, options)

    if (!submitResponse.request_check_url) {
      return { success: false, error: 'No status check URL returned from local Marker' }
    }

    // Poll for results
    const checkUrl = submitResponse.request_check_url
    const pollInterval = MARKER_CONFIG.POLLING.INTERVAL_MS
    const maxAttempts = MARKER_CONFIG.POLLING.MAX_ATTEMPTS
    const startTime = Date.now()

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // Check if cancelled
      if (signal?.aborted) {
        return { success: false, error: 'Conversion cancelled' }
      }

      const elapsedSeconds = (Date.now() - startTime) / 1000

      // Poll status
      const pollResponse = await pollConversionStatusLocal(checkUrl)

      // Notify progress
      if (onProgress && pollResponse.status) {
        onProgress(pollResponse.status, attempt, elapsedSeconds)
      }

      // Check if complete
      if (pollResponse.status === 'complete') {
        if (!pollResponse.markdown) {
          return { success: false, error: 'No content received from local Marker' }
        }
        return { success: true, markdown: pollResponse.markdown }
      }

      // Check if error
      if (pollResponse.status === 'error') {
        return { success: false, error: 'Conversion failed on local Marker' }
      }

      // Wait before next poll (unless this is the last attempt)
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, pollInterval))

        // Check if cancelled during the wait
        if (signal?.aborted) {
          return { success: false, error: 'Conversion cancelled' }
        }
      }
    }

    // Timeout
    return { success: false, error: 'Conversion timeout. Please try again.' }

  } catch (error) {
    const err = error as Error
    return { success: false, error: err.message || 'An error occurred during local conversion' }
  }
}
