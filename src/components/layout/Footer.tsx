/**
 * Footer component with copyright and attribution
 * Automatically updates copyright year
 */
export default function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <p className="text-sm text-gray-600 text-center">
          © {new Date().getFullYear()} iLoveLLM. Free tool for preparing documents for LLMs and RAG.
        </p>
      </div>
    </footer>
  )
}
