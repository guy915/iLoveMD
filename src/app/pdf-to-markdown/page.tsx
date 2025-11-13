'use client'

import { useState, useEffect, useRef, useCallback, ChangeEvent } from 'react'
import FileUpload from '@/components/common/FileUpload'
import Button from '@/components/common/Button'
import { downloadFile, replaceExtension } from '@/lib/utils/downloadUtils'
import { formatBytesToMB, formatBytesToKB, formatDuration } from '@/lib/utils/formatUtils'
import type { MarkerOptions } from '@/types'
import { MARKER_CONFIG, STORAGE_KEYS, FILE_SIZE } from '@/lib/constants'
import * as storageService from '@/lib/services/storageService'
import { convertPdfToMarkdown } from '@/lib/services/markerApiService'
import { useLogs } from '@/contexts/LogContext'

// Lazy-load batch conversion types
type BatchProgress = {
  total: number
  completed: number
  failed: number
  inProgress: number
  results: Array<{
    file: File
    filename: string
    status: 'pending' | 'processing' | 'complete' | 'failed'
    markdown?: string
    error?: string
    attempts: number
    startTime?: number
    endTime?: number
    duration?: number
  }>
}

export default function PdfToMarkdownPage() {
  // API key - defaults to test key, not persisted across sessions
  const [apiKey, setApiKey] = useState('w4IU5bCYNudH_JZ0IKCUIZAo8ive3gc6ZPk6mzLtqxQ')

  // File state (works for both single and multiple)
  const [files, setFiles] = useState<File[]>([])
  const [processing, setProcessing] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  // Single file results
  const [convertedMarkdown, setConvertedMarkdown] = useState<string | null>(null)
  const [outputFilename, setOutputFilename] = useState<string | null>(null)

  // Batch results
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null)
  const [batchZipBlob, setBatchZipBlob] = useState<Blob | null>(null)
  const [batchZipFilename, setBatchZipFilename] = useState<string | null>(null)

  // Options with localStorage persistence
  const [options, setOptions] = useState<MarkerOptions>(MARKER_CONFIG.DEFAULT_OPTIONS)
  const [hasLoadedOptions, setHasLoadedOptions] = useState(false)

  // Use global logging context
  const { addLog } = useLogs()

  // Refs for cleanup and memory leak prevention
  const isMountedRef = useRef(true)
  const abortControllerRef = useRef<AbortController | null>(null)
  const statusTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const prevOptionsRef = useRef<MarkerOptions>(options)

  // Determine if batch mode based on number of files
  const isBatch = files.length > 1

  // Cleanup on unmount to prevent memory leaks
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current)
        statusTimeoutRef.current = null
      }
    }
  }, [])

  // Load options from localStorage on mount
  useEffect(() => {
    const savedOptions = storageService.getJSON<Partial<MarkerOptions>>(STORAGE_KEYS.MARKER_OPTIONS)
    if (savedOptions) {
      const mergedOptions = { ...MARKER_CONFIG.DEFAULT_OPTIONS, ...savedOptions }
      setOptions(mergedOptions)
      addLog('info', 'Loaded saved options from localStorage', { options: mergedOptions })
    }
    setHasLoadedOptions(true)
  }, [addLog])

  // Save options to localStorage whenever they change
  useEffect(() => {
    if (hasLoadedOptions) {
      storageService.setJSON(STORAGE_KEYS.MARKER_OPTIONS, options)
    }
  }, [options, hasLoadedOptions])

  // Log option changes
  useEffect(() => {
    if (!hasLoadedOptions) return

    const prev = prevOptionsRef.current
    const current = options

    for (const key in current) {
      const typedKey = key as keyof MarkerOptions
      if (prev[typedKey] !== current[typedKey]) {
        addLog('info', `Option changed: ${key}`, {
          newValue: current[typedKey],
          allOptions: current
        })
        break
      }
    }

    prevOptionsRef.current = options
  }, [options, hasLoadedOptions, addLog])

  const handleOptionChange = useCallback((key: keyof MarkerOptions, value: boolean | string) => {
    setOptions(prev => ({ ...prev, [key]: value }))
  }, [])

  // Log component mount
  useEffect(() => {
    addLog('info', 'PDF to Markdown page loaded', {
      apiKeyPresent: apiKey.length > 0,
      apiKeyLength: apiKey.length
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addLog])

  // Handle file selection (single or multiple)
  const handleFileSelect = useCallback((file: File) => {
    setFiles([file])
    setError('')
    setConvertedMarkdown(null)
    setOutputFilename(null)
    setBatchProgress(null)
    setBatchZipBlob(null)
    setBatchZipFilename(null)
  }, [])

  const handleFilesSelect = useCallback((selectedFiles: File[], append: boolean = false) => {
    // Filter PDF files only
    const pdfFiles = selectedFiles.filter(f =>
      f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    )

    if (pdfFiles.length === 0) {
      setError('No PDF files found in selection')
      addLog('error', 'No PDF files in selection')
      return
    }

    addLog('info', `Selected ${pdfFiles.length} PDF files`, {
      totalFiles: selectedFiles.length,
      pdfFiles: pdfFiles.length,
      otherFiles: selectedFiles.length - pdfFiles.length,
      append
    })

    if (append) {
      // Append to existing files, avoiding duplicates by name
      setFiles(prevFiles => {
        const existingNames = new Set(prevFiles.map(f => f.name))
        const newFiles = pdfFiles.filter(f => !existingNames.has(f.name))
        const combined = [...prevFiles, ...newFiles]
        addLog('info', `Added ${newFiles.length} new files, total now ${combined.length}`)
        return combined
      })
    } else {
      // Replace existing files
      setFiles(pdfFiles)
      setError('')
      setConvertedMarkdown(null)
      setOutputFilename(null)
      setBatchProgress(null)
      setBatchZipBlob(null)
      setBatchZipFilename(null)
    }
  }, [addLog])

  const handleClearFiles = useCallback(() => {
    setFiles([])
    setError('')
    setConvertedMarkdown(null)
    setOutputFilename(null)
    setBatchProgress(null)
    setBatchZipBlob(null)
    setBatchZipFilename(null)
    addLog('info', 'File selection cleared')
  }, [addLog])

  // Single file conversion
  const handleConvertSingle = useCallback(async () => {
    if (!apiKey.trim()) {
      const errorMsg = 'Please enter your API key'
      setError(errorMsg)
      addLog('error', 'Conversion blocked: No API key provided')
      return
    }

    if (files.length === 0) {
      const errorMsg = 'Please select a PDF file'
      setError(errorMsg)
      addLog('error', 'Conversion blocked: No file selected')
      return
    }

    const file = files[0]
    const conversionStartTime = Date.now()
    setProcessing(true)
    setError('')
    setStatus('Processing...')

    addLog('info', `Starting PDF conversion`, {
      fileName: file.name,
      fileSize: formatBytesToMB(file.size),
      fileType: file.type,
      timestamp: new Date().toISOString(),
      options: options
    })

    try {
      abortControllerRef.current = new AbortController()

      const onProgress = (status: string, attemptNumber: number, elapsedSeconds: number) => {
        if (!isMountedRef.current) return

        const maxAttempts = MARKER_CONFIG.POLLING.MAX_ATTEMPTS
        setStatus(`Processing... (${attemptNumber}/${maxAttempts} checks, ${elapsedSeconds.toFixed(0)}s elapsed)`)

        addLog('info', `Poll attempt ${attemptNumber}/${maxAttempts}`, {
          status: status,
          attemptNumber: attemptNumber,
          elapsedTime: `${elapsedSeconds.toFixed(1)}s`
        })
      }

      const result = await convertPdfToMarkdown(
        file,
        apiKey,
        options,
        onProgress,
        abortControllerRef.current.signal
      )

      const totalConversionTime = Date.now() - conversionStartTime

      if (!result.success || !result.markdown) {
        addLog('error', 'Conversion failed', {
          error: result.error,
          duration: formatDuration(totalConversionTime)
        })
        throw new Error(result.error || 'Conversion failed')
      }

      const filename = replaceExtension(file.name, 'md')

      addLog('success', `Conversion complete! (${formatDuration(totalConversionTime)} total)`, {
        totalDuration: formatDuration(totalConversionTime),
        contentLength: `${result.markdown.length} characters`,
        contentSizeKB: formatBytesToKB(result.markdown.length),
        outputFile: filename
      })

      if (isMountedRef.current) {
        setConvertedMarkdown(result.markdown)
        setOutputFilename(filename)
        setStatus('Conversion complete! Click Download to save the file.')
        setProcessing(false)
      }

    } catch (err) {
      const totalDuration = Date.now() - conversionStartTime
      const error = err as Error

      addLog('error', `Conversion failed: ${error.message}`, {
        error: error.message,
        errorType: error.name,
        duration: formatDuration(totalDuration),
        stack: error.stack?.split('\n').slice(0, 3).join('\n')
      })

      if (isMountedRef.current) {
        setError(error.message || 'An error occurred during conversion')
        setProcessing(false)
        setStatus('')
      }
    } finally {
      abortControllerRef.current = null
    }
  }, [apiKey, files, options, addLog])

  // Batch conversion
  const handleConvertBatch = useCallback(async () => {
    if (!apiKey.trim()) {
      setError('Please enter your API key')
      addLog('error', 'Batch conversion blocked: No API key provided')
      return
    }

    if (files.length === 0) {
      setError('Please select PDF files to convert')
      addLog('error', 'Batch conversion blocked: No files selected')
      return
    }

    // Validate batch - inline to avoid importing batch service
    if (files.length > FILE_SIZE.MAX_BATCH_FILES) {
      setError(`Too many files. Maximum is ${FILE_SIZE.MAX_BATCH_FILES} files per batch.`)
      addLog('error', 'Batch validation failed: Too many files')
      return
    }

    const oversizedFiles = files.filter(f => f.size > FILE_SIZE.MAX_PDF_FILE_SIZE)
    if (oversizedFiles.length > 0) {
      const names = oversizedFiles.slice(0, 3).map(f => f.name).join(', ')
      const more = oversizedFiles.length > 3 ? ` and ${oversizedFiles.length - 3} more` : ''
      setError(`Some files exceed 200MB limit: ${names}${more}`)
      addLog('error', 'Batch validation failed: Files too large')
      return
    }

    const startTime = Date.now()
    setProcessing(true)
    setError('')
    setStatus('Processing...')
    setBatchZipBlob(null)
    setBatchZipFilename(null)

    addLog('info', `Starting batch conversion`, {
      fileCount: files.length,
      totalSize: formatBytesToMB(files.reduce((sum, f) => sum + f.size, 0)),
      options: options
    })

    try {
      abortControllerRef.current = new AbortController()

      // Dynamically import batch service (includes jszip)
      const { convertBatchPdfToMarkdown } = await import('@/lib/services/batchConversionService')

      const result = await convertBatchPdfToMarkdown(files, {
        apiKey,
        markerOptions: options,
        onProgress: (progress) => {
          if (isMountedRef.current) {
            setBatchProgress(progress)
            setStatus(`Processing... ${progress.completed}/${progress.total} complete${progress.inProgress > 0 ? ` • ${progress.inProgress} in progress` : ''}${progress.failed > 0 ? ` • ${progress.failed} failed` : ''}`)
          }
        },
        signal: abortControllerRef.current.signal
      })

      const totalDuration = Date.now() - startTime

      if (!result.success) {
        addLog('error', 'Batch conversion failed', {
          error: result.error,
          duration: formatDuration(totalDuration),
          completed: result.completed.length,
          failed: result.failed.length
        })
        throw new Error(result.error || 'Batch conversion failed')
      }

      // Generate ZIP filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const zipFilename = `converted_markdown_${timestamp}.zip`

      addLog('success', `Batch conversion complete!`, {
        duration: formatDuration(totalDuration),
        completed: result.completed.length,
        failed: result.failed.length,
        zipFilename
      })

      if (isMountedRef.current) {
        setBatchZipBlob(result.zipBlob || null)
        setBatchZipFilename(zipFilename)
        setProcessing(false)

        if (result.failed.length > 0) {
          const failedNames = result.failed.slice(0, 3).map(f => f.filename).join(', ')
          const more = result.failed.length > 3 ? ` and ${result.failed.length - 3} more` : ''
          setStatus(`Conversion complete! ${result.completed.length} succeeded, ${result.failed.length} failed (${failedNames}${more})`)
        } else {
          setStatus(`All ${result.completed.length} files converted successfully! Click Download to save the ZIP.`)
        }
      }

    } catch (err) {
      const error = err as Error
      const totalDuration = Date.now() - startTime

      addLog('error', `Batch conversion failed: ${error.message}`, {
        error: error.message,
        duration: formatDuration(totalDuration)
      })

      if (isMountedRef.current) {
        setError(error.message || 'An error occurred during batch conversion')
        setProcessing(false)
        setStatus('')
      }
    } finally {
      abortControllerRef.current = null
    }
  }, [apiKey, files, options, addLog])

  const handleConvert = useCallback(async () => {
    if (isBatch) {
      await handleConvertBatch()
    } else {
      await handleConvertSingle()
    }
  }, [isBatch, handleConvertBatch, handleConvertSingle])

  const handleDownloadSingle = useCallback(async () => {
    if (!convertedMarkdown || !outputFilename) return

    try {
      addLog('info', 'Download button clicked', {
        filename: outputFilename,
        contentSize: formatBytesToKB(convertedMarkdown.length)
      })

      if ('showSaveFilePicker' in window) {
        try {
          addLog('info', 'Using File System Access API for save dialog')

          const handle = await (window as any).showSaveFilePicker({
            suggestedName: outputFilename,
            types: [{
              description: 'Markdown files',
              accept: { 'text/markdown': ['.md'] }
            }]
          })

          const writable = await handle.createWritable()
          await writable.write(convertedMarkdown)
          await writable.close()

          addLog('success', 'File saved successfully', { filename: outputFilename })
          setStatus('File saved successfully!')

        } catch (apiError: any) {
          if (apiError.name === 'AbortError') {
            addLog('info', 'User cancelled save dialog')
            return
          }
          throw apiError
        }
      } else {
        addLog('info', 'Using traditional download method')
        downloadFile(convertedMarkdown, outputFilename, 'text/markdown')
        addLog('success', 'File download triggered', { filename: outputFilename })
        setStatus('File download started!')
      }

    } catch (err) {
      const error = err as Error
      addLog('error', `Download failed: ${error.message}`, {
        error: error.message,
        filename: outputFilename
      })
      setError(`Failed to download file: ${error.message}`)
    }
  }, [convertedMarkdown, outputFilename, addLog])

  const handleDownloadBatch = useCallback(async () => {
    if (!batchZipBlob || !batchZipFilename) return

    try {
      addLog('info', 'Download ZIP button clicked', {
        filename: batchZipFilename,
        size: formatBytesToMB(batchZipBlob.size)
      })

      if ('showSaveFilePicker' in window) {
        try {
          addLog('info', 'Using File System Access API for ZIP')

          const handle = await (window as any).showSaveFilePicker({
            suggestedName: batchZipFilename,
            types: [{
              description: 'ZIP files',
              accept: { 'application/zip': ['.zip'] }
            }]
          })

          const writable = await handle.createWritable()
          await writable.write(batchZipBlob)
          await writable.close()

          addLog('success', 'ZIP saved successfully', { filename: batchZipFilename })
          setStatus('ZIP saved successfully!')

        } catch (apiError: any) {
          if (apiError.name === 'AbortError') {
            addLog('info', 'User cancelled save dialog')
            return
          }
          throw apiError
        }
      } else {
        addLog('info', 'Using traditional download for ZIP')
        downloadFile(batchZipBlob, batchZipFilename, 'application/zip')
        addLog('success', 'ZIP download triggered', { filename: batchZipFilename })
        setStatus('ZIP download started!')
      }

    } catch (err) {
      const error = err as Error
      addLog('error', `ZIP download failed: ${error.message}`, {
        error: error.message,
        filename: batchZipFilename
      })
      setError(`Failed to download ZIP: ${error.message}`)
    }
  }, [batchZipBlob, batchZipFilename, addLog])

  const handleDownload = useCallback(async () => {
    if (isBatch) {
      await handleDownloadBatch()
    } else {
      await handleDownloadSingle()
    }
  }, [isBatch, handleDownloadBatch, handleDownloadSingle])

  const hasResult = convertedMarkdown || batchZipBlob

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          PDF to Markdown
        </h1>
        <p className="text-lg text-gray-600">
          Convert PDF files to Markdown format using the Marker API
        </p>
      </div>

      {/* API Key Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <label htmlFor="api-key-input" className="block text-sm font-medium text-gray-700 mb-2">
          Marker API Key
        </label>
        <input
          id="api-key-input"
          type="password"
          value={apiKey}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setApiKey(e.target.value)}
          placeholder="Enter your API key"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={processing}
          aria-label="Marker API Key"
        />
        <p className="mt-2 text-sm text-gray-500">
          Don&apos;t have an API key?{' '}
          <a
            href={MARKER_CONFIG.SIGN_UP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-700 underline"
          >
            Get one here
          </a>
          {' '}(Free credits available for testing)
        </p>
      </div>

      {/* File Upload Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <p className="text-lg mb-4 font-medium text-gray-700">Select PDF files or folder</p>

          <div className="flex gap-3 justify-center flex-wrap">
            {/* Select Files Button */}
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".pdf,application/pdf"
                multiple
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    addLog('info', `${e.target.files.length} file(s) selected via file browser`)
                    const selectedFiles = Array.from(e.target.files)
                    const append = files.length > 0
                    if (selectedFiles.length === 1 && !append) {
                      handleFileSelect(selectedFiles[0])
                    } else {
                      handleFilesSelect(selectedFiles, append)
                    }
                    e.target.value = ''
                  }
                }}
                className="hidden"
              />
              <span className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                {files.length > 0 ? 'Add More Files' : 'Select PDF File(s)'}
              </span>
            </label>

            {/* Select Folder Button */}
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".pdf,application/pdf"
                multiple
                // @ts-ignore - webkitdirectory is not in TypeScript definitions
                webkitdirectory="true"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    addLog('info', `Folder selected with ${e.target.files.length} file(s)`)
                    const append = files.length > 0
                    handleFilesSelect(Array.from(e.target.files), append)
                    e.target.value = ''
                  }
                }}
                className="hidden"
              />
              <span className="inline-block px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium">
                {files.length > 0 ? 'Add Folder' : 'Select Folder'}
              </span>
            </label>

            {/* Clear Button */}
            {files.length > 0 && (
              <button
                onClick={handleClearFiles}
                className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium"
              >
                Clear All
              </button>
            )}
          </div>

          {files.length > 0 && (
            <p className="text-sm text-blue-600 font-medium mt-4">
              {files.length === 1 ? `Selected: ${files[0].name}` : `Selected: ${files.length} PDF files`}
            </p>
          )}

          <p className="text-sm text-gray-500 mt-4">
            Supported: PDF files, up to 200MB per file
            {files.length > 0 && <span className="block mt-1">Click buttons again to add more files or folders</span>}
          </p>
        </div>
      </div>

      {/* Batch Progress - File List Only (No Progress Bar) */}
      {isBatch && batchProgress && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-blue-600 animate-spin text-2xl">⟳</span>
            <h2 className="text-lg font-semibold text-gray-900">
              Converting {batchProgress.completed}/{batchProgress.total} files
            </h2>
          </div>

          {/* File List */}
          <div className="max-h-64 overflow-y-auto space-y-2">
            {batchProgress.results.map((result, index) => (
              <div
                key={index}
                className="flex items-center justify-between text-sm p-2 rounded bg-gray-50"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {result.status === 'complete' && (
                    <span className="text-green-600">✓</span>
                  )}
                  {result.status === 'processing' && (
                    <span className="text-blue-600 animate-spin">⟳</span>
                  )}
                  {result.status === 'failed' && (
                    <span className="text-red-600">✗</span>
                  )}
                  {result.status === 'pending' && (
                    <span className="text-gray-400">○</span>
                  )}
                  <span className="truncate text-gray-700">{result.filename}</span>
                </div>
                <div className="text-xs text-gray-500 ml-2 flex-shrink-0">
                  {result.status === 'complete' && result.duration && (
                    <span>{formatDuration(result.duration)}</span>
                  )}
                  {result.status === 'failed' && result.error && (
                    <span className="text-red-600">{result.error}</span>
                  )}
                  {result.status === 'processing' && (
                    <span>processing...</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Options Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Conversion Options</h2>

        <div className="space-y-3">
          <label className="flex items-start">
            <input
              type="checkbox"
              checked={options.paginate}
              onChange={(e) => handleOptionChange('paginate', e.target.checked)}
              className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              disabled={processing}
            />
            <span className="ml-3">
              <span className="block text-sm font-medium text-gray-900">Add page separators</span>
              <span className="block text-sm text-gray-500">Include page breaks in the output</span>
            </span>
          </label>

          <label className="flex items-start">
            <input
              type="checkbox"
              checked={options.format_lines}
              onChange={(e) => handleOptionChange('format_lines', e.target.checked)}
              className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              disabled={processing}
            />
            <span className="ml-3">
              <span className="block text-sm font-medium text-gray-900">Format lines</span>
              <span className="block text-sm text-gray-500">Apply line formatting to improve readability</span>
            </span>
          </label>

          <label className="flex items-start">
            <input
              type="checkbox"
              checked={options.use_llm}
              onChange={(e) => {
                const newValue = e.target.checked
                handleOptionChange('use_llm', newValue)
                if (!newValue) {
                  handleOptionChange('disable_image_extraction', false)
                }
              }}
              className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              disabled={processing}
            />
            <span className="ml-3">
              <span className="block text-sm font-medium text-gray-900">Use LLM enhancement</span>
              <span className="block text-sm text-gray-500">Improve accuracy with AI (slower, costs more)</span>
            </span>
          </label>

          <label className="flex items-start">
            <input
              type="checkbox"
              checked={options.disable_image_extraction}
              onChange={(e) => handleOptionChange('disable_image_extraction', e.target.checked)}
              className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              disabled={processing || !options.use_llm}
            />
            <span className="ml-3">
              <span className="block text-sm font-medium text-gray-900">Disable image extraction</span>
              <span className="block text-sm text-gray-500">
                {options.use_llm
                  ? 'Skip extracting images and replace with descriptions'
                  : 'Requires LLM enhancement to be enabled'}
              </span>
            </span>
          </label>
        </div>
      </div>

      {/* Status Messages */}
      {status && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-center gap-2">
          {processing && <span className="text-blue-600 animate-spin text-xl">⟳</span>}
          <p className="text-blue-800">{status}</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-center gap-4">
        {!hasResult && (
          <Button
            onClick={handleConvert}
            disabled={processing || files.length === 0 || !apiKey.trim()}
            loading={processing}
            variant="primary"
          >
            {processing ? 'Converting...' : `Convert ${files.length > 1 ? `${files.length} Files` : 'to Markdown'}`}
          </Button>
        )}

        {hasResult && (
          <Button
            onClick={handleDownload}
            variant="primary"
          >
            {isBatch ? 'Download ZIP' : 'Download'}
          </Button>
        )}
      </div>

      {/* Info Section */}
      <div className="mt-12 bg-gray-50 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          How it works
        </h2>
        <ul className="space-y-2 text-gray-600">
          <li>1. Enter your Marker API key (test key provided by default)</li>
          <li>2. Upload one or multiple PDFs, or select a folder</li>
          <li>3. Configure conversion options (optional)</li>
          <li>4. Click &quot;Convert&quot; to start processing</li>
          <li>5. Wait for conversion (200 files processed in parallel for batch)</li>
          <li>6. Click &quot;Download&quot; to save your file(s)</li>
        </ul>
        <p className="mt-4 text-sm text-gray-500">
          Note: Multiple files are automatically processed in batch with 200 concurrent conversions. Individual files up to 200MB each, batch up to 10,000 files / 100GB total.
        </p>
      </div>
    </div>
  )
}
