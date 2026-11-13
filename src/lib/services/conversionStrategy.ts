/**
 * Strategy pattern for PDF to Markdown conversion
 * Eliminates duplication between paid and free conversion modes
 */

import type { MarkerOptions, MarkerSubmitResponse, MarkerPollResponse, ConversionResult } from '@/types'
import { MARKER_CONFIG } from '@/lib/constants'

/**
 * Number of failed polls in a row that are tolerated before the conversion is reported as failed
 */
export const MAX_CONSECUTIVE_POLL_FAILURES = 3

/** Shown when a conversion finishes but the PDF has no text (for example, a blank PDF) */
export const NO_TEXT_FOUND_ERROR = 'No text was found in this PDF. It may be blank.'

/** Shown when the PDF is password-protected */
export const ENCRYPTED_PDF_ERROR = 'This PDF is password-protected. Remove the password and try again.'

/** Shown when the PDF is damaged or not a real PDF */
export const DAMAGED_PDF_ERROR = 'This PDF is damaged or is not a valid PDF file.'

/**
 * Turn a raw failure reason from the conversion service into a readable message.
 * The PDF library reports password-protected and damaged files with technical text,
 * for example "Unexpected error: Failed to load document (PDFium: Incorrect password error)."
 */
export function describeJobError(raw: string): string {
  const lower = raw.toLowerCase()
  if (lower.includes('password') || lower.includes('encrypted')) {
    return ENCRYPTED_PDF_ERROR
  }
  if (lower.includes('failed to load document') || lower.includes('data format error')) {
    return DAMAGED_PDF_ERROR
  }
  return raw.replace(/^Unexpected error:\s*/i, '')
}

/**
 * Progress callback type
 */
export type ProgressCallback = (status: string, attemptNumber: number, elapsedSeconds: number) => void

/**
 * Interface for conversion strategy
 * Defines the contract that all conversion modes must implement
 */
export interface IConversionStrategy {
  /**
   * Submit a PDF file for conversion
   * @param file - The PDF file to convert
   * @param options - Conversion options
   * @param signal - Optional abort signal (stops an upload in progress)
   * @returns Submit response with request_check_url for polling
   */
  submitConversion(file: File, options: MarkerOptions, signal?: AbortSignal): Promise<MarkerSubmitResponse>

  /**
   * Poll the conversion status
   * @param checkUrl - The URL to check conversion status
   * @param signal - Optional abort signal
   * @returns Poll response with status and content
   */
  pollStatus(checkUrl: string, signal?: AbortSignal): Promise<MarkerPollResponse>

  /**
   * Get the error message prefix for this mode
   * @returns Error message prefix (e.g., "API", "Modal")
   */
  getErrorPrefix(): string

  /**
   * Whether to add an initial delay before first poll
   * @returns True if initial delay is needed
   */
  needsInitialDelay(): boolean
}

/**
 * Base conversion function using strategy pattern
 * Handles the common conversion workflow for all modes
 *
 * @param file - The PDF file to convert
 * @param strategy - The conversion strategy to use
 * @param options - Conversion options
 * @param onProgress - Optional progress callback
 * @param signal - Optional abort signal
 * @returns Conversion result
 */
export async function convertWithStrategy(
  file: File,
  strategy: IConversionStrategy,
  options: MarkerOptions,
  onProgress?: ProgressCallback,
  signal?: AbortSignal
): Promise<ConversionResult> {
  try {
    // Check if already cancelled
    if (signal?.aborted) {
      return { success: false, error: 'Conversion cancelled' }
    }

    // Submit file using strategy
    const submitResponse = await strategy.submitConversion(file, options, signal)

    if (!submitResponse.request_check_url) {
      const prefix = strategy.getErrorPrefix()
      return { success: false, error: `No status check URL returned from ${prefix}` }
    }

    // Poll for results
    const checkUrl = submitResponse.request_check_url
    const pollInterval = MARKER_CONFIG.POLLING.INTERVAL_MS
    const maxAttempts = MARKER_CONFIG.POLLING.MAX_ATTEMPTS
    const startTime = Date.now()
    let consecutivePollFailures = 0

    // Add initial delay if needed (for eventual consistency)
    if (strategy.needsInitialDelay()) {
      await new Promise(resolve => setTimeout(resolve, MARKER_CONFIG.POLLING.INITIAL_DELAY_MS))
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // Check if cancelled
      if (signal?.aborted) {
        return { success: false, error: 'Conversion cancelled' }
      }

      const elapsedSeconds = (Date.now() - startTime) / 1000

      // Poll status using strategy. A single failed poll (network blip, gateway timeout)
      // should not throw away a long-running conversion, so retry a few times in a row.
      let pollResponse: MarkerPollResponse
      try {
        pollResponse = await strategy.pollStatus(checkUrl, signal)
        consecutivePollFailures = 0
      } catch (pollError) {
        consecutivePollFailures++
        if (consecutivePollFailures > MAX_CONSECUTIVE_POLL_FAILURES || signal?.aborted) {
          throw pollError
        }
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, pollInterval))
        }
        continue
      }

      // Notify progress
      if (onProgress && pollResponse.status) {
        onProgress(pollResponse.status, attempt, elapsedSeconds)
      }

      // Check if complete
      if (pollResponse.status === 'complete') {
        if (!pollResponse.markdown) {
          // The service finished but found no text (for example, a blank PDF)
          if (pollResponse.markdown === '') {
            return { success: false, error: NO_TEXT_FOUND_ERROR }
          }
          const prefix = strategy.getErrorPrefix()
          return { success: false, error: `No content received from ${prefix}` }
        }
        return { success: true, markdown: pollResponse.markdown }
      }

      // Check if error
      if (pollResponse.status === 'error') {
        const prefix = strategy.getErrorPrefix()
        return {
          success: false,
          error: pollResponse.error
            ? `Conversion failed on ${prefix}: ${describeJobError(pollResponse.error)}`
            : `Conversion failed on ${prefix}`
        }
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
    if (signal?.aborted) {
      return { success: false, error: 'Conversion cancelled' }
    }
    const err = error as Error
    const prefix = strategy.getErrorPrefix()
    return {
      success: false,
      error: err.message || `An error occurred during ${prefix.toLowerCase()} conversion`
    }
  }
}

/**
 * Read a readable error detail from a failed response from our API routes.
 *
 * Our routes return JSON like `{ success: false, error: "..." }`. Without this,
 * the raw JSON body would be shown to the user. Requests that are too large are
 * rejected by the hosting platform before they reach our route, with a non-JSON body.
 */
export async function getResponseErrorDetail(response: Response): Promise<string> {
  if (response.status === 413) {
    return 'File is too large to upload through the server. Try a smaller PDF.'
  }

  let text = ''
  try {
    text = typeof response.text === 'function' ? await response.text() : ''
  } catch {
    return ''
  }

  try {
    const data = JSON.parse(text) as { error?: unknown }
    if (data && typeof data.error === 'string' && data.error) {
      return data.error
    }
  } catch {
    // Not JSON - fall through to the raw text
  }

  const MAX_DETAIL_LENGTH = 200
  const trimmed = text.trim()
  return trimmed.length > MAX_DETAIL_LENGTH ? `${trimmed.slice(0, MAX_DETAIL_LENGTH)}...` : trimmed
}
