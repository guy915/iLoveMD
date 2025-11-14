'use client'

import { useState, useEffect, useRef, useCallback, ChangeEvent } from 'react'
import Button from '@/components/common/Button'
import { downloadFile, replaceExtension } from '@/lib/utils/downloadUtils'
import { formatBytesToMB, formatBytesToKB, formatDuration } from '@/lib/utils/formatUtils'
import type { MarkerOptions } from '@/types'
import { MARKER_CONFIG, STORAGE_KEYS, FILE_SIZE } from '@/lib/constants'
import * as storageService from '@/lib/services/storageService'
import { convertPdfToMarkdown } from '@/lib/services/markerApiService'
import { filterPdfFiles, filterImmediateFolderFiles, getFolderName, type BatchProgress } from '@/lib/services/batchConversionService'
import { useLogs } from '@/contexts/LogContext'

export default function PdfToMarkdownPage() {
  // API key - defaults to test key, not persisted across sessions
  const [apiKey, setApiKey] = useState('w4IU5bCYNudH_JZ0IKCUIZAo8ive3gc6ZPk6mzLtqxQ')

  // File state - supports both single and batch
  const [files, setFiles] = useState<File[]>([])
  const [folderName, setFolderName] = useState<string | null>(null)

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

  // Use global logging context (do not destructure clearLogs - we never clear logs)
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
      // Merge with defaults to handle missing fields from old versions
      const mergedOptions = { ...MARKER_CONFIG.DEFAULT_OPTIONS, ...savedOptions }
      setOptions(mergedOptions)
      addLog('info', 'Loaded saved options from localStorage', { options: mergedOptions })
    }
    setHasLoadedOptions(true)
  }, [addLog])

  // Save options to localStorage whenever they change (after initial load)
  useEffect(() => {
    if (hasLoadedOptions) {
      storageService.setJSON(STORAGE_KEYS.MARKER_OPTIONS, options)
    }
  }, [options, hasLoadedOptions])

  // Log option changes using useEffect to avoid setState-during-render warning
  // This observes the committed state changes rather than calling addLog during render
  useEffect(() => {
    // Skip logging on initial load
    if (!hasLoadedOptions) return

    // Find which option changed by comparing with previous state
    const prev = prevOptionsRef.current
    const current = options

    for (const key in current) {
      const typedKey = key as keyof MarkerOptions
      if (prev[typedKey] !== current[typedKey]) {
        addLog('info', `Option changed: ${key}`, {
          newValue: current[typedKey],
          allOptions: current
        })
        break // Only log first change to avoid duplicate logs when multiple options change
      }
    }

    // Update ref for next comparison
    prevOptionsRef.current = options
  }, [options, hasLoadedOptions, addLog])

  const handleOptionChange = useCallback((key: keyof MarkerOptions, value: boolean | string) => {
    setOptions(prev => ({ ...prev, [key]: value }))
  }, [])

  // Log component mount (once)
  useEffect(() => {
    const keyPresent = apiKey.length > 0
    const keyLength = apiKey.length

    addLog('info', 'PDF to Markdown page loaded', {
      apiKeyPresent: keyPresent,
      apiKeyLength: keyLength
    })
    // Note: We don't log the actual API key value for security
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addLog]) // Only run once on mount

  // Determine if this is a batch conversion
  const isBatch = files.length > 1

  const handleFilesSelect = useCallback((selectedFiles: FileList, fromFolder: boolean = false) => {
    const filesArray = Array.from(selectedFiles)
    let pdfFiles = filterPdfFiles(filesArray)

    // If from folder, only include files in immediate folder (not subfolders)
    if (fromFolder) {
      pdfFiles = filterImmediateFolderFiles(pdfFiles)
    }

    if (pdfFiles.length === 0) {
      setError('No PDF files found in selection')
      addLog('error', 'No PDF files in selection')
      return
    }

    // Check if this is from a folder by looking at webkitRelativePath
    const folderNameDetected = fromFolder ? getFolderName(pdfFiles[0]) : null

    addLog('info', `Adding ${pdfFiles.length} PDF file(s)`, {
      total: filesArray.length,
      pdfs: pdfFiles.length,
      fromFolder,
      folderName: folderNameDetected,
      previousCount: files.length,
      excludedSubfolderFiles: fromFolder ? filesArray.length - pdfFiles.length : 0
    })

    // Accumulate files - avoid duplicates by name
    setFiles(prevFiles => {
      const existingNames = new Set(prevFiles.map(f => f.name))
      const newFiles = pdfFiles.filter(f => !existingNames.has(f.name))
      return [...prevFiles, ...newFiles]
    })

    // Update folder name if this is first selection or if single folder
    if (files.length === 0 && folderNameDetected) {
      setFolderName(folderNameDetected)
    } else if (files.length > 0) {
      setFolderName(null) // Multiple sources, no single folder name
    }

    setError('')
    setConvertedMarkdown(null)
    setOutputFilename(null)
    setBatchProgress(null)
    setBatchZipBlob(null)
    setBatchZipFilename(null)
  }, [addLog, files.length])

  const handleClearFiles = useCallback(() => {
    setFiles([])
    setFolderName(null)
    setError('')
    setConvertedMarkdown(null)
    setOutputFilename(null)
    setBatchProgress(null)
    setBatchZipBlob(null)
    setBatchZipFilename(null)
    addLog('info', 'Cleared all selected files')
  }, [addLog])

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addLog('info', `${e.dataTransfer.files.length} file(s) dropped`)
      handleFilesSelect(e.dataTransfer.files, false)
    }
  }, [handleFilesSelect, addLog])

  const handleConvert = useCallback(async () => {
    if (!apiKey.trim()) {
      setError('Please enter your API key')
      addLog('error', 'Conversion blocked: No API key provided')
      return
    }

    if (files.length === 0) {
      setError('Please select PDF file(s)')
      addLog('error', 'Conversion blocked: No files selected')
      return
    }

    const conversionStartTime = Date.now()
    setProcessing(true)
    setError('')
    setBatchProgress(null)
    setBatchZipBlob(null)
    setBatchZipFilename(null)

    addLog('info', `Starting conversion`, {
      fileCount: files.length,
      isBatch,
      totalSize: formatBytesToMB(files.reduce((sum, f) => sum + f.size, 0)),
      options
    })

    try {
      abortControllerRef.current = new AbortController()

      if (isBatch) {
        // Batch conversion
        setStatus('Processing batch...')

        // Dynamically import batch service
        const { convertBatchPdfToMarkdown } = await import('@/lib/services/batchConversionService')

        const result = await convertBatchPdfToMarkdown(files, {
          apiKey,
          markerOptions: options,
          onProgress: (progress) => {
            if (isMountedRef.current) {
              setBatchProgress(progress)
              setStatus(`Processing... ${progress.completed}/${progress.total} complete`)
            }
          },
          signal: abortControllerRef.current.signal
        })

        if (!result.success || !result.zipBlob) {
          throw new Error(result.error || 'Batch conversion failed')
        }

        // Generate ZIP filename
        const zipName = folderName
          ? `${folderName}_markdown.zip`
          : `converted_markdowns_${new Date().toISOString().replace(/:/g, '-').split('.')[0]}.zip`

        addLog('success', `Batch conversion complete!`, {
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

      } else {
        // Single file conversion
        const file = files[0]
        setStatus('Submitting to Marker API...')

        const onProgress = (status: string, attemptNumber: number, elapsedSeconds: number) => {
          if (!isMountedRef.current) return
          const maxAttempts = MARKER_CONFIG.POLLING.MAX_ATTEMPTS
          setStatus(`Processing PDF... (${attemptNumber}/${maxAttempts} checks, ${elapsedSeconds.toFixed(0)}s elapsed)`)
        }

        const result = await convertPdfToMarkdown(
          file,
          apiKey,
          options,
          onProgress,
          abortControllerRef.current.signal
        )

        if (!result.success || !result.markdown) {
          throw new Error(result.error || 'Conversion failed')
        }

        const filename = replaceExtension(file.name, 'md')

        addLog('success', `Conversion complete!`, {
          contentSize: formatBytesToKB(result.markdown.length),
          filename
        })

        if (isMountedRef.current) {
          setConvertedMarkdown(result.markdown)
          setOutputFilename(filename)
          setStatus('Conversion complete! Click Download to save the file.')
          setProcessing(false)
        }
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
  }, [apiKey, files, options, isBatch, folderName, addLog])

  const handleDownload = useCallback(async () => {
    if (!convertedMarkdown || !outputFilename) return

    try {
      addLog('info', 'Download button clicked', {
        filename: outputFilename,
        contentSize: formatBytesToKB(convertedMarkdown.length)
      })

      // Check if File System Access API is available (Chrome/Edge)
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
          // User cancelled or API error
          if (apiError.name === 'AbortError') {
            addLog('info', 'User cancelled save dialog')
            return
          }
          throw apiError
        }
      } else {
        // Fallback to traditional download for browsers without File System Access API
        addLog('info', 'Using traditional download method (File System Access API not available)')
        downloadFile(convertedMarkdown, outputFilename, 'text/markdown')

        addLog('success', 'File download triggered', {
          filename: outputFilename
        })

        setStatus('File download started! Check your downloads folder. You can download again or upload a new file.')
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
      addLog('info', 'Batch ZIP download clicked', { filename: batchZipFilename })

      // Check if File System Access API is available
      if ('showSaveFilePicker' in window) {
        try {
          addLog('info', 'Using File System Access API for ZIP save')

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
      addLog('error', `ZIP download failed: ${error.message}`)
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
        <div
          className="border-2 border-dashed border-gray-300 rounded-lg relative"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <p className="text-lg py-4 font-medium text-gray-700 text-center">
            Drop PDF files or folders here
          </p>

          <div className="flex items-stretch gap-0 min-h-[180px] border-t border-gray-300">
            {/* Files Button (Left Half) */}
            <label className="flex-1 cursor-pointer flex items-center justify-center hover:bg-gray-50 transition-colors rounded-bl-lg border-r border-gray-200">
              <input
                type="file"
                accept=".pdf,application/pdf"
                multiple
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFilesSelect(e.target.files, false)
                    e.target.value = ''
                  }
                }}
                className="hidden"
              />
              <span className="text-base font-medium text-gray-700">
                Browse Files
              </span>
            </label>

            {/* Soft Divider */}
            <div className="w-px bg-gray-200"></div>

            {/* Folder Button (Right Half) */}
            <label className="flex-1 cursor-pointer flex items-center justify-center hover:bg-gray-50 transition-colors rounded-br-lg border-l border-gray-200">
              <input
                type="file"
                accept=".pdf,application/pdf"
                multiple
                // @ts-ignore - webkitdirectory is not in TypeScript definitions
                webkitdirectory="true"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFilesSelect(e.target.files, true)
                    e.target.value = ''
                  }
                }}
                className="hidden"
              />
              <span className="text-base font-medium text-gray-700">
                Browse Folders
              </span>
            </label>
          </div>

          {files.length > 0 && (
            <div className="border-t border-gray-200 py-3 px-4 bg-gray-50 rounded-b-lg flex items-center justify-between">
              <p className="text-sm text-blue-600 font-medium">
                Selected: {files.length} PDF file{files.length > 1 ? 's' : ''}
                {folderName && ` from "${folderName}"`}
              </p>
              <button
                onClick={handleClearFiles}
                className="text-sm text-red-600 hover:text-red-700 font-medium"
              >
                Clear All
              </button>
            </div>
          )}
        </div>
      </div>

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
                // If disabling LLM, must also reset disable_image_extraction
                // because image extraction requires LLM to be enabled
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

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Single File Status - unified for processing and completion */}
      {!isBatch && (processing || status) && (
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex items-center gap-3">
            {processing && (
              <span className="text-blue-600 animate-spin text-2xl">⟳</span>
            )}
            <p className="text-base font-semibold text-gray-900">
              {status || 'Converting PDF to Markdown...'}
            </p>
          </div>
        </div>
      )}

      {/* Batch Progress - unified for processing and completion */}
      {isBatch && (processing || status) && (
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex items-center gap-3">
            {processing && (
              <span className="text-blue-600 animate-spin text-2xl">⟳</span>
            )}
            <p className="text-base font-semibold text-gray-900">
              {batchProgress && processing
                ? `Converting ${batchProgress.completed}/${batchProgress.total} files`
                : status}
            </p>
          </div>
          {batchProgress && batchProgress.failed > 0 && (
            <p className="text-sm text-red-600 ml-11 mt-2">Failed: {batchProgress.failed}</p>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-center gap-4">
        {/* Convert Button - show when no conversion result */}
        {!convertedMarkdown && !batchZipBlob && (
          <Button
            onClick={handleConvert}
            disabled={processing || files.length === 0 || !apiKey.trim()}
            loading={processing}
            loadingText="Converting..."
            variant="primary"
          >
            Convert to Markdown
          </Button>
        )}

        {/* Download Button - single file */}
        {convertedMarkdown && (
          <Button
            onClick={handleDownload}
            variant="primary"
          >
            Download Markdown
          </Button>
        )}

        {/* Download Button - batch ZIP */}
        {batchZipBlob && (
          <Button
            onClick={handleDownloadBatch}
            variant="primary"
          >
            Download ZIP
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
          <li>2. Upload PDF file(s) or select a folder (up to 200MB per file)</li>
          <li>3. Configure conversion options (optional)</li>
          <li>4. Click &quot;Convert to Markdown&quot;</li>
          <li>5. Wait for processing (batch: 200 files processed in parallel)</li>
          <li>6. Click &quot;Download&quot; to save your file(s)</li>
        </ul>
        <p className="mt-4 text-sm text-gray-500">
          <strong>Batch Processing:</strong> Select multiple files or folders for automatic batch conversion.
          Output is a ZIP file containing all converted markdowns.
          Supports up to 10,000 files or 100GB total.
        </p>
        <p className="mt-2 text-sm text-gray-500">
          Note: Your files are never stored on our servers - processing happens through the Marker API.
          Batch conversions process up to 200 files concurrently with automatic retry on failure.
        </p>
      </div>
    </div>
  )
}
