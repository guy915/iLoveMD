'use client'

import { useState, useEffect, useRef, useCallback, ChangeEvent } from 'react'
import FileUpload from '@/components/common/FileUpload'
import Button from '@/components/common/Button'
import { downloadFile, replaceExtension } from '@/lib/utils/downloadUtils'
import { formatBytesToMB, formatBytesToKB, formatDuration } from '@/lib/utils/formatUtils'
import { FILE_SIZE, MARKER_CONFIG } from '@/lib/constants'
import { useLogs } from '@/contexts/LogContext'
import type { MarkerSubmitResponse, MarkerPollResponse, MarkerOptions } from '@/types'

export default function PdfToMarkdownPage() {
  // API key - defaults to test key from env var, not persisted across sessions
  const [apiKey, setApiKey] = useState(process.env.NEXT_PUBLIC_MARKER_TEST_KEY || '')
  const [file, setFile] = useState<File | null>(null)
  const [processing, setProcessing] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  // Options with localStorage persistence
  const [options, setOptions] = useState<MarkerOptions>(MARKER_CONFIG.DEFAULT_OPTIONS)
  const [hasLoadedOptions, setHasLoadedOptions] = useState(false)

  // Use global logging context (do not destructure clearLogs - we never clear logs)
  const { addLog } = useLogs()

  // Refs for cleanup and memory leak prevention
  const isMountedRef = useRef(true)
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Cleanup on unmount to prevent memory leaks
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current)
        pollTimeoutRef.current = null
      }
    }
  }, [])

  // Load options from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedOptions = localStorage.getItem('markerOptions')
      if (savedOptions) {
        try {
          const parsed = JSON.parse(savedOptions) as Partial<MarkerOptions>
          // Merge with defaults to handle missing fields from old versions
          const mergedOptions = { ...MARKER_CONFIG.DEFAULT_OPTIONS, ...parsed }
          setOptions(mergedOptions)
          addLog('info', 'Loaded saved options from localStorage', { options: mergedOptions })
        } catch (err) {
          addLog('error', 'Failed to parse saved options, using defaults', { error: String(err) })
        }
      }
      setHasLoadedOptions(true)
    }
  }, [addLog])

  // Save options to localStorage whenever they change (after initial load)
  useEffect(() => {
    if (typeof window !== 'undefined' && hasLoadedOptions) {
      localStorage.setItem('markerOptions', JSON.stringify(options))
    }
  }, [options, hasLoadedOptions])

  const handleOptionChange = (key: keyof MarkerOptions, value: boolean | string) => {
    setOptions(prev => {
      const newOptions = { ...prev, [key]: value }
      addLog('info', `Option changed: ${key}`, { newValue: value, allOptions: newOptions })
      return newOptions
    })
  }

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
  }, [])

  const handleConvert = async () => {
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
      timestamp: new Date().toISOString()
    })

    try {
      // Submit file to our API route
      const formData = new FormData()
      formData.append('file', file)
      formData.append('apiKey', apiKey)
      formData.append('options', JSON.stringify(options))

      addLog('info', 'Submitting to Marker API via /api/marker endpoint', {
        endpoint: '/api/marker',
        method: 'POST',
        fileSize: formatBytesToMB(file.size),
        options: options
      })

      const submitStartTime = Date.now()
      const submitResponse = await fetch('/api/marker', {
        method: 'POST',
        body: formData,
      })
      const submitDuration = Date.now() - submitStartTime

      const submitData = await submitResponse.json() as MarkerSubmitResponse

      addLog('success', `Submit response received (${submitDuration}ms)`, {
        status: submitResponse.status,
        statusText: submitResponse.ok ? 'OK' : 'Error',
        duration: `${submitDuration}ms`,
        responseKeys: Object.keys(submitData)
      })

      if (!submitResponse.ok || !submitData.success) {
        addLog('error', 'Submission failed', {
          error: submitData.error,
          details: submitData.details
        })
        throw new Error(submitData.error || 'Failed to submit file')
      }

      // Start polling for results
      setStatus('Processing PDF... This may take a minute.')
      const checkUrl = submitData.request_check_url

      // Validate checkUrl exists
      if (!checkUrl) {
        addLog('error', 'No status check URL returned from API')
        throw new Error('No status check URL returned from API')
      }

      const pollingStartTime = Date.now()

      addLog('info', 'Starting polling for conversion status', {
        checkUrl: checkUrl,
        requestId: submitData.request_id,
        pollInterval: `${MARKER_CONFIG.POLL_INTERVAL_MS}ms`,
        maxDuration: `${MARKER_CONFIG.MAX_POLL_ATTEMPTS * MARKER_CONFIG.POLL_INTERVAL_MS / 1000}s`
      })

      let pollCount = 0

      const poll = async (): Promise<void> => {
        // Check if component is still mounted
        if (!isMountedRef.current) {
          addLog('info', 'Component unmounted, stopping polling')
          return
        }

        if (pollCount >= MARKER_CONFIG.MAX_POLL_ATTEMPTS) {
          const timeoutDuration = Date.now() - pollingStartTime
          addLog('error', `Polling timeout after ${pollCount} attempts (${formatDuration(timeoutDuration)})`)
          throw new Error('Processing timeout. Please try again.')
        }

        pollCount++
        const pollStartTime = Date.now()

        addLog('info', `Poll attempt ${pollCount}/${MARKER_CONFIG.MAX_POLL_ATTEMPTS}`, {
          attemptNumber: pollCount,
          elapsedTime: formatDuration(pollStartTime - pollingStartTime)
        })

        const pollResponse = await fetch(
          `/api/marker?checkUrl=${encodeURIComponent(checkUrl)}`,
          {
            headers: {
              'x-api-key': apiKey
            }
          }
        )
        const pollDuration = Date.now() - pollStartTime

        // Check again after async operation
        if (!isMountedRef.current) {
          addLog('info', 'Component unmounted during polling, aborting')
          return
        }

        const pollData = await pollResponse.json() as MarkerPollResponse

        addLog('info', `Poll response received (${pollDuration}ms)`, {
          status: pollData.status,
          httpStatus: pollResponse.status,
          duration: `${pollDuration}ms`,
          attemptNumber: pollCount
        })

        if (!pollResponse.ok || !pollData.success) {
          throw new Error(pollData.error || 'Failed to check status')
        }

        // Check for error status from API
        if (pollData.status === 'error') {
          const totalConversionTime = Date.now() - conversionStartTime
          addLog('error', 'Conversion failed on server', {
            status: pollData.status,
            totalDuration: `${(totalConversionTime / 1000).toFixed(1)}s`,
            pollAttempts: pollCount,
            response: pollData
          })
          throw new Error('The Marker API reported an error during conversion. Please try again.')
        }

        if (pollData.status === 'complete') {
          const totalConversionTime = Date.now() - conversionStartTime
          const pollingTime = Date.now() - pollingStartTime

          // Download the result
          setStatus('Download starting...')

          addLog('success', `Conversion complete! (${formatDuration(totalConversionTime)} total)`, {
            totalDuration: formatDuration(totalConversionTime),
            pollingDuration: formatDuration(pollingTime),
            pollAttempts: pollCount
          })

          // Log what we received
          addLog('info', 'API response structure', {
            fields: Object.keys(pollData),
            status: pollData.status
          })

          // Get the content (field name is 'markdown' regardless of output format)
          const content = pollData.markdown

          if (!content) {
            addLog('error', 'No content in response!', {
              receivedFields: Object.keys(pollData),
              status: pollData.status
            })
            throw new Error('No content received from API')
          }

          addLog('info', 'Markdown content received', {
            length: `${content.length} characters`,
            sizeKB: formatBytesToKB(content.length),
            preview: content.substring(0, 200)
          })

          const filename = replaceExtension(file.name, 'md')
          addLog('info', `Triggering file download`, {
            originalFile: file.name,
            outputFile: filename,
            mimeType: 'text/markdown'
          })

          try {
            downloadFile(content, filename, 'text/markdown')
            addLog('success', 'File download triggered successfully', {
              filename: filename,
              totalDuration: formatDuration(totalConversionTime)
            })
          } catch (downloadError) {
            const errorMsg = downloadError instanceof Error ? downloadError.message : String(downloadError)
            addLog('error', 'File download failed', {
              error: errorMsg,
              filename: filename
            })
            throw new Error(`Download failed: ${errorMsg}`)
          }

          // Only update state if component is still mounted
          if (isMountedRef.current) {
            setStatus('Conversion complete! File downloaded.')
            setProcessing(false)
            setFile(null)

            // Clear status after 3 seconds
            setTimeout(() => {
              if (isMountedRef.current) {
                setStatus('')
              }
            }, 3000)
          }
        } else {
          // Still processing, poll again
          addLog('info', `Status: ${pollData.status} - Waiting ${MARKER_CONFIG.POLL_INTERVAL_MS}ms before next poll`)
          pollTimeoutRef.current = setTimeout(poll, MARKER_CONFIG.POLL_INTERVAL_MS)
        }
      }

      await poll()

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
    }
  }

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
          key={file?.name || 'empty'} // Force remount when file changes to clear state
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

      {/* Convert Button */}
      <div className="flex justify-center">
        <Button
          onClick={handleConvert}
          disabled={processing || !file || !apiKey.trim()}
          loading={processing}
          variant="primary"
        >
          {processing ? 'Converting...' : 'Convert to Markdown'}
        </Button>
      </div>

      {/* Info Section */}
      <div className="mt-12 bg-gray-50 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          How it works
        </h2>
        <ul className="space-y-2 text-gray-600">
          <li>1. Enter your Marker API key (test key provided by default)</li>
          <li>2. Upload a PDF file (up to 200MB)</li>
          <li>3. Click &quot;Convert to Markdown&quot;</li>
          <li>4. Wait for processing (usually 30-60 seconds)</li>
          <li>5. Your markdown file will download automatically</li>
        </ul>
        <p className="mt-4 text-sm text-gray-500">
          Note: API keys are not saved between sessions. Your files are never stored on our servers - processing happens through the Marker API.
        </p>
      </div>
    </div>
  )
}
