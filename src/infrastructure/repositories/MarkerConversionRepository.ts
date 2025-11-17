/**
 * MarkerConversionRepository
 *
 * Concrete implementation of IConversionRepository that uses
 * the existing markerApiService and batchConversionService.
 *
 * This wraps our existing services in a repository interface,
 * providing Clean Architecture benefits while reusing proven code.
 */

import type {
  IConversionRepository,
  ProgressCallback,
  ConversionMode,
  BatchProgressData,
} from '@/domain/repositories'
import type { MarkerOptions, ConversionResult } from '@/types'
import {
  convertPdfToMarkdown,
  convertPdfToMarkdownLocal,
} from '@/lib/services/markerApiService'
import {
  convertBatchPdfToMarkdown,
  convertBatchPdfToMarkdownLocal,
  type BatchProgress,
} from '@/lib/services/batchConversionService'

/**
 * Repository implementation for PDF to Markdown conversion
 */
export class MarkerConversionRepository implements IConversionRepository {
  /**
   * Convert a single PDF file to Markdown
   */
  async convert(
    file: File,
    apiKey: string,
    options: MarkerOptions,
    mode: ConversionMode,
    onProgress?: ProgressCallback,
    signal?: AbortSignal
  ): Promise<ConversionResult> {
    if (mode === 'paid') {
      return convertPdfToMarkdown(file, apiKey, options, onProgress, signal)
    } else {
      return convertPdfToMarkdownLocal(file, apiKey, options, onProgress, signal)
    }
  }

  /**
   * Convert multiple PDF files in batch
   */
  async convertBatch(
    files: File[],
    apiKey: string,
    options: MarkerOptions,
    mode: ConversionMode,
    onProgress?: (progress: BatchProgressData) => void,
    signal?: AbortSignal
  ): Promise<Map<string, ConversionResult>> {
    // Adapt batch progress callback format
    const adaptedCallback = onProgress
      ? (batchProgress: BatchProgress) => {
          const lastResult = batchProgress.results[batchProgress.results.length - 1]
          onProgress({
            total: batchProgress.total,
            completed: batchProgress.completed,
            failed: batchProgress.failed,
            inProgress: batchProgress.inProgress,
            currentFile: lastResult?.filename,
          })
        }
      : undefined

    let batchResult
    if (mode === 'paid') {
      batchResult = await convertBatchPdfToMarkdown(files, {
        apiKey,
        markerOptions: options,
        onProgress: adaptedCallback,
        signal,
      })
    } else {
      batchResult = await convertBatchPdfToMarkdownLocal(files, {
        geminiApiKey: apiKey,
        markerOptions: options,
        onProgress: adaptedCallback,
        signal,
      })
    }

    // Convert BatchConversionResult to Map<string, ConversionResult>
    // BatchConversionResult has 'completed' and 'failed' arrays
    const resultMap = new Map<string, ConversionResult>()

    // Add successful conversions
    for (const fileResult of batchResult.completed) {
      resultMap.set(fileResult.filename, {
        success: true,
        markdown: fileResult.markdown,
      })
    }

    // Add failed conversions
    for (const fileResult of batchResult.failed) {
      resultMap.set(fileResult.filename, {
        success: false,
        error: fileResult.error,
      })
    }

    return resultMap
  }
}
