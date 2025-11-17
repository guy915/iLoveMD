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
 *
 * REFACTORED: Now uses Strategy pattern to eliminate duplication between paid/free modes
 */

import { API_ENDPOINTS, MARKER_CONFIG, FILE_SIZE } from '@/lib/constants'
import type { MarkerSubmitResponse, MarkerPollResponse, MarkerOptions } from '@/types'
import { convertWithStrategy, type ProgressCallback } from './conversionStrategy'
import { PaidModeStrategy } from './strategies/PaidModeStrategy'
import { FreeModeStrategy } from './strategies/FreeModeStrategy'

/**
 * Result of a conversion operation
 */
export interface ConversionResult {
  success: boolean
  markdown?: string
  error?: string
}

// Re-export ProgressCallback for backward compatibility
export type { ProgressCallback }

/**
 * Submit a PDF file for conversion
 *
 * @deprecated This function is now encapsulated in PaidModeStrategy. Use convertPdfToMarkdown() instead.
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
 * @deprecated This function is now encapsulated in PaidModeStrategy. Use convertPdfToMarkdown() instead.
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
 * Convert a PDF file to Markdown with automatic polling (Paid Mode - Marker API)
 *
 * This function uses the Strategy pattern to handle the conversion workflow.
 * It delegates submit/poll operations to PaidModeStrategy.
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
  const strategy = new PaidModeStrategy(apiKey)
  return convertWithStrategy(file, strategy, options, onProgress, signal)
}
// ============================================================================
// MODAL (FREE MODE) FUNCTIONS
// ============================================================================

/**
 * Submit a PDF file for conversion to Modal instance
 *
 * @deprecated This function is now encapsulated in FreeModeStrategy. Use convertPdfToMarkdownLocal() instead.
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
 * Poll for conversion status from Modal instance
 *
 * @deprecated This function is now encapsulated in FreeModeStrategy. Use convertPdfToMarkdownLocal() instead.
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
 * Convert a PDF file to Markdown using Modal instance with automatic polling (Free Mode)
 *
 * This function uses the Strategy pattern to handle the conversion workflow.
 * It delegates submit/poll operations to FreeModeStrategy.
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
  const strategy = new FreeModeStrategy(geminiApiKey)
  return convertWithStrategy(file, strategy, options, onProgress, signal)
}
