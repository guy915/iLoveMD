/**
 * Custom hook for managing PDF to Markdown conversion workflow
 * Extracts conversion business logic from components
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { useLogs } from '@/contexts/LogContext'
import { convertPdfToMarkdown, convertPdfToMarkdownLocal } from '@/lib/services/markerApiService'
import { formatBytesToMB, formatBytesToKB, replaceExtension } from '@/lib/utils/formatUtils'
import { MARKER_CONFIG } from '@/lib/constants'
import type { MarkerOptions, BatchProgress } from '@/types'

export type ConversionMode = 'paid' | 'free'

export interface UseConversionWorkflowOptions {
  /** Conversion mode (paid or free) */
  mode: ConversionMode
  /** Marker API key (required for paid mode) */
  apiKey: string
  /** Gemini API key (required for free mode with LLM) */
  geminiApiKey: string
  /** Marker conversion options */
  markerOptions: MarkerOptions
  /** Map of files to output filenames */
  filenameMap: Map<File, string>
  /** Folder name for batch downloads */
  folderName: string | null
}

export interface ConversionState {
  /** Whether conversion is in progress */
  processing: boolean
  /** Current status message */
  status: string
  /** Error message if any */
  error: string
  /** Converted markdown content (single file) */
  convertedMarkdown: string | null
  /** Output filename (single file) */
  outputFilename: string | null
  /** Batch progress information */
  batchProgress: BatchProgress | null
  /** Batch ZIP blob */
  batchZipBlob: Blob | null
  /** Batch ZIP filename */
  batchZipFilename: string | null
}

export interface UseConversionWorkflowReturn extends ConversionState {
  /** Start conversion for files */
  startConversion: (files: File[]) => Promise<void>
  /** Cancel ongoing conversion */
  cancelConversion: () => void
  /** Reset conversion state */
  resetConversion: () => void
  /** Set error message */
  setError: (error: string) => void
}

/**
 * Hook for managing PDF to Markdown conversion workflow
 *
 * @example
 * const {
 *   processing,
 *   status,
 *   error,
 *   convertedMarkdown,
 *   startConversion,
 *   cancelConversion
 * } = useConversionWorkflow({
 *   mode: 'paid',
 *   apiKey: 'key',
 *   markerOptions: {...}
 * })
 */
