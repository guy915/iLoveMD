'use client'

import { useState, useEffect, useRef, useCallback, ChangeEvent } from 'react'
import Button from '@/components/common/Button'
import { downloadFile, replaceExtension } from '@/lib/utils/downloadUtils'
import { formatBytesToMB, formatBytesToKB, formatDuration } from '@/lib/utils/formatUtils'
import type { MarkerOptions } from '@/types'
import { MARKER_CONFIG, STORAGE_KEYS, FILE_SIZE } from '@/lib/constants'
import * as storageService from '@/lib/services/storageService'
import { convertPdfToMarkdown, convertPdfToMarkdownLocal } from '@/lib/services/markerApiService'
import { filterPdfFiles, filterImmediateFolderFiles, getFolderName, type BatchProgress } from '@/lib/services/batchConversionService'
import { useLogs } from '@/contexts/LogContext'

export default function PdfToMarkdownPage() {
  // Mode state - 'paid' uses Marker API, 'free' uses Modal serverless GPU
  // Start with 'free' to match SSR, then load from localStorage after mount
  const [mode, setMode] = useState<'free' | 'paid'>('free')
  const [mounted, setMounted] = useState(false)

  // API keys
  const [apiKey, setApiKey] = useState('') // Marker API key (paid mode)
  const [geminiApiKey, setGeminiApiKey] = useState('') // Gemini API key (free mode with LLM)

  // File state - supports both single and batch
  const [files, setFiles] = useState<File[]>([])
  const [folderName, setFolderName] = useState<string | null>(null)
  // Map from original file to unique output filename (for handling duplicates)
  const [filenameMap, setFilenameMap] = useState<Map<File, string>>(new Map())

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

  // Load mode and API keys from localStorage on mount
  useEffect(() => {
    setMounted(true)

    const savedMode = storageService.getItem(STORAGE_KEYS.MARKER_MODE) as 'free' | 'paid' | 'local' | 'cloud' | null
    // Support old mode names for backwards compatibility
    if (savedMode === 'free' || savedMode === 'paid') {
      setMode(savedMode)
    } else if (savedMode === 'local') {
      setMode('free') // Old 'local' → new 'free'
    } else if (savedMode === 'cloud') {
      setMode('paid') // Old 'cloud' → new 'paid'
    }

    const savedMarkerKey = storageService.getItem(STORAGE_KEYS.MARKER_API_KEY)
    // One-time migration: Remove old test key if found
    const OLD_TEST_KEY = 'w4IU5bCYNudH_JZ0IKCUIZAo8ive3gc6ZPk6mzLtqxQ'
    if (savedMarkerKey === OLD_TEST_KEY) {
      storageService.removeItem(STORAGE_KEYS.MARKER_API_KEY)
      addLog('info', 'Removed old test API key from localStorage')
    } else if (savedMarkerKey) {
      setApiKey(savedMarkerKey)
      addLog('info', 'Loaded saved Marker API key from localStorage')
    }

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

  // Save mode to localStorage whenever it changes (only after mount)
  useEffect(() => {
    if (mounted) {
      storageService.setItem(STORAGE_KEYS.MARKER_MODE, mode)
    }
  }, [mode, mounted])

  // Save Marker API key to localStorage whenever it changes
  useEffect(() => {
    if (hasLoadedOptions) {
      storageService.setItem(STORAGE_KEYS.MARKER_API_KEY, apiKey)
    }
  }, [apiKey, hasLoadedOptions])

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

  /**
   * Generate unique output filename for a file, handling duplicates with numerical suffixes
   * Example: "file.pdf" → "file.md", second "file.pdf" → "file (1).md"
   */
  const generateUniqueFilename = useCallback((
    file: File,
    existingMap: Map<File, string>
  ): string => {
    const baseName = file.name.replace(/\.pdf$/i, '')
    let outputName = `${baseName}.md`

    // Check if this exact filename is already used
    const usedNames = new Set(Array.from(existingMap.values()))

    if (!usedNames.has(outputName)) {
      return outputName
    }

    // Find next available number
    let counter = 1
    while (usedNames.has(`${baseName} (${counter}).md`)) {
      counter++
    }

    return `${baseName} (${counter}).md`
  }, [])

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

    // Accumulate ALL files - allow duplicates by name
    // Generate unique output filenames with numerical suffixes for duplicates
    const allFiles = [...files, ...pdfFiles]
    const newMap = new Map(filenameMap)

    // Generate unique names for new files
    for (const file of pdfFiles) {
      const uniqueName = generateUniqueFilename(file, newMap)
      newMap.set(file, uniqueName)

      // Log if file was renamed (has numerical suffix)
      if (uniqueName !== file.name.replace(/\.pdf$/i, '.md')) {
        addLog('info', `Renamed duplicate file: "${file.name}" → "${uniqueName}"`)
      }
    }

    // Update both states
    setFiles(allFiles)
    setFilenameMap(newMap)

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
  }, [addLog, files, filenameMap, generateUniqueFilename])

  const handleClearFiles = useCallback(() => {
    setFiles([])
    setFolderName(null)
    setFilenameMap(new Map())
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
    if (mode === 'paid') {
      // Validate Marker API key for paid mode
      if (!apiKey.trim()) {
        setError('Please enter your Marker API key')
        addLog('error', 'Conversion blocked: No Marker API key provided')
        return
      }
    } else if (mode === 'free') {
      // Validate Gemini API key for free mode with LLM
      if (options.use_llm && !geminiApiKey.trim()) {
        setError('Please enter your Gemini API key to use LLM enhancement in free mode')
        addLog('error', 'Conversion blocked: No Gemini API key provided for free LLM mode')
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
        if (mode === 'free') {
          // Free mode: use batch service with parallel processing (up to 10 concurrent)
          setStatus('Uploading...')

          // Dynamically import batch service with error handling
          let convertBatchPdfToMarkdownLocal: typeof import('@/lib/services/batchConversionService').convertBatchPdfToMarkdownLocal
          try {
            const batchModule = await import('@/lib/services/batchConversionService')
            convertBatchPdfToMarkdownLocal = batchModule.convertBatchPdfToMarkdownLocal
          } catch (importError) {
            addLog('error', 'Failed to load batch conversion module', {
              error: importError instanceof Error ? importError.message : String(importError)
            })
            throw new Error('Failed to load required conversion module. Please refresh and try again.')
          }

          const result = await convertBatchPdfToMarkdownLocal(files, {
            geminiApiKey: options.use_llm ? geminiApiKey : null,
            markerOptions: options,
            filenameMap: filenameMap,
            onProgress: (progress: BatchProgress) => {
              if (isMountedRef.current) {
                setBatchProgress(progress)
                setStatus(`Processing... ${progress.completed}/${progress.total} complete (${progress.inProgress} in progress)`)
              }
            },
            signal: abortControllerRef.current.signal
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

          addLog('success', `Batch conversion complete!`, {
            completed: result.completed.length,
            failed: result.failed.length,
            zipName
          })

          if (isMountedRef.current) {
            setBatchZipBlob(result.zipBlob)
            setBatchZipFilename(zipName)
            setStatus(`Conversion complete! ${result.completed.length}/${files.length} files converted.`)
            setProcessing(false)
          }
        } else {
          // Paid mode - use batch service
          setStatus('Uploading...')

          // Dynamically import batch service with error handling
          let convertBatchPdfToMarkdown: typeof import('@/lib/services/batchConversionService').convertBatchPdfToMarkdown
          try {
            const batchModule = await import('@/lib/services/batchConversionService')
            convertBatchPdfToMarkdown = batchModule.convertBatchPdfToMarkdown
          } catch (importError) {
            addLog('error', 'Failed to load batch conversion module', {
              error: importError instanceof Error ? importError.message : String(importError)
            })
            throw new Error('Failed to load required conversion module. Please refresh and try again.')
          }

          const result = await convertBatchPdfToMarkdown(files, {
            apiKey,
            markerOptions: options,
            filenameMap: filenameMap,
            onProgress: (progress: BatchProgress) => {
              if (isMountedRef.current) {
                setBatchProgress(progress)
                setStatus(`Processing... ${progress.completed}/${progress.total} complete`)
              }
            },
            signal: abortControllerRef.current.signal
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
        }

      } else {
        // Single file conversion
        const file = files[0]
        setStatus('Uploading...')

        const onProgress = (status: string, attemptNumber: number, elapsedSeconds: number) => {
          if (!isMountedRef.current) return
          const maxAttempts = MARKER_CONFIG.POLLING.MAX_ATTEMPTS
          setStatus(`Processing...`)
        }

        // Call appropriate conversion function based on mode
        const result = mode === 'paid'
          ? await convertPdfToMarkdown(
              file,
              apiKey,
              options,
              onProgress,
              abortControllerRef.current.signal
            )
          : await convertPdfToMarkdownLocal(
              file,
              options.use_llm ? geminiApiKey : null,
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
          filename,
          mode
        })

        if (isMountedRef.current) {
          setConvertedMarkdown(result.markdown)
          setOutputFilename(filename)
          setStatus('Conversion complete!')
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
  }, [apiKey, geminiApiKey, files, options, isBatch, folderName, mode, filenameMap, addLog])

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

          // Write with error handling for large files/memory issues
          try {
            await writable.write(convertedMarkdown)
            await writable.close()
          } catch (writeError) {
            // Attempt to close writable even if write failed
            try {
              await writable.close()
            } catch {
              // Ignore close errors
            }
            throw writeError
          }

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
          // Check for quota/space errors
          if (apiError.name === 'QuotaExceededError' || apiError.message?.toLowerCase().includes('quota')) {
            addLog('error', 'Insufficient disk space to save file')
            throw new Error('Insufficient disk space. Please free up space and try again.')
          }
          throw apiError
        }
      } else {
        // Fallback to traditional download for browsers without File System Access API
        addLog('info', 'Using traditional download method (File System Access API not available)')

        // Wrap download in try-catch to handle out-of-memory errors
        try {
          downloadFile(convertedMarkdown, outputFilename, 'text/markdown')
          addLog('success', 'File download triggered', {
            filename: outputFilename
          })
          setStatus('File download started! Check your downloads folder. You can download again or upload a new file.')
        } catch (downloadError) {
          // Check if it's an out-of-memory error
          if (downloadError instanceof Error &&
              (downloadError.message?.toLowerCase().includes('memory') || downloadError.message?.toLowerCase().includes('allocation'))) {
            addLog('error', 'Out of memory while creating download')
            throw new Error('File too large for browser memory. Try using a different browser or splitting the PDF.')
          }
          throw downloadError
        }
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

          // Write with error handling for large files/memory issues
          try {
            await writable.write(batchZipBlob)
            await writable.close()
          } catch (writeError) {
            // Attempt to close writable even if write failed
            try {
              await writable.close()
            } catch {
              // Ignore close errors
            }
            throw writeError
          }

          addLog('success', 'ZIP saved successfully', { filename: batchZipFilename })
          setStatus('ZIP saved successfully!')

        } catch (apiError: any) {
          if (apiError.name === 'AbortError') {
            addLog('info', 'User cancelled save dialog')
            return
          }
          // Check for quota/space errors
          if (apiError.name === 'QuotaExceededError' || apiError.message?.toLowerCase().includes('quota')) {
            addLog('error', 'Insufficient disk space to save ZIP')
            throw new Error('Insufficient disk space. Please free up space and try again.')
          }
          throw apiError
        }
      } else {
        addLog('info', 'Using traditional download for ZIP')

        // Wrap download in try-catch to handle out-of-memory errors
        try {
          downloadFile(batchZipBlob, batchZipFilename, 'application/zip')
          addLog('success', 'ZIP download triggered', { filename: batchZipFilename })
          setStatus('ZIP download started!')
        } catch (downloadError) {
          // Check if it's an out-of-memory error
          if (downloadError instanceof Error &&
              (downloadError.message?.toLowerCase().includes('memory') || downloadError.message?.toLowerCase().includes('allocation'))) {
            addLog('error', 'Out of memory while creating ZIP download')
            throw new Error('ZIP file too large for browser memory. Try downloading fewer files at once.')
          }
          throw downloadError
        }
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
          Convert PDF files into clean Markdown
        </p>
      </div>

      {/* Mode Toggle Section - Only show after mounted to prevent flicker */}
      {mounted && (
        <>
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Conversion Mode</h2>
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  setMode('free')
                  addLog('info', 'Switched to Free mode (Modal GPU)')
                }}
                disabled={processing}
                className={`flex-1 px-6 py-3 rounded-lg font-medium transition-colors ${
                  mode === 'free'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                } ${processing ? 'opacity-50 cursor-not-allowed' : ''}`}
                aria-pressed={mode === 'free'}
              >
                <div className="flex flex-col items-center">
                  <span className="font-semibold">Free</span>
                  <span className="text-xs opacity-90">(Slow)</span>
                </div>
              </button>
              <button
                onClick={() => {
                  setMode('paid')
                  addLog('info', 'Switched to Paid mode (Marker API)')
                }}
                disabled={processing}
                className={`flex-1 px-6 py-3 rounded-lg font-medium transition-colors ${
                  mode === 'paid'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                } ${processing ? 'opacity-50 cursor-not-allowed' : ''}`}
                aria-pressed={mode === 'paid'}
              >
                <div className="flex flex-col items-center">
                  <span className="font-semibold">Paid</span>
                  <span className="text-xs opacity-90">(Fast)</span>
                </div>
              </button>
            </div>
            <p className="mt-3 text-sm text-gray-600">
              {mode === 'free'
                ? 'Free cloud processing (~a few minutes per PDF)'
                : 'Marker API (~a few seconds per PDF, requires API key)'}
            </p>
          </div>

          {/* API Key Section - Paid Mode */}
          {mode === 'paid' && (
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
            {' '}($5 free credits available)
          </p>
        </div>
      )}

      {/* Gemini API Key Section - Free Mode */}
      {mode === 'free' && (
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
                Don&apos;t have an API key?{' '}
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700 underline"
                >
                  Get a free one here
                </a>
              </>
            ) : (
              'Enable "Use LLM enhancement" to activate this field'
            )}
          </p>
        </div>
      )}
        </>
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
                Select entire folders
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

          {/* Local mode only options */}
          {mode === 'free' && (
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
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {processing && (
                <span className="text-blue-600 animate-spin text-2xl">⟳</span>
              )}
              <p className="text-base font-semibold text-gray-900">
                {status || 'Converting to Markdown...'}
              </p>
            </div>
            {processing && (
              <button
                onClick={() => {
                  if (abortControllerRef.current) {
                    abortControllerRef.current.abort()
                    setStatus('Cancelling...')
                    setProcessing(false)
                  }
                }}
                className="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {/* Batch Progress - unified for processing and completion */}
      {isBatch && (processing || status) && (
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {processing && (
                <span className="text-blue-600 animate-spin text-2xl">⟳</span>
              )}
              <p className="text-base font-semibold text-gray-900">
                {batchProgress && processing
                  ? `Processing ${batchProgress.completed}/${batchProgress.total} files...`
                  : status}
              </p>
            </div>
            {processing && (
              <button
                onClick={() => {
                  if (abortControllerRef.current) {
                    abortControllerRef.current.abort()
                    setStatus('Cancelling...')
                    setProcessing(false)
                  }
                }}
                className="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
              >
                Cancel
              </button>
            )}
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
              (mode === 'paid' && !apiKey.trim()) ||
              (mode === 'free' && options.use_llm && !geminiApiKey.trim())
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
            Download
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
      </div>
    </>
  )
}
