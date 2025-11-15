import ToolTile from '@/components/home/ToolTile'
import { TOOL_CARDS } from '@/lib/constants'

export default function Home() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">iLoveLLM</h1>
        <p className="text-xl text-gray-600">
          Prepare your documents for LLMs
        </p>
      </div>

      {/* Tool Grid */}
      <div className="flex flex-wrap justify-center gap-6 max-w-5xl mx-auto">
        {TOOL_CARDS.map((tool) => (
          <div key={tool.href} className="w-full md:w-[calc(50%-0.75rem)] lg:w-[calc(33.333%-1rem)] flex">
            <ToolTile
              title={tool.title}
              description={tool.description}
              href={tool.href}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