export function useConversionWorkflow(
  options: UseConversionWorkflowOptions
): UseConversionWorkflowReturn {
  const {
    mode,
    apiKey,
    geminiApiKey,
    markerOptions,
    filenameMap,
    folderName
  } = options

  const { addLog } = useLogs()

  // State
  const [processing, setProcessing] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [convertedMarkdown, setConvertedMarkdown] = useState<string | null>(null)
  const [outputFilename, setOutputFilename] = useState<string | null>(null)
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null)
  const [batchZipBlob, setBatchZipBlob] = useState<Blob | null>(null)
  const [batchZipFilename, setBatchZipFilename] = useState<string | null>(null)

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null)
  const isMountedRef = useRef(true)

  // Track mount status
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  /**
   * Validate conversion prerequisites
   */
  const validateConversion = useCallback((files: File[]): { valid: boolean; error?: string } => {
    // Mode-based validation
    if (mode === 'paid') {
      if (!apiKey.trim()) {
        return {
          valid: false,
          error: 'Please enter your Marker API key'
        }
      }
    } else if (mode === 'free') {
      if (markerOptions.use_llm && !geminiApiKey.trim()) {
        return {
          valid: false,
          error: 'Please enter your Gemini API key to use LLM enhancement in free mode'
        }
      }
    }

    if (files.length === 0) {
      return {
        valid: false,
        error: 'Please select PDF file(s)'
      }
    }

    return { valid: true }
  }, [mode, apiKey, geminiApiKey, markerOptions.use_llm])

  /**
   * Convert single PDF file
   */
  const convertSingleFile = useCallback(async (file: File): Promise<void> => {
    setStatus(mode === 'paid' ? 'Submitting to Marker API...' : 'Submitting to Modal...')

    const onProgress = (status: string, attemptNumber: number, elapsedSeconds: number) => {
      if (!isMountedRef.current) return
      const maxAttempts = MARKER_CONFIG.POLLING.MAX_ATTEMPTS
      setStatus(`Processing PDF... (${attemptNumber}/${maxAttempts} checks, ${elapsedSeconds.toFixed(0)}s elapsed)`)
    }

    // Call appropriate conversion function based on mode
    const result = mode === 'paid'
      ? await convertPdfToMarkdown(
          file,
          apiKey,
          markerOptions,
          onProgress,
          abortControllerRef.current!.signal
        )
      : await convertPdfToMarkdownLocal(
          file,
          markerOptions.use_llm ? geminiApiKey : null,
          markerOptions,
          onProgress,
          abortControllerRef.current!.signal
        )

    if (!result.success || !result.markdown) {
      throw new Error(result.error || 'Conversion failed')
    }

    const filename = replaceExtension(file.name, 'md')

    addLog('success', 'Conversion complete!', {
      contentSize: formatBytesToKB(result.markdown.length),
      filename,
      mode
    })

    if (isMountedRef.current) {
      setConvertedMarkdown(result.markdown)
      setOutputFilename(filename)
      setStatus('Conversion complete! Click Download to save the file.')
      setProcessing(false)
    }
  }, [mode, apiKey, geminiApiKey, markerOptions, addLog])

  /**
   * Convert batch of PDF files
   */
  const convertBatchFiles = useCallback(async (files: File[]): Promise<void> => {
    setStatus('Processing batch...')

    const onProgress = (progress: BatchProgress) => {
      if (isMountedRef.current) {
        setBatchProgress(progress)
        const statusMsg = mode === 'free'
          ? `Processing... ${progress.completed}/${progress.total} complete (${progress.inProgress} in progress)`
          : `Processing... ${progress.completed}/${progress.total} complete`
        setStatus(statusMsg)
      }
    }

    // Dynamically import batch conversion service
    const { convertBatchPdfToMarkdown, convertBatchPdfToMarkdownLocal } =
      await import('@/lib/services/batchConversionService')

    const result = mode === 'free'
      ? await convertBatchPdfToMarkdownLocal(files, {
          geminiApiKey: markerOptions.use_llm ? geminiApiKey : null,
          markerOptions,
          filenameMap,
          onProgress,
          signal: abortControllerRef.current!.signal
        })
      : await convertBatchPdfToMarkdown(files, {
          apiKey,
          markerOptions,
          filenameMap,
          onProgress,
          signal: abortControllerRef.current!.signal
        })

    if (!result.success || !result.zipBlob) {
      const errorMsg = result.error || 'Batch conversion failed'
      const failedCount = result.failed?.length || 0
      const totalCount = files.length

      if (failedCount > 0 && failedCount < totalCount) {
        throw new Error(`${errorMsg}. ${result.completed?.length || 0}/${totalCount} files converted successfully.`)
      } else {
        throw new Error(errorMsg)
      }
    }

    const zipName = folderName
      ? `${folderName}_markdown.zip`
      : `converted_markdowns_${new Date().toISOString().replace(/:/g, '-').split('.')[0]}.zip`

    addLog('success', 'Batch conversion complete!', {
      completed: result.completed.length,
      failed: result.failed.length,
      zipName
    })

    if (isMountedRef.current) {
      setBatchZipBlob(result.zipBlob)
      setBatchZipFilename(zipName)
      setStatus(`Conversion complete! ${result.completed.length}/${files.length} files converted. Click Download.`)
      setProcessing(false)
    }
  }, [mode, apiKey, geminiApiKey, markerOptions, filenameMap, folderName, addLog])

  /**
   * Start conversion for provided files
   */
  const startConversion = useCallback(async (files: File[]): Promise<void> => {
    // Validate
    const validation = validateConversion(files)
    if (!validation.valid) {
      setError(validation.error || 'Validation failed')
      addLog('error', `Conversion blocked: ${validation.error}`)
      return
    }

    const isBatch = files.length > 1

    setProcessing(true)
    setError('')
    setBatchProgress(null)
    setBatchZipBlob(null)
    setBatchZipFilename(null)

    addLog('info', 'Starting conversion', {
      fileCount: files.length,
      isBatch,
      totalSize: formatBytesToMB(files.reduce((sum, f) => sum + f.size, 0)),
      options: markerOptions
    })

    try {
      abortControllerRef.current = new AbortController()

      if (isBatch) {
        await convertBatchFiles(files)
      } else {
        await convertSingleFile(files[0])
      }

    } catch (err) {
      const error = err as Error
      addLog('error', `Conversion failed: ${error.message}`)

      if (isMountedRef.current) {
        setError(error.message || 'An error occurred during conversion')
        setProcessing(false)
        setStatus('')
      }
    } finally {
      abortControllerRef.current = null
    }
  }, [validateConversion, convertSingleFile, convertBatchFiles, markerOptions, addLog])

  /**
   * Cancel ongoing conversion
   */
  const cancelConversion = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
      setProcessing(false)
      setStatus('')
      addLog('info', 'Conversion cancelled by user')
    }
  }, [addLog])

  /**
   * Reset conversion state
   */
  const resetConversion = useCallback(() => {
    setProcessing(false)
    setStatus('')
    setError('')
    setConvertedMarkdown(null)
    setOutputFilename(null)
    setBatchProgress(null)
    setBatchZipBlob(null)
    setBatchZipFilename(null)
  }, [])

  return {
    processing,
    status,
    error,
    convertedMarkdown,
    outputFilename,
    batchProgress,
    batchZipBlob,
    batchZipFilename,
    startConversion,
    cancelConversion,
    resetConversion,
    setError
  }
}
