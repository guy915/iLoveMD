/**
 * Footer component with copyright and attribution
 * Automatically updates copyright year
 */
export default function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <p className="text-sm text-gray-600 text-center">
          © {new Date().getFullYear()}{' '}
          <a
            href="https://github.com/guy915/iLoveMD"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-600 hover:text-blue-600 font-medium transition-colors underline"
            aria-label="iLoveMD (opens in new tab)"
          >
            iLoveMD
          </a>
          . Markdown utility tools.
        </p>
      </div>
    </footer>
  )
}
