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
  SubmitResponse,
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
   * Submit is not directly exposed in the current implementation.
   * The convert() method handles submit + poll internally.
   */
  async submit(
    file: File,
    apiKey: string,
    options: MarkerOptions,
    mode: ConversionMode
  ): Promise<SubmitResponse> {
    throw new Error(
      'Direct submit() not implemented. Use convert() which handles submit + poll automatically.'
    )
  }

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
          onProgress({
            total: batchProgress.total,
            completed: batchProgress.completed,
            failed: batchProgress.failed,
            inProgress: batchProgress.total - batchProgress.completed - batchProgress.failed,
            currentFile: batchProgress.results[batchProgress.results.length - 1]?.fileName,
          })
        }
      : undefined

    let batchResult
    if (mode === 'paid') {
      batchResult = await convertBatchPdfToMarkdown(
        files,
        apiKey,
        options,
        adaptedCallback,
        signal
      )
    } else {
      batchResult = await convertBatchPdfToMarkdownLocal(
        files,
        apiKey,
        options,
        adaptedCallback,
        signal
      )
    }

    // Convert BatchConversionResult to Map<string, ConversionResult>
    const resultMap = new Map<string, ConversionResult>()
    for (const fileResult of batchResult.results) {
      resultMap.set(fileResult.fileName, {
        success: fileResult.success,
        markdown: fileResult.markdown,
        error: fileResult.error,
      })
    }

    return resultMap
  }
}
