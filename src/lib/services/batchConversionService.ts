/**
 * Batch Conversion Service - Handles parallel PDF to Markdown conversion
 *
 * Features:
 * - Parallel processing with configurable concurrency (up to 200 per Marker API limits)
 * - Exponential backoff retry for failed conversions (3 retries with delays: 1s, 2s, 4s)
 * - Progress tracking with real-time updates
 * - Defensive programming for memory management
 * - Graceful degradation on errors
 * - ZIP file generation for batch results
 *
 * Marker API Limits:
 * - 200MB maximum per individual PDF file
 * - 200 concurrent API requests maximum
 */

import { convertPdfToMarkdown, convertPdfToMarkdownLocal } from './markerApiService'
import { replaceExtension } from '@/lib/utils/downloadUtils'
import { cleanupPdfMarkdown } from '@/lib/utils/markdownUtils'
import { MARKER_CONFIG, FILE_SIZE } from '@/lib/constants'
import { ENCRYPTED_PDF_ERROR, DAMAGED_PDF_ERROR, NO_TEXT_FOUND_ERROR } from './conversionStrategy'
import type { MarkerOptions } from '@/types'

// Detect if running in test environment to skip delays
// Check multiple indicators since process.env.VITEST may not always be set
const isVitest = 
  (typeof process !== 'undefined' && process.env.VITEST === 'true') ||
  (typeof process !== 'undefined' && process.env.NODE_ENV === 'test')

/**
 * Status of an individual file conversion
 */
export type FileConversionStatus = 'pending' | 'processing' | 'complete' | 'failed' | 'cancelled'

/**
 * Result of a single file conversion
 */
export interface FileConversionResult {
  file: File
  filename: string
  status: FileConversionStatus
  markdown?: string
  error?: string
  attempts: number
  startTime?: number
  endTime?: number
  duration?: number
}

/**
 * Batch conversion progress update
 */
export interface BatchProgress {
  total: number
  completed: number
  failed: number
  cancelled: number
  inProgress: number
  results: FileConversionResult[]
}

/**
 * Progress callback for batch conversion
 */
export type BatchProgressCallback = (progress: BatchProgress) => void

/**
 * Options for batch conversion (paid mode)
 */
export interface BatchConversionOptions {
  apiKey: string
  markerOptions: MarkerOptions
  maxConcurrent?: number
  maxRetries?: number
  onProgress?: BatchProgressCallback
  signal?: AbortSignal
  filenameMap?: Map<File, string> // Optional map for custom output filenames (handles duplicates)
}

/**
 * Options for batch conversion (Modal free mode)
 */
export interface BatchConversionOptionsLocal {
  geminiApiKey: string | null
  markerOptions: MarkerOptions
  maxConcurrent?: number
  maxRetries?: number
  onProgress?: BatchProgressCallback
  signal?: AbortSignal
  filenameMap?: Map<File, string> // Optional map for custom output filenames (handles duplicates)
}

/**
 * Batch conversion result
 */
export interface BatchConversionResult {
  success: boolean
  completed: FileConversionResult[]
  failed: FileConversionResult[]
  zipBlob?: Blob
  error?: string
}

/**
 * Sleep utility for delays
 * Skips delays in test environment for faster test execution
 */
function sleep(ms: number): Promise<void> {
  if (isVitest) {
    return Promise.resolve()
  }
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Calculate exponential backoff delay
 * Returns 0 in test environment for faster test execution
 */
function getRetryDelay(attempt: number): number {
  if (isVitest) {
    return 0
  }
  const delay = MARKER_CONFIG.BATCH.RETRY_DELAY_BASE_MS * Math.pow(2, attempt)
  return Math.min(delay, MARKER_CONFIG.BATCH.RETRY_DELAY_MAX_MS)
}

/**
 * Create error summary for failed conversions
 */
function createErrorSummary(failed: FileConversionResult[]): string {
  const errorMessages = failed
    .map(r => r.error)
    .filter((msg): msg is string => !!msg)
    .slice(0, 3) // Show first 3 errors

  return errorMessages.length > 0
    ? `All conversions failed. Errors: ${errorMessages.join('; ')}${failed.length > 3 ? ` (and ${failed.length - 3} more)` : ''}`
    : 'All conversions failed'
}

/**
 * Generate ZIP file from completed conversions
 */
async function generateZipFile(
  completed: FileConversionResult[],
  filenameMap?: Map<File, string>
): Promise<Blob> {
  // Dynamically import JSZip (client-side only library)
  // Handle both ESM and CommonJS module formats
  const JSZipModule = await import('jszip')
  const JSZip = JSZipModule.default || JSZipModule
  const zip = new JSZip()

  for (const result of completed) {
    if (result.markdown) {
      // Use custom filename from map if available, otherwise use default
      const outputFilename = filenameMap?.get(result.file) || replaceExtension(result.filename, 'md')
      zip.file(outputFilename, result.markdown)
    }
  }

  // Generate ZIP blob
  return await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  })
}

