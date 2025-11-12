'use client'

import { useState, useEffect, useRef } from 'react'
import { useLogs } from '@/contexts/LogContext'

export default function GlobalDiagnosticPanel() {
  const { logs, addLog } = useLogs()
  const [isOpen, setIsOpen] = useState(false)
  const panelRef = useRef(null)

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    // Add event listener
    document.addEventListener('mousedown', handleClickOutside)

    // Cleanup
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  return (
    <div className="relative" ref={panelRef}>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        aria-label="Toggle diagnostic logs"
      >
        <span className="text-sm font-medium">Logs</span>
        <span className="bg-blue-500 px-2 py-0.5 rounded-full text-xs">
          {logs.length}
        </span>
        <span className="text-xs">{isOpen ? '▼' : '▶'}</span>
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 bg-gray-900 rounded-lg shadow-2xl overflow-hidden z-50 w-[95vw] max-w-xl md:w-[500px]">
          {/* Header */}
          <div className="flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700">
            <h3 className="text-lg font-semibold text-white">
              Diagnostic Logs ({logs.length})
            </h3>
            <button
              onClick={(e) => {
                e.stopPropagation()
                // Copy logs to clipboard
                const logsText = logs.map(log =>
                  `[${log.timestamp}] ${log.type.toUpperCase()}: ${log.message}${
                    log.data ? '\n' + JSON.stringify(log.data, null, 2) : ''
                  }`
                ).join('\n\n')
                navigator.clipboard.writeText(logsText)
                addLog('info', 'Logs copied to clipboard', {
                  logCount: logs.length,
                  timestamp: new Date().toISOString()
                })
              }}
              className="text-gray-400 hover:text-white text-sm px-3 py-1 bg-gray-700 rounded hover:bg-gray-600 transition-colors"
            >
              Copy
            </button>
          </div>

          {/* Logs content - user-select-text makes it easy to select and copy */}
          <div className="p-4 overflow-y-auto font-mono text-sm max-h-[320px] select-text cursor-text">
            {logs.length === 0 ? (
              <div className="text-gray-400 text-center py-8 select-none">
                No logs yet. Logs will appear here as you interact with the website.
              </div>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className={`mb-2 ${
                    log.type === 'error' ? 'text-red-400' :
                    log.type === 'success' ? 'text-green-400' :
                    'text-gray-300'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-gray-600 text-xs font-mono select-all" title="Log ID (click to select)">
                      #{log.id.split('-')[1]}
                    </span>
                    <div className="flex-1">
                      <span className="text-gray-500">[{log.timestamp}]</span>{' '}
                      <span className="font-bold">
                        {log.type.toUpperCase()}:
                      </span>{' '}
                      {log.message}
                      {log.data && (
                        <pre className="ml-4 mt-1 text-xs text-gray-400 overflow-x-auto whitespace-pre-wrap break-words">
                          {JSON.stringify(log.data, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
