'use client'

import { useState, useEffect, useRef, useCallback, ChangeEvent } from 'react'
import Button from '@/components/common/Button'
import { downloadFile, replaceExtension } from '@/lib/utils/downloadUtils'
import { formatBytesToMB, formatBytesToKB, formatDuration } from '@/lib/utils/formatUtils'
import type { MarkerOptions } from '@/types'
import { MARKER_CONFIG, STORAGE_KEYS, FILE_SIZE } from '@/lib/constants'
import * as storageService from '@/lib/services/storageService'
import { convertPdfToMarkdown, convertPdfToMarkdownLocal, convertPdfToMarkdownCloudFree } from '@/lib/services/markerApiService'
import { filterPdfFiles, filterImmediateFolderFiles, getFolderName, type BatchProgress } from '@/lib/services/batchConversionService'
import { useLogs } from '@/contexts/LogContext'

export default function PdfToMarkdownPage() {
  // Mode state - 'local' uses true local setup, 'cloud-free' uses HuggingFace GPU, 'cloud-paid' uses Marker API
  // Always start with 'local' to match SSR, then update from localStorage in useEffect
  const [mode, setMode] = useState<'local' | 'cloud-free' | 'cloud-paid'>('local')

  // API keys
  const [apiKey, setApiKey] = useState('w4IU5bCYNudH_JZ0IKCUIZAo8ive3gc6ZPk6mzLtqxQ') // Marker API key (cloud mode)
  const [geminiApiKey, setGeminiApiKey] = useState('') // Gemini API key (local mode with LLM)

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

  // Full-page drop zone state
  const [showDropOverlay, setShowDropOverlay] = useState(false)
  const dragCounterRef = useRef(0)

  // Local setup UI state
  const [showManualSetup, setShowManualSetup] = useState(false)

  // Load mode from localStorage immediately after mount (before any rendering)
  // This prevents hydration mismatch by always starting with 'local' on both server and client
  useEffect(() => {
    const savedMode = storageService.getItem(STORAGE_KEYS.MARKER_MODE) as 'local' | 'cloud-free' | 'cloud-paid' | null
    if (savedMode === 'local' || savedMode === 'cloud-free' || savedMode === 'cloud-paid') {
      setMode(savedMode)
    }
  }, [])

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

  // Load API keys from localStorage on mount
  useEffect(() => {
    const savedGeminiKey = storageService.getItem(STORAGE_KEYS.GEMINI_API_KEY)
    if (savedGeminiKey) {
      setGeminiApiKey(savedGeminiKey)
      addLog('info', 'Loaded saved Gemini API key from localStorage')
    }

    const savedOptions = storageService.getJSON<Partial<MarkerOptions>>(STORAGE_KEYS.MARKER_OPTIONS)
    if (savedOptions) {
      // Merge with defaults to handle missing fields from old versions
      const mergedOptions = { ...MARKER_CONFIG.DEFAULT_OPTIONS, ...savedOptions }
      setOptions(mergedOptions)
      addLog('info', 'Loaded saved options from localStorage', { options: mergedOptions })
    }
    setHasLoadedOptions(true)
  }, [addLog])

  // Save mode to localStorage whenever it changes
  useEffect(() => {
    if (hasLoadedOptions) {
      storageService.setItem(STORAGE_KEYS.MARKER_MODE, mode)
    }
  }, [mode, hasLoadedOptions])

  // Save Gemini API key to localStorage whenever it changes
  useEffect(() => {
    if (hasLoadedOptions) {
      storageService.setItem(STORAGE_KEYS.GEMINI_API_KEY, geminiApiKey)
    }
  }, [geminiApiKey, hasLoadedOptions])

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

    // Hide overlay and reset counter
    dragCounterRef.current = 0
    setShowDropOverlay(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addLog('info', `${e.dataTransfer.files.length} file(s) dropped`)
      handleFilesSelect(e.dataTransfer.files, false)
    }
  }, [handleFilesSelect, addLog])

  // Full-page drag handlers using document-level events
  useEffect(() => {
    const handlePageDragEnter = (e: DragEvent) => {
      e.preventDefault()
      dragCounterRef.current++
      if (dragCounterRef.current === 1) {
        setShowDropOverlay(true)
        addLog('info', 'Files dragged over page - showing drop overlay')
      }
    }

    const handlePageDragLeave = (e: DragEvent) => {
      e.preventDefault()
      dragCounterRef.current--
      if (dragCounterRef.current === 0) {
        setShowDropOverlay(false)
      }
    }

    const handlePageDragOver = (e: DragEvent) => {
      e.preventDefault()
    }

    const handlePageDrop = (e: DragEvent) => {
      e.preventDefault()
      dragCounterRef.current = 0
      setShowDropOverlay(false)

      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        addLog('info', `${e.dataTransfer.files.length} file(s) dropped on page`)
        handleFilesSelect(e.dataTransfer.files, false)
      }
    }

    // Add document-level listeners
    document.addEventListener('dragenter', handlePageDragEnter)
    document.addEventListener('dragleave', handlePageDragLeave)
    document.addEventListener('dragover', handlePageDragOver)
    document.addEventListener('drop', handlePageDrop)

    return () => {
      document.removeEventListener('dragenter', handlePageDragEnter)
      document.removeEventListener('dragleave', handlePageDragLeave)
      document.removeEventListener('dragover', handlePageDragOver)
      document.removeEventListener('drop', handlePageDrop)
    }
  }, [addLog, handleFilesSelect])

  const handleConvert = useCallback(async () => {
    // Mode-based validation
    if (mode === 'cloud-paid') {
      // Validate Marker API key for cloud paid mode
      if (!apiKey.trim()) {
        setError('Please enter your Marker API key')
        addLog('error', 'Conversion blocked: No Marker API key provided')
        return
      }
    } else if (mode === 'local' || mode === 'cloud-free') {
      // Validate Gemini API key for local/cloud-free mode with LLM
      if (options.use_llm && !geminiApiKey.trim()) {
        setError(`Please enter your Gemini API key to use LLM enhancement in ${mode === 'local' ? 'local' : 'Cloud Free'} mode`)
        addLog('error', `Conversion blocked: No Gemini API key provided for ${mode} LLM mode`)
        return
      }
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
        // NOTE: Batch mode only supports cloud-paid mode for now (local/cloud-free batch may be added later)
        if (mode === 'local' || mode === 'cloud-free') {
          throw new Error(`Batch conversion is not yet supported in ${mode === 'local' ? 'Local' : 'Cloud Free'} mode. Please switch to Cloud (Paid) mode or convert files individually.`)
        }

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
        const statusMessages = {
          'local': 'Submitting to local Marker...',
          'cloud-free': 'Submitting to Cloud Free (HuggingFace)...',
          'cloud-paid': 'Submitting to Marker API...'
        }
        setStatus(statusMessages[mode])

        const onProgress = (status: string, attemptNumber: number, elapsedSeconds: number) => {
          if (!isMountedRef.current) return
          const maxAttempts = MARKER_CONFIG.POLLING.MAX_ATTEMPTS
          setStatus(`Processing PDF... (${attemptNumber}/${maxAttempts} checks, ${elapsedSeconds.toFixed(0)}s elapsed)`)
        }

        // Call appropriate conversion function based on mode
        let result
        if (mode === 'cloud-paid') {
          result = await convertPdfToMarkdown(
            file,
            apiKey,
            options,
            onProgress,
            abortControllerRef.current.signal
          )
        } else if (mode === 'cloud-free') {
          result = await convertPdfToMarkdownCloudFree(
            file,
            options.use_llm ? geminiApiKey : null,
            options,
            onProgress,
            abortControllerRef.current.signal
          )
        } else {
          // mode === 'local'
          result = await convertPdfToMarkdownLocal(
            file,
            options.use_llm ? geminiApiKey : null,
            options,
            onProgress,
            abortControllerRef.current.signal
          )
        }

        if (!result.success || !result.markdown) {
          throw new Error(result.error || 'Conversion failed')
        }

        const filename = replaceExtension(file.name, 'md')

        addLog('success', `Conversion complete!`, {
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
  }, [apiKey, geminiApiKey, files, options, isBatch, folderName, mode, addLog])

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
    <>
      {/* Full-page drop overlay - drag handlers on document in useEffect */}
      {showDropOverlay && (
        <div
          className="fixed inset-0 z-50 bg-blue-500 bg-opacity-20 backdrop-blur-sm flex items-center justify-center pointer-events-none"
          role="status"
          aria-live="polite"
          aria-label="Drop zone active"
        >
          <div className="bg-white rounded-2xl shadow-2xl p-12 border-4 border-dashed border-blue-500 pointer-events-none">
            <p className="text-3xl font-bold text-blue-600 mb-2">Drop PDF files here</p>
            <p className="text-lg text-gray-600">Release to upload</p>
            <p className="text-sm text-gray-500 mt-2">Note: Use &quot;Browse Folders&quot; button for folders</p>
          </div>
        </div>
      )}

      {/* Page content */}
      <div className="relative max-w-4xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          PDF to Markdown
        </h1>
        <p className="text-lg text-gray-600">
          Convert PDF files to Markdown format using Marker
        </p>
      </div>

      {/* Mode Toggle Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Conversion Mode</h2>
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => {
              setMode('local')
              addLog('info', 'Switched to Local (Free) mode')
            }}
            disabled={processing}
            className={`px-4 py-3 rounded-lg font-medium transition-colors ${
              mode === 'local'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            } ${processing ? 'opacity-50 cursor-not-allowed' : ''}`}
            aria-pressed={mode === 'local'}
          >
            <div className="text-sm font-semibold">Local</div>
            <div className="text-xs opacity-90">(Free)</div>
          </button>
          <button
            onClick={() => {
              setMode('cloud-free')
              addLog('info', 'Switched to Cloud Free mode')
            }}
            disabled={processing}
            className={`px-4 py-3 rounded-lg font-medium transition-colors ${
              mode === 'cloud-free'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            } ${processing ? 'opacity-50 cursor-not-allowed' : ''}`}
            aria-pressed={mode === 'cloud-free'}
          >
            <div className="text-sm font-semibold">Cloud Free</div>
            <div className="text-xs opacity-90">(Free GPU)</div>
          </button>
          <button
            onClick={() => {
              setMode('cloud-paid')
              addLog('info', 'Switched to Cloud (Paid) mode')
            }}
            disabled={processing}
            className={`px-4 py-3 rounded-lg font-medium transition-colors ${
              mode === 'cloud-paid'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            } ${processing ? 'opacity-50 cursor-not-allowed' : ''}`}
            aria-pressed={mode === 'cloud-paid'}
          >
            <div className="text-sm font-semibold">Cloud (Paid)</div>
            <div className="text-xs opacity-90">(API)</div>
          </button>
        </div>
        <p className="mt-3 text-sm text-gray-600">
          {mode === 'local' && 'True local processing (requires Python + Marker setup, all options available)'}
          {mode === 'cloud-free' && 'Free GPU processing on HuggingFace (may have 30-60s cold start, then fast)'}
          {mode === 'cloud-paid' && 'Fastest processing with Marker API (requires API key, supports batch)'}
        </p>
      </div>

      {/* API Key Section - Cloud Paid Mode */}
      {mode === 'cloud-paid' && (
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
      )}

      {/* Gemini API Key Section - Local and Cloud Free Modes */}
      {(mode === 'local' || mode === 'cloud-free') && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <label htmlFor="gemini-api-key-input" className="block text-sm font-medium text-gray-700 mb-2">
            Gemini API Key
          </label>
          <input
            id="gemini-api-key-input"
            type="password"
            value={geminiApiKey}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setGeminiApiKey(e.target.value)}
            placeholder="Enter your Gemini API key"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            disabled={processing || !options.use_llm}
            aria-label="Gemini API Key"
          />
          <p className="mt-2 text-sm text-gray-500">
            {options.use_llm ? (
              <>
                Required when using LLM enhancement in {mode === 'local' ? 'Local' : 'Cloud Free'} mode.{' '}
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700 underline"
                >
                  Get a Gemini API key
                </a>
              </>
            ) : (
              'Enable "Use LLM enhancement" option below to activate this field'
            )}
          </p>
        </div>
      )}

      {/* Local Mode Setup Section */}
      {mode === 'local' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-6">
          <div className="flex items-start gap-3 mb-4">
            <span className="text-2xl">⚙️</span>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Local Mode Setup Required</h3>
              <p className="text-sm text-gray-700">
                Local mode needs Python and Marker installed to work.
              </p>
            </div>
          </div>

          {!showManualSetup ? (
            <>
              <p className="text-sm text-gray-700 mb-4">Download the setup script for your operating system:</p>

              <div className="grid grid-cols-3 gap-3 mb-4">
                <a
                  href="/scripts/setup-windows.bat"
                  download="setup-windows.bat"
                  className="flex flex-col items-center justify-center px-4 py-6 bg-white border-2 border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
                >
                  <span className="text-3xl mb-2">🪟</span>
                  <span className="text-sm font-semibold text-gray-900">Windows</span>
                  <span className="text-xs text-gray-600 mt-1">setup.bat</span>
                </a>

                <a
                  href="/scripts/setup-mac.sh"
                  download="setup-mac.sh"
                  className="flex flex-col items-center justify-center px-4 py-6 bg-white border-2 border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
                >
                  <span className="text-3xl mb-2">🍎</span>
                  <span className="text-sm font-semibold text-gray-900">macOS</span>
                  <span className="text-xs text-gray-600 mt-1">setup.sh</span>
                </a>

                <a
                  href="/scripts/setup-linux.sh"
                  download="setup-linux.sh"
                  className="flex flex-col items-center justify-center px-4 py-6 bg-white border-2 border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
                >
                  <span className="text-3xl mb-2">🐧</span>
                  <span className="text-sm font-semibold text-gray-900">Linux</span>
                  <span className="text-xs text-gray-600 mt-1">setup.sh</span>
                </a>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
                <p className="text-sm font-medium text-gray-900 mb-2">After downloading:</p>
                <ol className="text-sm text-gray-700 space-y-1 ml-4">
                  <li>1. Double-click the downloaded file (or run in terminal)</li>
                  <li>2. Wait for installation to complete (~2-5 minutes)</li>
                  <li>3. The server will start automatically</li>
                  <li>4. Return here and click &quot;Convert to Markdown&quot;</li>
                </ol>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
                <p className="text-sm font-medium text-gray-900 mb-2">What the script does:</p>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>✓ Checks Python 3.9+ (installs if needed - Windows only)</li>
                  <li>✓ Installs marker-pdf via pip</li>
                  <li>✓ Downloads and starts the local server</li>
                </ul>
              </div>

              <button
                onClick={() => setShowManualSetup(true)}
                className="text-sm text-blue-600 hover:text-blue-700 underline"
              >
                📋 Show Manual Instructions Instead
              </button>
            </>
          ) : (
            <>
              <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
                <p className="text-sm font-medium text-gray-900 mb-3">Prerequisites: Python 3.9+ must be installed</p>
                <p className="text-sm text-gray-600 mb-4">
                  Don&apos;t have Python?{' '}
                  <a
                    href="https://python.org/downloads"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 underline"
                  >
                    Download it here
                  </a>
                </p>

                <div className="border-t border-gray-200 pt-4 mb-4">
                  <p className="text-sm font-semibold text-gray-900 mb-3">🚀 One-Line Install (Recommended)</p>
                  <p className="text-sm text-gray-700 mb-2">Copy and run this command in your terminal:</p>
                  <div className="relative">
                    <code className="block bg-gray-900 text-gray-100 text-sm p-3 rounded-lg overflow-x-auto">
                      curl -sSL https://raw.githubusercontent.com/guy915/AI-Doc-Prep/main/scripts/setup.sh | bash
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText('curl -sSL https://raw.githubusercontent.com/guy915/AI-Doc-Prep/main/scripts/setup.sh | bash')
                        addLog('info', 'Copied one-line install command to clipboard')
                      }}
                      className="absolute top-2 right-2 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                    >
                      Copy
                    </button>
                  </div>
                  <p className="text-xs text-gray-600 mt-2">This will install marker-pdf and start the server automatically.</p>
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <p className="text-sm font-semibold text-gray-900 mb-3">📝 Step-by-Step Install</p>

                  <p className="text-sm font-medium text-gray-700 mb-2">Step 1: Install marker-pdf</p>
                  <div className="relative mb-4">
                    <code className="block bg-gray-900 text-gray-100 text-sm p-3 rounded-lg">
                      pip install marker-pdf
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText('pip install marker-pdf')
                        addLog('info', 'Copied pip install command to clipboard')
                      }}
                      className="absolute top-2 right-2 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                    >
                      Copy
                    </button>
                  </div>

                  <p className="text-sm font-medium text-gray-700 mb-2">Step 2: Download the server script</p>
                  <div className="relative mb-4">
                    <code className="block bg-gray-900 text-gray-100 text-sm p-3 rounded-lg overflow-x-auto">
                      curl -o marker_server.py https://raw.githubusercontent.com/guy915/AI-Doc-Prep/main/scripts/marker_server.py
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText('curl -o marker_server.py https://raw.githubusercontent.com/guy915/AI-Doc-Prep/main/scripts/marker_server.py')
                        addLog('info', 'Copied server download command to clipboard')
                      }}
                      className="absolute top-2 right-2 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                    >
                      Copy
                    </button>
                  </div>

                  <p className="text-sm font-medium text-gray-700 mb-2">Step 3: Start the server</p>
                  <div className="relative mb-4">
                    <code className="block bg-gray-900 text-gray-100 text-sm p-3 rounded-lg">
                      python marker_server.py
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText('python marker_server.py')
                        addLog('info', 'Copied server start command to clipboard')
                      }}
                      className="absolute top-2 right-2 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                    >
                      Copy
                    </button>
                  </div>

                  <div className="bg-amber-100 border border-amber-300 rounded-lg p-3">
                    <p className="text-sm text-amber-900">
                      ⚠️ Keep the terminal window open while using AI Doc Prep
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowManualSetup(false)}
                className="text-sm text-blue-600 hover:text-blue-700 underline"
              >
                ⬅️ Back to Downloads
              </button>
            </>
          )}
        </div>
      )}

      {/* File Upload Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div
          className="border-2 border-dashed border-gray-300 rounded-lg relative"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <p className="text-lg py-4 font-medium text-gray-700 text-center">
            Drop PDF files here
          </p>

          <div className="flex items-stretch gap-0 min-h-[180px] border-t border-gray-300">
            {/* Files Button (Left Half) */}
            <label className="flex-1 cursor-pointer flex flex-col items-center justify-center hover:bg-gray-50 transition-colors rounded-bl-lg border-r border-gray-200 py-6">
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
              <span className="text-sm text-gray-500 mt-1">
                Select individual PDFs
              </span>
            </label>

            {/* Soft Divider */}
            <div className="w-px bg-gray-200"></div>

            {/* Folder Button (Right Half) */}
            <label className="flex-1 cursor-pointer flex flex-col items-center justify-center hover:bg-gray-50 transition-colors rounded-br-lg border-l border-gray-200 py-6">
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
              <span className="text-sm text-gray-500 mt-1">
                Select entire folder
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
              <span className="block text-sm text-gray-500">Include page breaks and numbers</span>
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

          {/* Local and Cloud Free mode options */}
          {(mode === 'local' || mode === 'cloud-free') && (
            <label className="flex items-start">
              <input
                type="checkbox"
                checked={options.redo_inline_math ?? false}
                onChange={(e) => handleOptionChange('redo_inline_math', e.target.checked)}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                disabled={processing}
              />
              <span className="ml-3">
                <span className="block text-sm font-medium text-gray-900">Format math expressions</span>
                <span className="block text-sm text-gray-500">
                  Apply LaTeX formatting to improve readability
                </span>
              </span>
            </label>
          )}

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
              <span className="block text-sm font-medium text-gray-900">Create image descriptions</span>
              <span className="block text-sm text-gray-500">
                {options.use_llm
                  ? 'Replace images with text descriptions'
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
            disabled={
              processing ||
              files.length === 0 ||
              (mode === 'cloud-paid' && !apiKey.trim()) ||
              ((mode === 'local' || mode === 'cloud-free') && options.use_llm && !geminiApiKey.trim())
            }
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
        {mode === 'cloud-paid' ? (
          <>
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
          </>
        ) : mode === 'cloud-free' ? (
          <>
            <ul className="space-y-2 text-gray-600">
              <li>1. Upload PDF file(s) (up to 200MB per file)</li>
              <li>2. If using LLM enhancement, enter your Gemini API key (optional)</li>
              <li>3. Configure conversion options (all local options available)</li>
              <li>4. Click &quot;Convert to Markdown&quot;</li>
              <li>5. Wait for processing (first request may take 30-60s as server wakes up)</li>
              <li>6. Click &quot;Download&quot; to save your file(s)</li>
            </ul>
            <p className="mt-4 text-sm text-gray-500">
              <strong>Cloud Free Mode:</strong> Uses free GPU processing on HuggingFace Spaces.
              First request after 48 hours may take 30-60 seconds as the server wakes up from sleep.
              Subsequent requests are fast (1-3 seconds per page). Completely free to use!
            </p>
            <p className="mt-2 text-sm text-gray-500">
              <strong>Note:</strong> Batch conversion is not yet supported in Cloud Free mode. Please convert files individually or switch to Cloud (Paid) mode for batch processing.
            </p>
          </>
        ) : (
          <>
            <ul className="space-y-2 text-gray-600">
              <li>1. Set up local Marker instance (requires Python + marker-pdf installation)</li>
              <li>2. If using LLM enhancement, enter your Gemini API key</li>
              <li>3. Upload PDF file(s) or select a folder</li>
              <li>4. Configure conversion options (all options available in local mode)</li>
              <li>5. Click &quot;Convert to Markdown&quot;</li>
              <li>6. Click &quot;Download&quot; to save your file(s)</li>
            </ul>
            <p className="mt-4 text-sm text-gray-500">
              <strong>Local Mode:</strong> Requires a local Marker instance running on http://localhost:8000.
              Provides all conversion options and complete privacy - no data sent to external servers (except Gemini API if using LLM).
              See setup documentation for installation instructions.
            </p>
            <p className="mt-2 text-sm text-gray-500">
              <strong>Note:</strong> Batch conversion is not yet supported in local mode. Please convert files individually or switch to Cloud (Paid) mode for batch processing.
            </p>
          </>
        )}
      </div>
      </div>
    </>
  )
}
