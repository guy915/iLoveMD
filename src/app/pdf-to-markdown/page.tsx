'use client'

import { useState, useEffect, ChangeEvent } from 'react'
import FileUpload from '@/components/common/FileUpload'
import Button from '@/components/common/Button'
import { downloadFile, replaceExtension } from '@/lib/utils/downloadUtils'
import { useLogs } from '@/contexts/LogContext'
import type { MarkerSubmitResponse, MarkerPollResponse, MarkerOptions } from '@/types'

const DEFAULT_OPTIONS: MarkerOptions = {
  paginate: false,
  format_lines: false,
  use_llm: false,
  disable_image_extraction: false,
  output_format: 'markdown',
  langs: 'English'
}

export default function PdfToMarkdownPage() {
  // API key - defaults to test key from env var, not persisted across sessions
  const [apiKey, setApiKey] = useState(process.env.NEXT_PUBLIC_MARKER_TEST_KEY || '')
  const [file, setFile] = useState<File | null>(null)
  const [processing, setProcessing] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  // Options with localStorage persistence
  const [options, setOptions] = useState<MarkerOptions>(DEFAULT_OPTIONS)
  const [hasLoadedOptions, setHasLoadedOptions] = useState(false)

  // Use global logging context (do not destructure clearLogs - we never clear logs)
  const { addLog } = useLogs()

  // Load options from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedOptions = localStorage.getItem('markerOptions')
      if (savedOptions) {
        try {
          const parsed = JSON.parse(savedOptions) as Partial<MarkerOptions>
          // Merge with defaults to handle missing fields from old versions
          const mergedOptions = { ...DEFAULT_OPTIONS, ...parsed }
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

  // Log component mount and API key state
  useEffect(() => {
    const keyPresent = apiKey.length > 0
    const keyLength = apiKey.length

    addLog('info', 'PDF to Markdown page loaded', {
      apiKeyPresent: keyPresent,
      apiKeyLength: keyLength
    })
    // Note: We don't log the actual API key value for security
  }, [addLog, apiKey])

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile)
    setError('')
  }

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
      fileSize: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
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
        fileSize: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
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
      const pollingStartTime = Date.now()

      addLog('info', 'Starting polling for conversion status', {
        checkUrl: checkUrl,
        requestId: submitData.request_id,
        pollInterval: '2 seconds',
        maxDuration: '5 minutes'
      })

      const pollInterval = 2000 // Poll every 2 seconds
      const maxPolls = 150 // 5 minutes max (150 * 2 seconds)
      let pollCount = 0

      const poll = async (): Promise<void> => {
        if (pollCount >= maxPolls) {
          const timeoutDuration = Date.now() - pollingStartTime
          addLog('error', `Polling timeout after ${pollCount} attempts (${(timeoutDuration / 1000).toFixed(1)}s)`)
          throw new Error('Processing timeout. Please try again.')
        }

        pollCount++
        const pollStartTime = Date.now()

        addLog('info', `Poll attempt ${pollCount}/${maxPolls}`, {
          attemptNumber: pollCount,
          elapsedTime: `${((pollStartTime - pollingStartTime) / 1000).toFixed(1)}s`
        })

        const pollResponse = await fetch(
          `/api/marker?checkUrl=${encodeURIComponent(checkUrl || '')}`,
          {
            headers: {
              'x-api-key': apiKey
            }
          }
        )
        const pollDuration = Date.now() - pollStartTime

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

        if (pollData.status === 'complete') {
          const totalConversionTime = Date.now() - conversionStartTime
          const pollingTime = Date.now() - pollingStartTime

          // Download the result
          setStatus('Download starting...')

          addLog('success', `Conversion complete! (${(totalConversionTime / 1000).toFixed(1)}s total)`, {
            totalDuration: `${(totalConversionTime / 1000).toFixed(1)}s`,
            pollingDuration: `${(pollingTime / 1000).toFixed(1)}s`,
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
            sizeKB: `${(content.length / 1024).toFixed(2)}KB`,
            preview: content.substring(0, 200)
          })

          const filename = replaceExtension(file.name, 'md')
          addLog('info', `Triggering file download`, {
            originalFile: file.name,
            outputFile: filename,
            mimeType: 'text/markdown'
          })

          downloadFile(content, filename, 'text/markdown')

          addLog('success', 'File download triggered successfully', {
            filename: filename,
            totalDuration: `${(totalConversionTime / 1000).toFixed(1)}s`
          })

          setStatus('Conversion complete! File downloaded.')
          setProcessing(false)
          setFile(null)

          // Clear status after 3 seconds
          setTimeout(() => setStatus(''), 3000)
        } else {
          // Still processing, poll again
          addLog('info', `Status: ${pollData.status} - Waiting ${pollInterval}ms before next poll`)
          setTimeout(poll, pollInterval)
        }
      }

      await poll()

    } catch (err) {
      const totalDuration = Date.now() - conversionStartTime
      const error = err as Error

      addLog('error', `Conversion failed: ${error.message}`, {
        error: error.message,
        errorType: error.name,
        duration: `${(totalDuration / 1000).toFixed(1)}s`,
        stack: error.stack?.split('\n').slice(0, 3).join('\n') // First 3 lines of stack
      })

      setError(error.message || 'An error occurred during conversion')
      setProcessing(false)
      setStatus('')
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
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Marker API Key
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setApiKey(e.target.value)}
          placeholder="Enter your API key"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={processing}
        />
        <p className="mt-2 text-sm text-gray-500">
          Don&apos;t have an API key?{' '}
          <a
            href="https://www.datalab.to/app/keys"
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
          maxSize={200 * 1024 * 1024} // 200MB
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
                // If disabling LLM, also disable image extraction
                if (!newValue && options.disable_image_extraction) {
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
