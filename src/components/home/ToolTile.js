'use client'
import Link from 'next/link'
import { useLogs } from '@/contexts/LogContext'

/**
 * ToolTile component for displaying tool cards on the homepage
 * @param {Object} props
 * @param {string} props.title - Tool title
 * @param {string} props.description - Tool description
 * @param {string} props.href - Link to tool page
 */
export default function ToolTile({ title, description, href }) {
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
