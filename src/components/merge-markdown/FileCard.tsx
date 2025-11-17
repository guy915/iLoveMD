import { DragEvent } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { formatFileSize } from '@/lib/utils/formatUtils'

interface MarkdownFile {
  id: string
  file: File
  content: string
}

interface FileCardProps {
  markdownFile: MarkdownFile
  isDraggedCard: boolean
  isDropTarget: boolean
  hasMovedPosition: boolean
  onRemove: (id: string) => void
  onDragStart: (e: DragEvent<HTMLDivElement>) => void
  onDragOver: (e: DragEvent<HTMLDivElement>) => void
  onDragEnter: (e: DragEvent<HTMLDivElement>) => void
  onDragLeave: (e: DragEvent<HTMLDivElement>) => void
  onDrop: (e: DragEvent<HTMLDivElement>) => void
  onDragEnd: () => void
}

/**
 * Component for displaying a single file card with markdown preview.
 * Supports drag-and-drop reordering and file removal.
 */
export function FileCard({
  markdownFile,
  isDraggedCard,
  isDropTarget,
  hasMovedPosition,
  onRemove,
  onDragStart,
  onDragOver,
  onDragEnter,
  onDragLeave,
  onDrop,
  onDragEnd
}: FileCardProps) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`relative bg-white border-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-300 ease-in-out aspect-[5/7] flex flex-col ${
        isDraggedCard
          ? 'cursor-grabbing opacity-20 border-primary-400'
          : isDropTarget || hasMovedPosition
          ? 'border-primary-400 bg-primary-50'
          : 'cursor-grab border-gray-200'
      }`}
    >
      {/* Remove button */}
      <button
        onClick={() => onRemove(markdownFile.id)}
        className="absolute top-2 right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors z-10"
        aria-label={`Remove ${markdownFile.file.name}`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Markdown preview */}
      <div className="flex-1 bg-white border-b-2 border-gray-200 overflow-hidden rounded-t-lg relative">
        <div className="absolute inset-0 overflow-hidden p-2">
          <div className="text-[0.35rem] leading-tight">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex]}
              components={{
                h1: ({...props}) => <h1 className="text-[0.5rem] font-bold mb-1" {...props} />,
                h2: ({...props}) => <h2 className="text-[0.45rem] font-bold mb-1" {...props} />,
                h3: ({...props}) => <h3 className="text-[0.4rem] font-bold mb-0.5" {...props} />,
                h4: ({...props}) => <h4 className="text-[0.38rem] font-semibold mb-0.5" {...props} />,
                h5: ({...props}) => <h5 className="text-[0.36rem] font-semibold mb-0.5" {...props} />,
                h6: ({...props}) => <h6 className="text-[0.35rem] font-semibold mb-0.5" {...props} />,
                p: ({...props}) => <p className="mb-1" {...props} />,
                ul: ({...props}) => <ul className="mb-1 ml-2 list-disc" {...props} />,
                ol: ({...props}) => <ol className="mb-1 ml-2 list-decimal" {...props} />,
                li: ({...props}) => <li className="mb-0.5" {...props} />,
                code: ({...props}) => <code className="bg-gray-100 px-0.5 rounded text-[0.32rem]" {...props} />,
                pre: ({...props}) => <pre className="bg-gray-100 p-1 rounded text-[0.32rem] mb-1 overflow-x-auto" {...props} />,
                blockquote: ({...props}) => <blockquote className="border-l-2 border-gray-300 pl-1 mb-1 text-gray-600" {...props} />,
                a: ({href, ...props}) => {
                  // Filter out dangerous URL schemes for security
                  if (!href) {
                    return <span className="text-blue-600" {...props} />
                  }

                  try {
                    // Parse the URL to validate it
                    const url = new URL(href, 'http://example.com')
                    // Only allow safe protocols
                    const safeProtocols = ['http:', 'https:', 'mailto:']
                    const isSafe = safeProtocols.includes(url.protocol.toLowerCase())

                    return isSafe
                      ? <a className="text-blue-600" href={href} rel="noopener noreferrer" {...props} />
                      : <span className="text-blue-600" {...props} />
                  } catch {
                    // If URL parsing fails, treat as unsafe
                    return <span className="text-blue-600" {...props} />
                  }
                },
                hr: ({...props}) => <hr className="my-1 border-gray-300" {...props} />,
                // Don't render images - just show alt text to prevent 404 errors flooding logs
                img: ({alt}) => <span className="text-gray-500 text-[0.32rem] italic">[Image: {alt || 'no description'}]</span>,
              }}
            >
              {markdownFile.content}
            </ReactMarkdown>
          </div>
        </div>
      </div>

      {/* Filename - Fixed height footer */}
      <div className="p-3 flex-shrink-0">
        <p className="text-sm font-medium text-gray-900 truncate" title={markdownFile.file.name}>
          {markdownFile.file.name}
        </p>
        <p className="text-xs text-gray-500">
          {formatFileSize(markdownFile.file.size)}
        </p>
      </div>
    </div>
  )
}
