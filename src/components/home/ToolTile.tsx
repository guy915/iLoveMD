'use client'

import { memo, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useLogs } from '@/contexts/LogContext'

/**
 * ToolTile component props
 */
interface ToolTileProps {
  /** Tool title */
  title: string
  /** Tool description */
  description: string
  /** Link to tool page */
  href: string
  /** Icon path (SVG file in public folder) */
  icon: string
}

/**
 * ToolTile component for displaying tool cards on the homepage
 * Memoized to prevent unnecessary re-renders
 * Designed with iLovePDF-style layout: icon at top, title, and short description
 */
const ToolTile = memo(function ToolTile({ title, description, href, icon }: ToolTileProps) {
  const { addLog } = useLogs()

  const handleClick = useCallback(() => {
    addLog('info', `Tool tile clicked: ${title}`, { href, title })
  }, [addLog, title, href])

  return (
    <Link
      href={href}
      className="flex flex-col items-center text-center h-full min-h-[240px] p-8 bg-white rounded-lg border border-gray-200 hover:border-primary-500 hover:shadow-lg transition-all"
      onClick={handleClick}
    >
      {/* Icon */}
      <div className="mb-4">
        <Image
          src={icon}
          alt={`${title} icon`}
          width={80}
          height={80}
        />
      </div>

      {/* Title */}
      <h3 className="text-xl font-semibold mb-3">{title}</h3>

      {/* Description */}
      <p className="text-gray-600 text-sm leading-relaxed">{description}</p>
    </Link>
  )
})

export default ToolTile
