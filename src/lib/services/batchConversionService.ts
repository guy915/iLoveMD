/**
 * Batch Conversion Service - Handles parallel PDF to Markdown conversion
 *
 * Features:
 * - Parallel processing with configurable concurrency (up to 200 per Marker API limits)
 * - Exponential backoff retry for failed conversions (3 retries: 1s, 2s, 4s, 8s, 16s, max 32s)
 * - Progress tracking with real-time updates
 * - Defensive programming for memory management
 * - Graceful degradation on errors
 * - ZIP file generation for batch results
 *
 * Marker API Limits:
 * - 200MB maximum per individual PDF file
 * - 200 concurrent API requests maximum
 */

import JSZip from 'jszip'
import { convertPdfToMarkdown } from './markerApiService'
import { replaceExtension } from '@/lib/utils/downloadUtils'
import { MARKER_CONFIG, FILE_SIZE } from '@/lib/constants'
import type { MarkerOptions } from '@/types'

/**
 * Status of an individual file conversion
 */
export type FileConversionStatus = 'pending' | 'processing' | 'complete' | 'failed'

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
  inProgress: number
  results: FileConversionResult[]
}

/**
 * Progress callback for batch conversion
 */
export type BatchProgressCallback = (progress: BatchProgress) => void

/**
 * Options for batch conversion
 */
