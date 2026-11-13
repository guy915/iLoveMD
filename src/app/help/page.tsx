import type { Metadata } from 'next'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Help',
  description: 'Answers to common questions about converting PDF to Markdown and merging Markdown files with iLoveMD.',
  alternates: {
    canonical: '/help',
  },
  openGraph: {
    title: 'iLoveMD Help & FAQ',
    description: 'Answers to common questions about converting PDF to Markdown and merging Markdown files.',
    url: '/help',
    // Setting openGraph here replaces the root one, so repeat the shared preview image
    images: ['/opengraph-image'],
    siteName: 'iLoveMD',
    type: 'website',
  },
}

export const metadata: Metadata = {
  title: 'Help & Support',
  description: 'Answers to common questions and troubleshooting tips for iLoveMD.',
}

/**
 * Help page with FAQs and troubleshooting
 */
export default function Help() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-4">Help & Support</h1>
        <p className="text-xl text-gray-600">
          Find answers to common questions and troubleshooting tips
        </p>
      </div>

      {/* Getting Started */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Getting Started</h2>

        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              What is iLoveMD?
            </h3>
            <p className="text-gray-600">
              iLoveMD is a web application that provides markdown utilities. It converts PDFs to clean
              markdown, and lets you merge multiple markdown files together. All tools
              are designed to be simple, fast, and privacy-focused.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Do I need an API key?
            </h3>
            <p className="text-gray-600 mb-3">
              No. Free mode works without any key. A free Gemini API key is only needed if you turn on
              LLM enhancement in Free mode. Paid (fast) mode needs a Marker API key:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-gray-600">
              <li>Visit <a href="https://www.datalab.to/" target="_blank" rel="noopener noreferrer" className="text-primary-600 underline hover:text-primary-700">datalab.to</a></li>
              <li>Sign up for a free account</li>
              <li>Navigate to the API section</li>
              <li>Copy your API key</li>
              <li>Paste it into the API key field in our PDF tool</li>
            </ol>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Is my data safe?
            </h3>
            <p className="text-gray-600">
              Your API keys are saved only in your browser (localStorage). When you convert a PDF, the file and
              any key you entered pass through our server to the conversion service (our free converter, or the
              Marker API in Paid mode) and are not stored. The Merge tool runs entirely in your browser.
            </p>
          </div>
        </div>
      </section>

      {/* Troubleshooting */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Troubleshooting</h2>

        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              &quot;Invalid API key&quot; error
            </h3>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>Verify your Marker API key at <a href="https://www.datalab.to/" target="_blank" rel="noopener noreferrer" className="text-primary-600 underline hover:text-primary-700">datalab.to</a></li>
              <li>Make sure you copied the entire key</li>
              <li>Check that your key has remaining credits</li>
            </ul>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              &quot;File too large&quot; error
            </h3>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>Maximum PDF file size is 200MB (Marker API limit)</li>
              <li>Try splitting large PDFs before conversion</li>
              <li>Compress your PDF if possible</li>
            </ul>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Processing takes too long
            </h3>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>Large files can take several minutes to process</li>
              <li>Check your internet connection</li>
              <li>Ensure the Marker API service is online</li>
              <li>Check the diagnostic logs for error details</li>
            </ul>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Download not working
            </h3>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>Check browser download settings</li>
              <li>Ensure pop-ups aren&apos;t blocked</li>
              <li>Try a different browser</li>
              <li>Check available disk space</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Diagnostic Logs */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Using Diagnostic Logs</h2>

        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600 mb-4">
            iLoveMD includes a comprehensive diagnostic logging system to help troubleshoot issues:
          </p>
          <ul className="list-disc list-inside space-y-2 text-gray-600">
            <li>Click &quot;Logs&quot; in the header to view all application events</li>
            <li>Logs include file uploads, API calls, errors, and performance metrics</li>
            <li>Copy logs to share when reporting issues</li>
            <li>Logs persist across page navigation</li>
            <li>Click &quot;Clear&quot; to reset the logs</li>
          </ul>
        </div>
      </section>

      {/* Contact */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Need More Help?</h2>

        <div className="bg-primary-50 rounded-lg p-6">
          <p className="text-gray-700 mb-4">
            If you&apos;re still experiencing issues, you can:
          </p>
          <ul className="space-y-2 text-gray-700">
            <li className="flex items-start">
              <span className="text-primary-600 mr-2">•</span>
              <span>Check the <Link href="/about" className="text-primary-600 underline hover:text-primary-700">About page</Link> for more information</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary-600 mr-2">•</span>
              <span>Copy your diagnostic logs for detailed error information</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary-600 mr-2">•</span>
              <span>Visit the <a href="https://github.com/guy915/iLoveMD" target="_blank" rel="noopener noreferrer" className="text-primary-600 underline hover:text-primary-700">project repository</a> for updates and known issues</span>
            </li>
          </ul>
        </div>
      </section>

      <div className="text-center">
        <Link
          href="/"
          className="inline-block px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
        >
          Back to Home
        </Link>
      </div>
    </div>
  )
}
