'use client'
import Link from 'next/link'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useLogs } from '@/contexts/LogContext'

/**
 * Custom 404 Not Found page
 * Displayed when user navigates to a non-existent route
 */
export default function NotFound() {
  const { addLog } = useLogs()
  const pathname = usePathname()

  useEffect(() => {
    addLog('error', '404 - Page not found', {
      pathname: pathname || 'unknown',
      timestamp: new Date().toISOString()
    })
  }, [addLog, pathname])

  const handleGoHome = () => {
    addLog('info', '404 page: Go Home button clicked')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <h1 className="text-6xl font-bold text-primary-600 mb-4">404</h1>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Page Not Found
        </h2>
        <p className="text-gray-600 mb-6">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        {pathname && (
          <p className="text-sm text-gray-500 mb-6 font-mono bg-gray-100 p-2 rounded">
            Path: {pathname}
          </p>
        )}

        <div className="flex flex-col gap-3">
          <Link
            href="/"
            onClick={handleGoHome}
            className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
          >
            Go Home
          </Link>
          <Link
            href="/help"
            className="px-6 py-3 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          >
            Get Help
          </Link>
        </div>
      </div>
    </div>
  )
}
