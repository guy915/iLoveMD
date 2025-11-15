import Link from 'next/link'

/**
 * Help page with FAQs and troubleshooting
 */
export default function Help() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Help & Support</h1>
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
              What is iLoveLLM?
            </h3>
            <p className="text-gray-600">
              iLoveLLM is a web application that helps you prepare documents for Large Language Models (LLMs)
              like ChatGPT and Claude. It converts PDFs, HTML, and other formats to clean markdown that LLMs can
              easily process.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              How do I get a Marker API key?
            </h3>
            <p className="text-gray-600 mb-3">
              To use the PDF to Markdown tool, you need a Marker API key:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-gray-600">
              <li>Visit <a href="https://www.datalab.to/" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">datalab.to</a></li>
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
              Yes! Your API keys are stored locally in your browser using localStorage. We never send your API keys
              to our servers. Files are processed either client-side (HTML, Merge tools) or sent directly to the
              Marker API (PDF tool) without being stored on our servers.
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
              <li>Verify your Marker API key at <a href="https://www.datalab.to/" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">datalab.to</a></li>
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
            iLoveLLM includes a comprehensive diagnostic logging system to help troubleshoot issues:
          </p>
          <ul className="list-disc list-inside space-y-2 text-gray-600">
            <li>Click &quot;Diagnostic Logs&quot; in the header to view all application events</li>
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
              <span>Check the <Link href="/about" className="text-primary-600 hover:underline">About page</Link> for more information</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary-600 mr-2">•</span>
              <span>Copy your diagnostic logs for detailed error information</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary-600 mr-2">•</span>
              <span>Visit the project repository for updates and known issues</span>
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
