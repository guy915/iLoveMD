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
import {
  convertBatchPdfToMarkdown,
  validateBatchFiles,
  filterPdfFiles,
  type BatchProgress,
  type FileConversionResult
} from '@/lib/services/batchConversionService'
import { useLogs } from '@/contexts/LogContext'

type ConversionMode = 'single' | 'batch'

export default function PdfToMarkdownPage() {
  // Mode selection
  const [mode, setMode] = useState<ConversionMode>('single')

  // API key - defaults to test key, not persisted across sessions
  const [apiKey, setApiKey] = useState('w4IU5bCYNudH_JZ0IKCUIZAo8ive3gc6ZPk6mzLtqxQ')

  // Single file mode state
  const [file, setFile] = useState<File | null>(null)
  const [processing, setProcessing] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [convertedMarkdown, setConvertedMarkdown] = useState<string | null>(null)
  const [outputFilename, setOutputFilename] = useState<string | null>(null)

  // Batch mode state
  const [batchFiles, setBatchFiles] = useState<File[]>([])
  const [batchProcessing, setBatchProcessing] = useState(false)
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

  // Cleanup on unmount to prevent memory leaks
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      // Cancel any ongoing conversion
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
      // Clear status timeout
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

  // Handle mode change
  const handleModeChange = useCallback((newMode: ConversionMode) => {
    setMode(newMode)
    setError('')
    setStatus('')
    // Clear previous results
    setConvertedMarkdown(null)
    setOutputFilename(null)
    setBatchZipBlob(null)
    setBatchZipFilename(null)
    setBatchProgress(null)
    addLog('info', `Switched to ${newMode} mode`)
  }, [addLog])

  // Single file handlers
  const handleFileSelect = useCallback((selectedFile: File) => {
    setFile(selectedFile)
    setError('')
    setConvertedMarkdown(null)
    setOutputFilename(null)
  }, [])

  const handleConvert = useCallback(async () => {
    if (!apiKey.trim()) {
      const errorMsg = 'Please enter your API key'
      setError(errorMsg)
      addLog('error', 'Conversion blocked: No API key provided')
      return
    }

    if (!file) {
      const errorMsg = 'Please select a PDF file'
      setError(errorMsg)
      addLog('error', 'Conversion blocked: No file selected')
      return
    }

    const conversionStartTime = Date.now()
    setProcessing(true)
    setError('')
    setStatus('Submitting to Marker API...')

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
        setStatus(`Processing PDF... (${attemptNumber}/${maxAttempts} checks, ${elapsedSeconds.toFixed(0)}s elapsed)`)

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
  }, [apiKey, file, options, addLog])

  const handleDownload = useCallback(async () => {
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

          addLog('success', 'File saved successfully via File System Access API', {
            filename: outputFilename
          })

          setStatus('File saved successfully! You can download again or upload a new file.')

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

        addLog('success', 'File download triggered', {
          filename: outputFilename
        })

        setStatus('File download started! Check your downloads folder.')
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

  // Batch mode handlers
  const handleBatchFilesSelect = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    const fileArray = Array.from(files)
    const pdfFiles = filterPdfFiles(fileArray)

    if (pdfFiles.length === 0) {
      setError('No PDF files found in selection')
      addLog('error', 'No PDF files in selection')
      return
    }

    addLog('info', `Selected ${pdfFiles.length} PDF files for batch conversion`, {
      totalFiles: fileArray.length,
      pdfFiles: pdfFiles.length,
      otherFiles: fileArray.length - pdfFiles.length
    })

    setBatchFiles(pdfFiles)
    setError('')
    setBatchProgress(null)
    setBatchZipBlob(null)
    setBatchZipFilename(null)
  }, [addLog])

  const handleFolderSelect = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    handleBatchFilesSelect(event)
  }, [handleBatchFilesSelect])

  const handleBatchConvert = useCallback(async () => {
    if (!apiKey.trim()) {
      setError('Please enter your API key')
      addLog('error', 'Batch conversion blocked: No API key provided')
      return
    }

    if (batchFiles.length === 0) {
      setError('Please select PDF files to convert')
      addLog('error', 'Batch conversion blocked: No files selected')
      return
    }

    // Validate batch
    const validation = validateBatchFiles(batchFiles)
    if (!validation.valid) {
      setError(validation.error || 'Invalid file selection')
      addLog('error', 'Batch validation failed', { error: validation.error })
      return
    }

    const startTime = Date.now()
    setBatchProcessing(true)
    setError('')
    setStatus('Starting batch conversion...')
    setBatchZipBlob(null)
    setBatchZipFilename(null)

    addLog('info', `Starting batch conversion`, {
      fileCount: batchFiles.length,
      totalSize: formatBytesToMB(batchFiles.reduce((sum, f) => sum + f.size, 0)),
      options: options
    })

    try {
      abortControllerRef.current = new AbortController()

      const result = await convertBatchPdfToMarkdown(batchFiles, {
        apiKey,
        markerOptions: options,
        onProgress: (progress) => {
          if (isMountedRef.current) {
            setBatchProgress(progress)
            setStatus(`Converting PDFs... ${progress.completed}/${progress.total} complete${progress.inProgress > 0 ? ` • ${progress.inProgress} in progress` : ''}${progress.failed > 0 ? ` • ${progress.failed} failed` : ''}`)
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
        setBatchProcessing(false)

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
        setBatchProcessing(false)
        setStatus('')
      }
    } finally {
      abortControllerRef.current = null
    }
  }, [apiKey, batchFiles, options, addLog])

  const handleBatchDownload = useCallback(async () => {
    if (!batchZipBlob || !batchZipFilename) return

    try {
      addLog('info', 'Batch download button clicked', {
        filename: batchZipFilename,
        size: formatBytesToMB(batchZipBlob.size)
      })

      if ('showSaveFilePicker' in window) {
        try {
          addLog('info', 'Using File System Access API for ZIP save dialog')

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
        setStatus('ZIP download started! Check your downloads folder.')
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

      {/* Mode Selector */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Conversion Mode</h2>
        <div className="flex gap-4">
          <label className="flex items-center cursor-pointer">
            <input
              type="radio"
              name="mode"
              value="single"
              checked={mode === 'single'}
              onChange={() => handleModeChange('single')}
              className="mr-2 h-4 w-4 text-blue-600"
              disabled={processing || batchProcessing}
            />
            <span className="text-sm font-medium text-gray-900">Single File</span>
          </label>
          <label className="flex items-center cursor-pointer">
            <input
              type="radio"
              name="mode"
              value="batch"
              checked={mode === 'batch'}
              onChange={() => handleModeChange('batch')}
              className="mr-2 h-4 w-4 text-blue-600"
              disabled={processing || batchProcessing}
            />
            <span className="text-sm font-medium text-gray-900">Batch / Folder</span>
          </label>
        </div>
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
          disabled={processing || batchProcessing}
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

      {/* Single File Mode */}
      {mode === 'single' && (
        <>
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <FileUpload
              accept=".pdf,application/pdf"
              onFileSelect={handleFileSelect}
              maxSize={FILE_SIZE.MAX_PDF_FILE_SIZE}
            />
          </div>
        </>
      )}

      {/* Batch Mode */}
      {mode === 'batch' && (
        <>
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload Files</h2>
            <div className="space-y-4">
              {/* Multiple Files */}
              <div>
                <label
                  htmlFor="multiple-files"
                  className="block w-full cursor-pointer"
                >
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
                    <div className="text-gray-600 mb-2">
                      <span className="font-medium text-blue-600">Click to select multiple PDFs</span>
                      <br />
                      <span className="text-sm">Up to 10,000 files • 100GB total</span>
                    </div>
                  </div>
                </label>
                <input
                  id="multiple-files"
                  type="file"
                  accept=".pdf,application/pdf"
                  multiple
                  onChange={handleBatchFilesSelect}
                  className="hidden"
                  disabled={batchProcessing}
                />
              </div>

              {/* Folder Upload */}
              <div className="text-center text-gray-500">— OR —</div>
              <div>
                <label
                  htmlFor="folder-upload"
                  className="block w-full cursor-pointer"
                >
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
                    <div className="text-gray-600 mb-2">
                      <span className="font-medium text-blue-600">Click to select a folder</span>
                      <br />
                      <span className="text-sm">All PDFs in the folder will be converted (subfolders ignored)</span>
                    </div>
                  </div>
                </label>
                <input
                  id="folder-upload"
                  type="file"
                  // @ts-ignore - webkitdirectory is not in TypeScript definitions
                  webkitdirectory="true"
                  multiple
                  onChange={handleFolderSelect}
                  className="hidden"
                  disabled={batchProcessing}
                />
              </div>

              {/* Selected Files Count */}
              {batchFiles.length > 0 && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm font-medium text-blue-900">
                    {batchFiles.length} PDF file{batchFiles.length !== 1 ? 's' : ''} selected
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    Total size: {formatBytesToMB(batchFiles.reduce((sum, f) => sum + f.size, 0))}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Batch Progress */}
          {batchProgress && (
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Conversion Progress
              </h2>

              {/* Overall Progress */}
              <div className="mb-4">
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>{batchProgress.completed}/{batchProgress.total} complete</span>
                  <span>
                    {batchProgress.inProgress > 0 && `${batchProgress.inProgress} in progress`}
                    {batchProgress.inProgress > 0 && batchProgress.failed > 0 && ' • '}
                    {batchProgress.failed > 0 && `${batchProgress.failed} failed`}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${(batchProgress.completed / batchProgress.total) * 100}%`
                    }}
                  />
                </div>
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
        </>
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
              disabled={processing || batchProcessing}
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
              disabled={processing || batchProcessing}
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
              disabled={processing || batchProcessing}
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
              disabled={processing || batchProcessing || !options.use_llm}
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
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
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
        {/* Single Mode Buttons */}
        {mode === 'single' && (
          <>
            {!convertedMarkdown && (
              <Button
                onClick={handleConvert}
                disabled={processing || !file || !apiKey.trim()}
                loading={processing}
                variant="primary"
              >
                {processing ? 'Converting...' : 'Convert to Markdown'}
              </Button>
            )}

            {convertedMarkdown && (
              <Button
                onClick={handleDownload}
                variant="primary"
              >
                Download
              </Button>
            )}
          </>
        )}

        {/* Batch Mode Buttons */}
        {mode === 'batch' && (
          <>
            {!batchZipBlob && (
              <Button
                onClick={handleBatchConvert}
                disabled={batchProcessing || batchFiles.length === 0 || !apiKey.trim()}
                loading={batchProcessing}
                variant="primary"
              >
                {batchProcessing ? 'Converting...' : `Convert ${batchFiles.length} File${batchFiles.length !== 1 ? 's' : ''}`}
              </Button>
            )}

            {batchZipBlob && (
              <Button
                onClick={handleBatchDownload}
                variant="primary"
              >
                Download ZIP
              </Button>
            )}
          </>
        )}
      </div>

      {/* Info Section */}
      <div className="mt-12 bg-gray-50 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          How it works
        </h2>
        {mode === 'single' ? (
          <ul className="space-y-2 text-gray-600">
            <li>1. Enter your Marker API key (test key provided by default)</li>
            <li>2. Upload a PDF file (up to 200MB)</li>
            <li>3. Configure conversion options (optional)</li>
            <li>4. Click &quot;Convert to Markdown&quot;</li>
            <li>5. Wait for processing (usually 30-60 seconds)</li>
            <li>6. Click &quot;Download&quot; to save the file</li>
          </ul>
        ) : (
          <ul className="space-y-2 text-gray-600">
            <li>1. Enter your Marker API key</li>
            <li>2. Upload multiple PDFs or select a folder (up to 10,000 files / 100GB)</li>
            <li>3. Configure conversion options (applies to all files)</li>
            <li>4. Click &quot;Convert&quot; to start batch processing</li>
            <li>5. Watch real-time progress (200 files processed in parallel)</li>
            <li>6. Download ZIP file with all converted markdowns</li>
          </ul>
        )}
        <p className="mt-4 text-sm text-gray-500">
          Note: API keys are not saved between sessions. Your files are never stored on our servers - processing happens through the Marker API. Files are converted in parallel for maximum speed.
        </p>
      </div>
    </div>
  )
}