/**
 * Initialize batch progress tracking
 */
function initializeBatchProgress(files: File[]): { results: FileConversionResult[], progress: BatchProgress } {
  const results: FileConversionResult[] = files.map(file => ({
    file,
    filename: file.name,
    status: 'pending' as FileConversionStatus,
    attempts: 0
  }))

  const progress: BatchProgress = {
    total: files.length,
    completed: 0,
    failed: 0,
    cancelled: 0,
    inProgress: 0,
    results
  }

  return { results, progress }
}

/**
 * Mark files that never started (still pending after an abort) as cancelled.
 * Returns true if any file was changed.
 */
function markUnstartedAsCancelled(results: FileConversionResult[], progress: BatchProgress): boolean {
  let changed = false
  for (const result of results) {
    if (result.status === 'pending') {
      result.status = 'cancelled'
      result.error = 'Conversion cancelled'
      progress.cancelled++
      changed = true
    }
  }
  return changed
}

/**
 * Type for progress callback used by conversion functions
 */
type ProgressCallback = (status: string, attemptNumber: number, elapsedSeconds: number) => void

/**
 * Type for conversion function that can be either paid or free mode
 */
type ConversionFunction = (
  file: File,
  markerOptions: MarkerOptions,
  onProgress?: ProgressCallback,
  signal?: AbortSignal
) => Promise<{ success: boolean; markdown?: string; error?: string }>

/**
 * Whether a failed conversion is worth retrying.
 * Client errors (bad API key, invalid or too-large file) fail the same way every time,
 * so retrying them only multiplies requests and delays for every file in the batch.
 * Timeouts (408) and rate limits (429) are retried.
 */
export function isRetryableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  if (message === 'Conversion cancelled') return false
  // These fail the same way every time; in paid mode each retry is charged again
  if (
    message.includes(ENCRYPTED_PDF_ERROR) ||
    message.includes(DAMAGED_PDF_ERROR) ||
    message === NO_TEXT_FOUND_ERROR ||
    message.startsWith('Conversion timeout')
  ) {
    return false
  }
  const match = message.match(/request failed: (\d{3})/i)
  if (!match) return true
  const status = Number(match[1])
  return !(status >= 400 && status < 500) || status === 408 || status === 429
}

/**
 * Generic function to convert a single file with retry logic
 * Works for both paid mode (Marker API) and free mode (Modal)
 */
async function convertFileWithRetry(
  file: File,
  markerOptions: MarkerOptions,
  conversionFn: ConversionFunction,
  maxRetries: number,
  signal?: AbortSignal
): Promise<FileConversionResult> {
  const result: FileConversionResult = {
    file,
    filename: file.name,
    status: 'processing',
    attempts: 0,
    startTime: Date.now()
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) {
      result.status = 'cancelled'
      result.error = 'Conversion cancelled'
      break
    }

    result.attempts = attempt + 1

    try {
      // Forward abort signal to individual conversion
      const conversionResult = await conversionFn(file, markerOptions, undefined, signal)

      if (conversionResult.success && conversionResult.markdown) {
        // Clean up markdown based on page format option
        const pageFormat = markerOptions.paginate
          ? (markerOptions.pageFormat || 'separators_only')
          : 'none'

        const cleanedMarkdown = cleanupPdfMarkdown(conversionResult.markdown, pageFormat)

        result.markdown = cleanedMarkdown
        result.status = 'complete'
        result.endTime = Date.now()
        result.duration = result.endTime - (result.startTime || 0)
        return result
      } else {
        throw new Error(conversionResult.error || 'Conversion failed')
      }
    } catch (error) {
      const isLastAttempt = attempt === maxRetries || !isRetryableError(error) || !!signal?.aborted

      if (isLastAttempt) {
        result.status = 'failed'
        result.error = error instanceof Error ? error.message : 'Unknown error'
        result.endTime = Date.now()
        result.duration = result.endTime - (result.startTime || 0)
        break
      } else {
        // Wait before retrying with exponential backoff
        const delay = getRetryDelay(attempt)
        await sleep(delay)
      }
    }
  }

  return result
}

