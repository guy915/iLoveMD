'use client'

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
}

/**
 * ToolTile component for displaying tool cards on the homepage
 */
export default function ToolTile({ title, description, href }: ToolTileProps) {
  const { addLog } = useLogs()

  const handleClick = () => {
    addLog('info', `Tool tile clicked: ${title}`, { href, title })
  }

  return (
    <Link
      href={href}
      className="block p-8 bg-white rounded-lg border border-gray-200 hover:border-primary-500 hover:shadow-lg transition-all"
      onClick={handleClick}
    >
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </Link>
  )
}
