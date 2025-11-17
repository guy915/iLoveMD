/**
 * Strategy pattern for PDF to Markdown conversion
 * Eliminates duplication between paid and free conversion modes
 */

import type { MarkerOptions, MarkerSubmitResponse, MarkerPollResponse, ConversionResult } from '@/types'
import { MARKER_CONFIG } from '@/lib/constants'

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
   * @returns Submit response with request_check_url for polling
   */
  submitConversion(file: File, options: MarkerOptions): Promise<MarkerSubmitResponse>

  /**
   * Poll the conversion status
   * @param checkUrl - The URL to check conversion status
   * @returns Poll response with status and content
   */
  pollStatus(checkUrl: string): Promise<MarkerPollResponse>

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
    const submitResponse = await strategy.submitConversion(file, options)

    if (!submitResponse.request_check_url) {
      const prefix = strategy.getErrorPrefix()
      return { success: false, error: `No status check URL returned from ${prefix}` }
    }

    // Poll for results
    const checkUrl = submitResponse.request_check_url
    const pollInterval = MARKER_CONFIG.POLLING.INTERVAL_MS
    const maxAttempts = MARKER_CONFIG.POLLING.MAX_ATTEMPTS
    const startTime = Date.now()

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

      // Poll status using strategy
      const pollResponse = await strategy.pollStatus(checkUrl)

      // Notify progress
      if (onProgress && pollResponse.status) {
        onProgress(pollResponse.status, attempt, elapsedSeconds)
      }

      // Check if complete
      if (pollResponse.status === 'complete') {
        if (!pollResponse.markdown) {
          const prefix = strategy.getErrorPrefix()
          return { success: false, error: `No content received from ${prefix}` }
        }
        return { success: true, markdown: pollResponse.markdown }
      }

      // Check if error
      if (pollResponse.status === 'error') {
        const prefix = strategy.getErrorPrefix()
        return { success: false, error: `Conversion failed on ${prefix}` }
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
    const prefix = strategy.getErrorPrefix()
    return {
      success: false,
      error: err.message || `An error occurred during ${prefix.toLowerCase()} conversion`
    }
  }
}
