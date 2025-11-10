import ToolTile from '@/components/home/ToolTile'

export default function Home() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">AI Doc Prep</h1>
        <p className="text-xl text-gray-600">
          Prepare your documents for LLMs
        </p>
      </div>

      {/* Tool Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
        <ToolTile
          workflow="PDF to Markdown"
          title="PDF to Markdown"
          description="Convert PDFs to clean markdown using Marker AI"
          href="/pdf-to-markdown"
        />
        <ToolTile
          workflow="HTML to Markdown"
          title="HTML to Markdown"
          description="Convert HTML files or URLs to markdown"
          href="/html-to-markdown"
        />
        <ToolTile
          workflow="Merge Markdowns"
          title="Merge Markdowns"
          description="Combine multiple markdown files into one"
          href="/merge-markdown"
        />
      </div>
    </div>
  )
}
