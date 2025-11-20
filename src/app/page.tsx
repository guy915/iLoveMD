import Image from 'next/image'
import ToolTile from '@/components/home/ToolTile'
import { TOOL_CARDS } from '@/lib/constants'

export default function Home() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Hero Section */}
      <header className="text-center mb-12">
        <div className="flex justify-center mb-4">
          <Image
            src="/logo.svg"
            alt="iLoveMD - PDF to Markdown Converter and Merge Tool"
            width={300}
            height={100}
            style={{ height: 'auto' }}
            priority
          />
        </div>
        <h1 className="text-3xl text-gray-600 mb-4">
          Your Markdown toolkit
        </h1>
        <p className="text-lg text-gray-500 max-w-3xl mx-auto">
          Free online tools to convert PDF to Markdown and merge multiple Markdown files. Perfect for preparing documents for LLMs and AI training.
        </p>
      </header>

      {/* Tool Grid */}
      <section className="flex flex-wrap justify-center gap-6 max-w-5xl mx-auto">
        <h2 className="sr-only">Available Markdown Tools</h2>
        {TOOL_CARDS.map((tool) => (
          <div key={tool.href} className="w-full md:w-[calc(50%-0.75rem)] lg:w-[calc(33.333%-1rem)] flex">
            <ToolTile
              title={tool.title}
              description={tool.description}
              href={tool.href}
              icon={tool.icon}
            />
          </div>
        ))}
      </section>
    </div>
  )
}
