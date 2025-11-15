import Link from 'next/link'

/**
 * HTML to Markdown converter page (placeholder)
 * Coming soon: Convert HTML files and web pages to markdown
 */
export default function HtmlToMarkdown() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="mb-6">
          <div className="inline-block p-4 bg-primary-100 rounded-full mb-4">
            <svg className="w-16 h-16 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
          </div>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          HTML to Markdown
        </h1>

        <div className="inline-block px-4 py-2 bg-yellow-100 text-yellow-800 rounded-full text-sm font-semibold mb-6">
          Coming Soon
        </div>

        <p className="text-gray-600 mb-8">
          This tool will allow you to convert HTML files and web pages to clean markdown format,
          optimized for LLMs and RAG workflows.
        </p>

        <div className="bg-gray-50 rounded-lg p-6 mb-8 text-left">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Planned Features:</h2>
          <ul className="space-y-2 text-gray-600">
            <li className="flex items-start">
              <span className="text-primary-600 mr-2">•</span>
              <span>Upload HTML files or paste URLs</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary-600 mr-2">•</span>
              <span>Client-side processing (no server uploads)</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary-600 mr-2">•</span>
              <span>Automatic content extraction and cleanup</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary-600 mr-2">•</span>
              <span>Preserve images and links (optional)</span>
            </li>
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
          >
            Back to Home
          </Link>
          <Link
            href="/pdf-to-markdown"
            className="px-6 py-3 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          >
            Try PDF to Markdown
          </Link>
        </div>
      </div>
    </div>
  )
}
