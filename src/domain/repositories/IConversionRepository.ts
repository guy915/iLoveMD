/**
 * Repository interface for PDF to Markdown conversion
 *
 * This interface defines the contract for conversion operations,
 * abstracting away the implementation details (Marker API, Modal, etc.)
 *
 * Benefits:
 * - Decouples domain logic from external APIs
 * - Makes testing easier (can mock the repository)
 * - Allows swapping implementations without changing business logic
 * - Follows Dependency Inversion Principle
 */

import type { MarkerOptions, ConversionResult } from '@/types'

/**
 * Progress callback for tracking conversion status
 */
export type ProgressCallback = (
  status: string,
  attemptNumber: number,
  elapsedSeconds: number
) => void

/**
 * Conversion mode (paid or free)
 */
export type ConversionMode = 'paid' | 'free'

/**
 * Repository interface for converting PDFs to Markdown
 */
export interface IConversionRepository {
  /**
   * Convert a PDF file to Markdown with automatic polling
   *
   * This is the high-level method that handles the entire workflow:
   * 1. Submit the file
   * 2. Poll for completion
   * 3. Return the markdown result
   *
   * @param file - The PDF file to convert
   * @param apiKey - API key for the conversion service
   * @param options - Conversion options
   * @param mode - Conversion mode (paid or free)
   * @param onProgress - Optional callback for progress updates
   * @param signal - Optional AbortSignal for cancellation
   * @returns Conversion result with markdown or error
   */
  convert(
    file: File,
    apiKey: string,
    options: MarkerOptions,
    mode: ConversionMode,
    onProgress?: ProgressCallback,
    signal?: AbortSignal
  ): Promise<ConversionResult>

  /**
   * Convert multiple PDF files in batch with concurrency control
   *
   * @param files - Array of PDF files to convert
   * @param apiKey - API key for the conversion service
   * @param options - Conversion options
   * @param mode - Conversion mode (paid or free)
   * @param onProgress - Callback for batch progress updates
   * @param signal - Optional AbortSignal for cancellation
   * @returns Map of filenames to conversion results
   */
  convertBatch(
    files: File[],
    apiKey: string,
    options: MarkerOptions,
    mode: ConversionMode,
    onProgress?: (progress: BatchProgressData) => void,
    signal?: AbortSignal
  ): Promise<Map<string, ConversionResult>>
}

/**
 * Batch conversion progress data
 */
export interface BatchProgressData {
  total: number
  completed: number
  failed: number
  inProgress: number
  currentFile?: string
}
