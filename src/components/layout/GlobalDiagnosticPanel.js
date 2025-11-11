'use client'

import { useState } from 'react'
import { useLogs } from '@/contexts/LogContext'

export default function GlobalDiagnosticPanel() {
  const { logs, clearLogs } = useLogs()
  const [isExpanded, setIsExpanded] = useState(false)

  if (logs.length === 0) {
    return null // Don't show if no logs
  }

  return (
    <div
      className="fixed top-16 right-4 z-50"
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      {/* Collapsed state - small indicator */}
      {!isExpanded && (
        <div className="bg-blue-600 text-white px-3 py-2 rounded-lg shadow-lg cursor-pointer flex items-center gap-2">
          <span className="text-sm font-medium">Logs ({logs.length})</span>
          <span className="text-xs">▼</span>
        </div>
      )}

      {/* Expanded state - full panel */}
      {isExpanded && (
        <div className="bg-gray-900 rounded-lg shadow-2xl overflow-hidden" style={{ width: '500px', maxHeight: '400px' }}>
          {/* Header */}
          <div className="flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700">
            <h3 className="text-lg font-semibold text-white">
              Diagnostic Logs ({logs.length})
            </h3>
            <button
              onClick={(e) => {
                e.stopPropagation()
                clearLogs()
              }}
              className="text-gray-400 hover:text-white text-sm px-3 py-1 bg-gray-700 rounded hover:bg-gray-600 transition-colors"
            >
              Clear
            </button>
          </div>

          {/* Logs content */}
          <div className="p-4 overflow-y-auto font-mono text-sm" style={{ maxHeight: '320px' }}>
            {logs.map((log) => (
              <div
                key={log.id}
                className={`mb-2 ${
                  log.type === 'error' ? 'text-red-400' :
                  log.type === 'success' ? 'text-green-400' :
                  'text-gray-300'
                }`}
              >
                <span className="text-gray-500">[{log.timestamp}]</span>{' '}
                <span className="font-bold">
                  {log.type.toUpperCase()}:
                </span>{' '}
                {log.message}
                {log.data && (
                  <pre className="ml-4 mt-1 text-xs text-gray-400 overflow-x-auto">
                    {JSON.stringify(log.data, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
