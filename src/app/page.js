import ToolTile from '@/components/home/ToolTile'
import { TOOL_CARDS } from '@/lib/constants'

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
        {TOOL_CARDS.map((tool) => (
          <ToolTile
            key={tool.href}
            title={tool.title}
            description={tool.description}
            href={tool.href}
          />
        ))}
      </div>
    </div>
  )
}