export interface BatchConversionOptions {
  apiKey: string
  markerOptions: MarkerOptions
  maxConcurrent?: number
  maxRetries?: number
  onProgress?: BatchProgressCallback
  signal?: AbortSignal
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
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Calculate exponential backoff delay
 */
function getRetryDelay(attempt: number): number {
  const delay = MARKER_CONFIG.BATCH.RETRY_DELAY_BASE_MS * Math.pow(2, attempt)
  return Math.min(delay, MARKER_CONFIG.BATCH.RETRY_DELAY_MAX_MS)
}

/**
 * Convert a single file with retry logic
 */
async function convertFileWithRetry(
  file: File,
  apiKey: string,
  options: MarkerOptions,
  maxRetries: number,
  signal?: AbortSignal
): Promise<FileConversionResult> {
  const result: FileConversionResult = {
    file,
    filename: file.name,
    status: 'pending',
    attempts: 0,
    startTime: Date.now()
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Check if cancelled
    if (signal?.aborted) {
      result.status = 'failed'
      result.error = 'Conversion cancelled'
      result.endTime = Date.now()
      result.duration = result.endTime - (result.startTime || 0)
      return result
    }

    result.attempts = attempt + 1
    result.status = 'processing'

    try {
      // Attempt conversion
      const conversionResult = await convertPdfToMarkdown(
        file,
        apiKey,
        options,
        undefined, // No progress callback for individual files in batch
        signal
      )

      if (conversionResult.success && conversionResult.markdown) {
        result.status = 'complete'
        result.markdown = conversionResult.markdown
        result.endTime = Date.now()
        result.duration = result.endTime - (result.startTime || 0)
        return result
      } else {
        throw new Error(conversionResult.error || 'Conversion failed')
      }
    } catch (error) {
      const err = error as Error
      result.error = err.message

      // If this isn't the last attempt, wait before retrying
      if (attempt < maxRetries) {
        const delay = getRetryDelay(attempt)
        await sleep(delay)
      }
    }
  }

  // All retries exhausted
  result.status = 'failed'
  result.endTime = Date.now()
  result.duration = result.endTime - (result.startTime || 0)
  return result
}

/**
 * Convert multiple PDFs to Markdown in parallel
 *
 * @param files - Array of PDF files to convert
 * @param options - Batch conversion options
 * @returns Batch conversion result with ZIP blob
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

  // Validate inputs
  if (!files || files.length === 0) {
    return {
      success: false,
      completed: [],
      failed: [],
      error: 'No files provided'
    }
  }

  // Initialize results tracking
  const results: FileConversionResult[] = files.map(file => ({
    file,
    filename: file.name,
    status: 'pending',
    attempts: 0
  }))

  // Track progress
  const updateProgress = () => {
    if (onProgress) {
      const completed = results.filter(r => r.status === 'complete').length
      const failed = results.filter(r => r.status === 'failed').length
      const inProgress = results.filter(r => r.status === 'processing').length

      onProgress({
        total: files.length,
        completed,
        failed,
        inProgress,
        results: [...results] // Clone to avoid mutation issues
      })
    }
  }

  // Create a queue of conversion tasks
  const queue = [...files]
  const inProgress = new Set<Promise<void>>()

  // Process queue with concurrency limit
  while (queue.length > 0 || inProgress.size > 0) {
    // Check if cancelled
    if (signal?.aborted) {
      // Mark all pending as failed
      results.forEach(r => {
        if (r.status === 'pending' || r.status === 'processing') {
          r.status = 'failed'
          r.error = 'Batch conversion cancelled'
        }
      })
      break
    }

    // Start new conversions up to concurrency limit
    while (queue.length > 0 && inProgress.size < maxConcurrent) {
      const file = queue.shift()!
      const resultIndex = files.indexOf(file)

      // Create conversion promise
      const conversionPromise = (async () => {
        try {
          const result = await convertFileWithRetry(
            file,
            apiKey,
            markerOptions,
            maxRetries,
            signal
          )

          // Update result in array
          results[resultIndex] = result
          updateProgress()
        } catch (error) {
          // Defensive: catch any unexpected errors
          const err = error as Error
          results[resultIndex] = {
            file,
            filename: file.name,
            status: 'failed',
            error: err.message || 'Unexpected error',
            attempts: 0
          }
          updateProgress()
        }
      })()

      inProgress.add(conversionPromise)

      // Remove from in-progress when done
      conversionPromise.finally(() => {
        inProgress.delete(conversionPromise)
      })
    }

    // Wait for at least one to complete before starting more
    if (inProgress.size > 0) {
      await Promise.race(inProgress)
    }
  }

  // Wait for all remaining conversions to complete
  await Promise.all(inProgress)

  // Final progress update
  updateProgress()

  // Separate completed and failed
  const completed = results.filter(r => r.status === 'complete')
  const failed = results.filter(r => r.status === 'failed')

  // If no files were converted successfully, return error
  if (completed.length === 0) {
    return {
      success: false,
      completed: [],
      failed: results,
      error: 'All conversions failed'
    }
  }

  // Create ZIP file with successful conversions
  try {
    const zip = new JSZip()

    for (const result of completed) {
      if (result.markdown) {
        const outputFilename = replaceExtension(result.filename, 'md')
        zip.file(outputFilename, result.markdown)
      }
    }

    // Generate ZIP blob
    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    })

    return {
      success: true,
      completed,
      failed,
      zipBlob
    }
  } catch (error) {
    const err = error as Error
    return {
      success: false,
      completed,
      failed,
      error: `Failed to create ZIP file: ${err.message}`
    }
  }
}

/**
 * Validate files for batch conversion
 *
 * @param files - Files to validate
 * @returns Validation result with error message if invalid
 */
export function validateBatchFiles(files: File[]): { valid: boolean; error?: string } {
  if (!files || files.length === 0) {
    return { valid: false, error: 'No files selected' }
  }

  // Check file count limit
  if (files.length > FILE_SIZE.MAX_BATCH_FILES) {
    return {
      valid: false,
      error: `Too many files. Maximum is ${FILE_SIZE.MAX_BATCH_FILES} files per batch.`
    }
  }

  // Filter PDF files only
  const pdfFiles = files.filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))

  if (pdfFiles.length === 0) {
    return { valid: false, error: 'No PDF files found in selection' }
  }

  // Check individual file sizes (use single file limit: 200MB per Marker API)
  const oversizedFiles = pdfFiles.filter(f => f.size > FILE_SIZE.MAX_PDF_FILE_SIZE)
  if (oversizedFiles.length > 0) {
    const names = oversizedFiles.slice(0, 3).map(f => f.name).join(', ')
    const more = oversizedFiles.length > 3 ? ` and ${oversizedFiles.length - 3} more` : ''
    return {
      valid: false,
      error: `Some files exceed 200MB limit: ${names}${more}`
    }
  }

  // Check total size
  const totalSize = pdfFiles.reduce((sum, f) => sum + f.size, 0)
  if (totalSize > FILE_SIZE.MAX_BATCH_TOTAL_SIZE) {
    const totalGB = (totalSize / FILE_SIZE.BYTES_PER_GB).toFixed(2)
    return {
      valid: false,
      error: `Total batch size (${totalGB}GB) exceeds 100GB limit`
    }
  }

  return { valid: true }
}

/**
 * Filter PDF files from file list
 *
 * @param files - Files to filter
 * @returns Only PDF files
 */
export function filterPdfFiles(files: File[]): File[] {
  return files.filter(f =>
    f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
  )
}
