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

  /**
   * Ask the service to stop a running job (optional, best effort)
   * @param checkUrl - The job's status URL
   */
  cancelConversion?(checkUrl: string): Promise<void>
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
  let checkUrl: string | undefined
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
    checkUrl = submitResponse.request_check_url
    const maxAttempts = MARKER_CONFIG.POLLING.MAX_ATTEMPTS
    const startTime = Date.now()
    const deadline = startTime + MARKER_CONFIG.POLLING.TIMEOUT_DURATION_MS
    let consecutivePollFailures = 0

    // Poll quickly at first, then less often, so long jobs (and big batches) don't flood the API
    const nextDelay = (): number =>
      Date.now() - startTime < MARKER_CONFIG.POLLING.FAST_PHASE_MS
        ? MARKER_CONFIG.POLLING.INTERVAL_MS
        : MARKER_CONFIG.POLLING.SLOW_INTERVAL_MS

    // Add initial delay if needed (for eventual consistency)
    if (strategy.needsInitialDelay()) {
      await sleep(MARKER_CONFIG.POLLING.INITIAL_DELAY_MS)
    }

    for (let attempt = 1; attempt <= maxAttempts && Date.now() < deadline; attempt++) {
      // Check if cancelled
      if (signal?.aborted) {
        return cancelled(strategy, checkUrl)
      }

      const elapsedSeconds = (Date.now() - startTime) / 1000

      // Poll status using strategy. A single failed poll (network blip, gateway timeout)
      // should not throw away a long-running conversion, so retry a few times in a row.
      let pollResponse: MarkerPollResponse
      try {
        pollResponse = await strategy.pollStatus(checkUrl, signal)
        consecutivePollFailures = 0
      } catch (pollError) {
        if (signal?.aborted) {
          return cancelled(strategy, checkUrl)
        }
        // Rate limited: wait longer, but don't count it as a failure
        const message = pollError instanceof Error ? pollError.message : String(pollError)
        if (/failed: 429\b/.test(message)) {
          await sleep(MARKER_CONFIG.POLLING.RATE_LIMIT_DELAY_MS)
          continue
        }
        consecutivePollFailures++
        if (consecutivePollFailures > MAX_CONSECUTIVE_POLL_FAILURES) {
          throw pollError
        }
        await sleep(nextDelay())
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
        return pollResponse.images && Object.keys(pollResponse.images).length > 0
          ? { success: true, markdown: pollResponse.markdown, images: pollResponse.images }
          : { success: true, markdown: pollResponse.markdown }
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

      // Wait before next poll
      await sleep(nextDelay())

      // Check if cancelled during the wait
      if (signal?.aborted) {
        return cancelled(strategy, checkUrl)
      }
    }

    // Timeout
    return { success: false, error: 'Conversion timeout. Please try again.' }

  } catch (error) {
    if (signal?.aborted) {
      return cancelled(strategy, checkUrl)
    }
    const err = error as Error
    const prefix = strategy.getErrorPrefix()
    return {
      success: false,
      error: err.message || `An error occurred during ${prefix.toLowerCase()} conversion`
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Report a cancelled conversion, and ask the service to stop the job (best effort),
 * so it doesn't keep using GPU time for a result nobody will read.
 */
function cancelled(strategy: IConversionStrategy, checkUrl: string | undefined): ConversionResult {
  if (checkUrl && strategy.cancelConversion) {
    strategy.cancelConversion(checkUrl).catch(() => {
      // Best effort: the job will finish on its own
    })
  }
  return { success: false, error: 'Conversion cancelled' }
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
