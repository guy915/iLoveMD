/**
 * Batch Conversion Service - Handles parallel PDF to Markdown conversion
 *
 * Features:
 * - Parallel processing with configurable concurrency (up to 200)
 * - Exponential backoff retry for failed conversions (3 retries with delays: 1s, 2s, 4s)
 * - Progress tracking with real-time updates
 * - Defensive programming for memory management
 * - Graceful degradation on errors
 * - ZIP file generation for batch results
 * - Support for both paid (Marker API) and free (Modal GPU) modes
 *
 * Limits:
 * - 200MB maximum per individual PDF file
 * - 200 concurrent API requests maximum
 * - 10,000 files maximum per batch
 * - 100GB total batch size maximum
 */

import { convertPdfToMarkdown, convertPdfToMarkdownLocal } from './markerApiService'
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
  mode: 'free' | 'paid'
  apiKey: string // Marker API key for paid mode
  geminiApiKey?: string | null // Gemini API key for free mode (when use_llm is enabled)
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
  mode: 'free' | 'paid',
  apiKey: string,
  geminiApiKey: string | null | undefined,
  markerOptions: MarkerOptions,
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
      result.status = 'failed'
      result.error = 'Conversion cancelled'
      break
    }

    result.attempts = attempt + 1

    try {
      // Forward abort signal to individual conversion
      // Call appropriate conversion function based on mode
      const conversionResult = mode === 'paid'
        ? await convertPdfToMarkdown(file, apiKey, markerOptions, undefined, signal)
        : await convertPdfToMarkdownLocal(file, geminiApiKey || null, markerOptions, undefined, signal)

      if (conversionResult.success && conversionResult.markdown) {
        result.markdown = conversionResult.markdown
        result.status = 'complete'
        result.endTime = Date.now()
        result.duration = result.endTime - (result.startTime || 0)
        return result
      } else {
        throw new Error(conversionResult.error || 'Conversion failed')
      }
    } catch (error) {
      const isLastAttempt = attempt === maxRetries

      if (isLastAttempt) {
        result.status = 'failed'
        result.error = error instanceof Error ? error.message : 'Unknown error'
        result.endTime = Date.now()
        result.duration = result.endTime - (result.startTime || 0)
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
    mode,
    apiKey,
    geminiApiKey,
    markerOptions,
    maxConcurrent = MARKER_CONFIG.BATCH.MAX_CONCURRENT,
    maxRetries = MARKER_CONFIG.BATCH.MAX_RETRIES,
    onProgress,
    signal
  } = options

  // Initialize results array
  const results: FileConversionResult[] = files.map(file => ({
    file,
    filename: file.name,
    status: 'pending' as FileConversionStatus,
    attempts: 0
  }))

  // Track progress
  const progress: BatchProgress = {
    total: files.length,
    completed: 0,
    failed: 0,
    inProgress: 0,
    results
  }

  // Update progress helper
  const updateProgress = () => {
    onProgress?.(progress)
  }

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
            mode,
            apiKey,
            geminiApiKey,
            markerOptions,
            maxRetries,
            signal
          )

          // Update result
          results[resultIndex] = result

          // Update counters
          progress.inProgress--
          if (result.status === 'complete') {
            progress.completed++
          } else if (result.status === 'failed') {
            progress.failed++
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

  // Separate completed and failed results
  const completed = results.filter(r => r.status === 'complete')
  const failed = results.filter(r => r.status === 'failed')

  // If all conversions failed, return early
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
    // Dynamically import JSZip (client-side only library)
    // Handle both ESM and CommonJS module formats
    const JSZipModule = await import('jszip')
    const JSZip = JSZipModule.default || JSZipModule
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

/**
 * Validate batch files
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

  // Check total batch size
  const totalSize = pdfFiles.reduce((sum, f) => sum + f.size, 0)
  if (totalSize > FILE_SIZE.MAX_BATCH_TOTAL_SIZE) {
    const totalGB = (totalSize / FILE_SIZE.BYTES_PER_GB).toFixed(2)
    const maxGB = FILE_SIZE.MAX_BATCH_TOTAL_SIZE / FILE_SIZE.BYTES_PER_GB
    return {
      valid: false,
      error: `Total batch size (${totalGB}GB) exceeds maximum of ${maxGB}GB`
    }
  }

  return { valid: true }
}
