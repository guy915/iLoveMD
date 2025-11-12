import Link from 'next/link'

/**
 * About page with project information
 */
export default function About() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">About AI Doc Prep</h1>
        <p className="text-xl text-gray-600">
          Simple, privacy-focused tools for preparing documents for Large Language Models
        </p>
      </div>

      {/* Mission */}
      <section className="mb-12">
        <div className="bg-white rounded-lg shadow p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Our Mission</h2>
          <p className="text-gray-600 mb-4">
            AI Doc Prep was built to solve a common problem: getting documents into a format that LLMs like
            ChatGPT and Claude can easily process. While these AI assistants are powerful, they work best with
            clean, well-formatted markdown.
          </p>
          <p className="text-gray-600">
            We provide simple, single-purpose tools that do one thing well - convert your documents to
            LLM-optimized markdown, quickly and privately.
          </p>
        </div>
      </section>

      {/* Why We Built This */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Why We Built This</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Privacy First</h3>
            <p className="text-gray-600">
              Your documents are your business. We process HTML and markdown files entirely in your browser.
              For PDFs, we proxy to the Marker API but never store your files on our servers.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">No Accounts Required</h3>
            <p className="text-gray-600">
              No sign-ups, no subscriptions, no tracking. Just bring your API key for PDF conversion
              (which you can get for free from Marker), and you&apos;re ready to go.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Built for Simplicity</h3>
            <p className="text-gray-600">
              Each tool does exactly one thing. No complex pipelines, no overwhelming options.
              Just simple, effective document conversion.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Free to Use</h3>
            <p className="text-gray-600">
              The website is hosted on Vercel&apos;s free tier. You provide your own API keys for external services.
              No hidden costs, no premium tiers.
            </p>
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Technology</h2>
        <div className="bg-white rounded-lg shadow p-8">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Frontend</h3>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start">
                  <span className="text-primary-600 mr-2">•</span>
                  <span>Next.js 14 with App Router</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary-600 mr-2">•</span>
                  <span>React 18 with TypeScript</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary-600 mr-2">•</span>
                  <span>Tailwind CSS for styling</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary-600 mr-2">•</span>
                  <span>Client-side processing where possible</span>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Processing</h3>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start">
                  <span className="text-primary-600 mr-2">•</span>
                  <span>Marker API for PDF conversion</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary-600 mr-2">•</span>
                  <span>Turndown.js for HTML parsing</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary-600 mr-2">•</span>
                  <span>Readability for content extraction</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary-600 mr-2">•</span>
                  <span>Browser FileReader API for files</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Current Status */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Current Status</h2>
        <div className="bg-white rounded-lg shadow p-8">
          <div className="space-y-4">
            <div className="flex items-start">
              <span className="inline-block w-32 text-sm font-semibold text-gray-700">PDF to Markdown:</span>
              <span className="inline-block px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold">
                Available
              </span>
            </div>
            <div className="flex items-start">
              <span className="inline-block w-32 text-sm font-semibold text-gray-700">HTML to Markdown:</span>
              <span className="inline-block px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-semibold">
                Coming Soon
              </span>
            </div>
            <div className="flex items-start">
              <span className="inline-block w-32 text-sm font-semibold text-gray-700">Merge Markdown:</span>
              <span className="inline-block px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-semibold">
                Coming Soon
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Open Source */}
      <section className="mb-12">
        <div className="bg-primary-50 rounded-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Open Source</h2>
          <p className="text-gray-700 mb-4">
            AI Doc Prep is an open-source project. The code is available for review, contributions,
            and learning purposes.
          </p>
          <p className="text-gray-700">
            We welcome feedback, bug reports, and feature requests. Check out the project repository
            to learn more about the implementation or contribute to the project.
          </p>
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