/**
 * Convert multiple PDF files to markdown in parallel with retry logic
 */
export async function convertBatchPdfToMarkdown(
  files: File[],
  options: BatchConversionOptions
): Promise<BatchConversionResult> {
  const {
    apiKey,
    markerOptions,
    maxConcurrent = MARKER_CONFIG.BATCH.MAX_CONCURRENT,
    maxRetries = MARKER_CONFIG.BATCH.MAX_RETRIES,
    onProgress,
    signal
  } = options

  // Initialize progress tracking
  const { results, progress } = initializeBatchProgress(files)

  // Update progress helper
  const updateProgress = () => {
    onProgress?.(progress)
  }

  // Create conversion function wrapper for paid mode
  const conversionFn: ConversionFunction = (file, markerOpts, onProg, sig) =>
    convertPdfToMarkdown(file, apiKey, markerOpts, onProg, sig)

  // Create file-to-index map for O(1) lookups instead of O(n) indexOf
  const fileIndexMap = new Map(files.map((file, index) => [file, index]))

  // Queue of files to process
  const queue = [...files]
  const inProgress = new Set<Promise<void>>()

  // Process files with concurrency control
  while (queue.length > 0 || inProgress.size > 0) {
    // Check if cancelled
    if (signal?.aborted) {
      break
    }

    // Start new conversions up to concurrency limit
    while (queue.length > 0 && inProgress.size < maxConcurrent) {
      const file = queue.shift()!
      const resultIndex = fileIndexMap.get(file)!

      // Mark as in progress
      results[resultIndex].status = 'processing'
      progress.inProgress++
      updateProgress()

      // Start conversion - create wrapper function to handle cleanup
      const conversionPromise = (async () => {
        try {
          const result = await convertFileWithRetry(
            file,
            markerOptions,
            conversionFn,
            maxRetries,
            signal
          )

          // Check if cancelled after conversion (even if it completed)
          if (signal?.aborted) {
            result.status = 'cancelled'
            result.error = 'Conversion cancelled'
          }

          // Update result
          results[resultIndex] = result

          // Update counters
          progress.inProgress--
          if (result.status === 'complete') {
            progress.completed++
          } else if (result.status === 'failed') {
            progress.failed++
          } else if (result.status === 'cancelled') {
            progress.cancelled++
          }

          updateProgress()
        } catch (error) {
          // Handle unexpected errors
          results[resultIndex].status = 'failed'
          results[resultIndex].error = error instanceof Error ? error.message : 'Unknown error'
          progress.inProgress--
          progress.failed++
          updateProgress()
        }
      })()

      // Add to tracking set
      inProgress.add(conversionPromise)

      // Remove from tracking when complete
      conversionPromise.finally(() => {
        inProgress.delete(conversionPromise)
      })
    }

    // Wait for at least one conversion to complete before continuing
    if (inProgress.size > 0) {
      await Promise.race(inProgress)
    }
  }

  // Wait for all remaining conversions to complete
  await Promise.all(inProgress)

  if (markUnstartedAsCancelled(results, progress)) {
    updateProgress()
  }

  // Separate completed and failed results
  const completed = results.filter(r => r.status === 'complete')
  const failed = results.filter(r => r.status === 'failed')

  // If all conversions failed, return early with detailed error info
  if (completed.length === 0) {
    return {
      success: false,
      completed: [],
      failed: results,
      error: createErrorSummary(failed)
    }
  }

  // Create ZIP file with successful conversions
  try {
    const zipBlob = await generateZipFile(completed, options.filenameMap)
    return {
      success: true,
      completed,
      failed,
      zipBlob
    }
  } catch (error) {
    return {
      success: false,
      completed,
      failed,
      error: `Failed to create ZIP: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

/**
 * Convert multiple PDF files to markdown concurrently (up to 10 at a time) (Modal free mode)
 * Uses Modal serverless GPU instead of Marker API
 * Processes files in parallel with a concurrency limit of 10, using the same function as single mode
 */
export async function convertBatchPdfToMarkdownLocal(
  files: File[],
  options: BatchConversionOptionsLocal
): Promise<BatchConversionResult> {
  const {
    geminiApiKey,
    markerOptions,
    onProgress,
    signal
  } = options

  // Initialize progress tracking
  const { results, progress } = initializeBatchProgress(files)

  // Update progress helper
  const updateProgress = () => {
    onProgress?.(progress)
  }

  // Create conversion function wrapper for Modal free mode
  const conversionFn: ConversionFunction = (file, markerOpts, onProg, sig) =>
    convertPdfToMarkdownLocal(file, geminiApiKey, markerOpts, onProg, sig)

  // Process files in parallel with concurrency limit (Modal allows up to 10 concurrent)
  const maxConcurrent = Math.max(1, options.maxConcurrent ?? 10)
  const maxRetries = options.maxRetries ?? 0
  let nextIndex = 0

  const processFile = async (index: number): Promise<void> => {
    const file = files[index]
    results[index].status = 'processing'
    progress.inProgress++
    updateProgress()

    const result = await convertFileWithRetry(
      file,
      markerOptions,
      conversionFn,
      maxRetries,
      signal
    )

    // Check if cancelled after conversion (even if it completed)
    if (signal?.aborted) {
      result.status = 'cancelled'
      result.error = 'Conversion cancelled'
    }

    results[index] = result
    progress.inProgress--

    if (result.status === 'complete') {
      progress.completed++
    } else if (result.status === 'failed') {
      progress.failed++
    } else if (result.status === 'cancelled') {
      progress.cancelled++
    }

    updateProgress()
  }

  // Each worker takes the next unclaimed file until the queue is empty,
  // so every file is converted exactly once and at most `maxConcurrent` run at a time.
  const worker = async (workerIndex: number): Promise<void> => {
    // Stagger worker start-up so cold Modal containers don't all initialize
    // their models at the same moment
    if (workerIndex > 0) {
      await sleep(workerIndex * MARKER_CONFIG.BATCH.STAGGER_DELAY_MS)
    }

    while (!signal?.aborted && nextIndex < files.length) {
      const index = nextIndex++
      await processFile(index)
    }
  }

  if (files.length > 0 && !signal?.aborted) {
    // Convert the first file alone so a cold container warms up before the rest start
    nextIndex = 1
    await processFile(0)

    const workerCount = Math.min(maxConcurrent, files.length - 1)
    await Promise.all(Array.from({ length: workerCount }, (_, i) => worker(i)))
  }

  markUnstartedAsCancelled(results, progress)
  updateProgress()

  // Separate completed and failed results
  const completed = results.filter(r => r.status === 'complete')
  const failed = results.filter(r => r.status === 'failed')

  // If all conversions failed, return early with detailed error info
  if (completed.length === 0) {
    return {
      success: false,
      completed: [],
      failed: results,
      error: createErrorSummary(failed)
    }
  }

  // Create ZIP file with successful conversions
  try {
    const zipBlob = await generateZipFile(completed, options.filenameMap)
    return {
      success: true,
      completed,
      failed,
      zipBlob
    }
  } catch (error) {
    return {
      success: false,
      completed,
      failed,
      error: `Failed to create ZIP: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

/**
 * Filter PDF files from a list of files
 */
export function filterPdfFiles(files: File[]): File[] {
  return files.filter(f =>
    f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
  )
}

/**
 * Filter files to only include those in the immediate folder (not subfolders)
 */
export function filterImmediateFolderFiles(files: File[]): File[] {
  return files.filter(file => {
    // @ts-ignore - webkitRelativePath is not in TypeScript definitions
    const relativePath = file.webkitRelativePath as string | undefined

    if (!relativePath) return true // Not from a folder, include it

    // Count slashes - if there's exactly one slash, file is in immediate folder
    // e.g., "folder/file.pdf" = 1 slash (immediate) ✓
    // e.g., "folder/subfolder/file.pdf" = 2 slashes (nested) ✗
    const slashCount = (relativePath.match(/\//g) || []).length
    return slashCount === 1
  })
}

/**
 * Get folder name from file path (webkitRelativePath)
 */
export function getFolderName(file: File): string | null {
  // @ts-ignore - webkitRelativePath is not in TypeScript definitions
  const relativePath = file.webkitRelativePath as string | undefined

  if (!relativePath) return null

  const parts = relativePath.split('/')
  return parts.length > 1 ? parts[0] : null
}
