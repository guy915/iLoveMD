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

export default function PdfToMarkdownPage() {
  // API key - defaults to test key, not persisted across sessions
  const [apiKey, setApiKey] = useState('w4IU5bCYNudH_JZ0IKCUIZAo8ive3gc6ZPk6mzLtqxQ')
  const [file, setFile] = useState<File | null>(null)
  const [processing, setProcessing] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [convertedMarkdown, setConvertedMarkdown] = useState<string | null>(null)
  const [outputFilename, setOutputFilename] = useState<string | null>(null)

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

  const handleFileSelect = useCallback((selectedFile: File) => {
    setFile(selectedFile)
    setError('')
    // Clear previous conversion result when new file is selected
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
      // Create abort controller for cancellation support
      abortControllerRef.current = new AbortController()

      // Progress callback for status updates
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

      // Use service to handle conversion
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

      // Success - store the result for download
      const filename = replaceExtension(file.name, 'md')

      addLog('success', `Conversion complete! (${formatDuration(totalConversionTime)} total)`, {
        totalDuration: formatDuration(totalConversionTime),
        contentLength: `${result.markdown.length} characters`,
        contentSizeKB: formatBytesToKB(result.markdown.length),
        outputFile: filename
      })

      // Only update state if component is still mounted
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
        stack: error.stack?.split('\n').slice(0, 3).join('\n') // First 3 lines of stack
      })

      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setError(error.message || 'An error occurred during conversion')
        setProcessing(false)
        setStatus('')
      }
    } finally {
      // Cleanup abort controller
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

          // Clear status message after 3 seconds, but keep download button available
          if (statusTimeoutRef.current) {
            clearTimeout(statusTimeoutRef.current)
          }
          statusTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              setStatus('')
            }
            statusTimeoutRef.current = null
          }, 3000)

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

        // Clear status message after 3 seconds, but keep download button available
        if (statusTimeoutRef.current) {
          clearTimeout(statusTimeoutRef.current)
        }
        statusTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            setStatus('')
          }
          statusTimeoutRef.current = null
        }, 3000)
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
        <FileUpload
          accept=".pdf,application/pdf"
          onFileSelect={handleFileSelect}
          maxSize={FILE_SIZE.MAX_PDF_FILE_SIZE}
        />
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
        {/* Convert Button - show when no conversion result or after download complete */}
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

        {/* Download Button - show when conversion is complete */}
        {convertedMarkdown && (
          <Button
            onClick={handleDownload}
            variant="primary"
          >
            Download
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
          <li>2. Upload a PDF file (up to 200MB)</li>
          <li>3. Configure conversion options (optional)</li>
          <li>4. Click &quot;Convert to Markdown&quot;</li>
          <li>5. Wait for processing (usually 30-60 seconds)</li>
          <li>6. Click &quot;Download&quot; to save the file</li>
        </ul>
        <p className="mt-4 text-sm text-gray-500">
          Note: API keys are not saved between sessions. Your files are never stored on our servers - processing happens through the Marker API. On modern browsers (Chrome/Edge), you&apos;ll get a save dialog to choose where to save the file.
        </p>
      </div>
    </div>
  )
}
