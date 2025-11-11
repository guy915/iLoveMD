'use client'

import { useState } from 'react'
import FileUpload from '@/components/common/FileUpload'
import Button from '@/components/common/Button'
import useLocalStorage from '@/hooks/useLocalStorage'
import { downloadFile, replaceExtension } from '@/lib/utils/downloadUtils'

export default function PdfToMarkdownPage() {
  const [apiKey, setApiKey] = useLocalStorage('markerApiKey', '')
  const [file, setFile] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  const handleFileSelect = (selectedFile) => {
    setFile(selectedFile)
    setError('')
  }

  const handleConvert = async () => {
    if (!apiKey.trim()) {
      setError('Please enter your API key')
      return
    }

    if (!file) {
      setError('Please select a PDF file')
      return
    }

    setProcessing(true)
    setError('')
    setStatus('Submitting to Marker API...')

    try {
      // Submit file to our API route
      const formData = new FormData()
      formData.append('file', file)
      formData.append('apiKey', apiKey)

      const submitResponse = await fetch('/api/marker', {
        method: 'POST',
        body: formData,
      })

      const submitData = await submitResponse.json()

      if (!submitResponse.ok || !submitData.success) {
        throw new Error(submitData.error || 'Failed to submit file')
      }

      // Start polling for results
      setStatus('Processing PDF... This may take a minute.')
      const checkUrl = submitData.request_check_url

      const pollInterval = 2000 // Poll every 2 seconds
      const maxPolls = 150 // 5 minutes max (150 * 2 seconds)
      let pollCount = 0

      const poll = async () => {
        if (pollCount >= maxPolls) {
          throw new Error('Processing timeout. Please try again.')
        }

        pollCount++

        const pollResponse = await fetch(
          `/api/marker?checkUrl=${encodeURIComponent(checkUrl)}`,
          {
            headers: {
              'x-api-key': apiKey
            }
          }
        )

        const pollData = await pollResponse.json()

        if (!pollResponse.ok || !pollData.success) {
          throw new Error(pollData.error || 'Failed to check status')
        }

        if (pollData.status === 'complete') {
          // Download the result
          setStatus('Download starting...')
          const markdown = pollData.markdown
          const filename = replaceExtension(file.name, 'md')
          downloadFile(markdown, filename, 'text/markdown')

          setStatus('Conversion complete! File downloaded.')
          setProcessing(false)
          setFile(null)

          // Clear status after 3 seconds
          setTimeout(() => setStatus(''), 3000)
        } else {
          // Still processing, poll again
          setTimeout(poll, pollInterval)
        }
      }

      await poll()

    } catch (err) {
      console.error('Conversion error:', err)
      setError(err.message || 'An error occurred during conversion')
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
          onChange={(e) => setApiKey(e.target.value)}
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
          disabled={processing}
        />
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
          <li>1. Enter your Marker API key (saved locally in your browser)</li>
          <li>2. Upload a PDF file (up to 200MB)</li>
          <li>3. Click &quot;Convert to Markdown&quot;</li>
          <li>4. Wait for processing (usually 30-60 seconds)</li>
          <li>5. Your markdown file will download automatically</li>
        </ul>
        <p className="mt-4 text-sm text-gray-500">
          Note: Your API key and files are never stored on our servers. Processing happens through the Marker API.
        </p>
      </div>
    </div>
  )
}
