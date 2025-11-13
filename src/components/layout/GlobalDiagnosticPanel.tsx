'use client'

import { useState, useEffect, useRef, MouseEvent } from 'react'
import { useLogs } from '@/contexts/LogContext'

export default function GlobalDiagnosticPanel() {
  const { logs, addLog } = useLogs()
  const [isOpen, setIsOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent | Event) => {
      const target = event.target as Node
      if (panelRef.current && !panelRef.current.contains(target)) {
        setIsOpen(false)
      }
    }

    // Add event listener
    document.addEventListener('mousedown', handleClickOutside as EventListener)

    // Cleanup
    return () => {
      document.removeEventListener('mousedown', handleClickOutside as EventListener)
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
        <span className="bg-blue-500 px-2 py-0.5 rounded-full text-xs" suppressHydrationWarning>
          {logs.length}
        </span>
        <span className="text-xs" aria-hidden="true">
          {isOpen ? '▼' : '▶'}
        </span>
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 bg-gray-900 rounded-lg shadow-2xl overflow-hidden z-50 w-[95vw] max-w-xl md:w-[500px]">
          {/* Header */}
          <div className="flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700">
            <h3 className="text-lg font-semibold text-white">
              Diagnostic Logs
            </h3>
            <button
              onClick={(e: MouseEvent<HTMLButtonElement>) => {
                e.stopPropagation()

                // Calculate log statistics
                const errorCount = logs.filter(log => log.type === 'error').length
                const successCount = logs.filter(log => log.type === 'success').length
                const infoCount = logs.filter(log => log.type === 'info').length

                // Get session info
                const now = new Date()
                const sessionStart = logs.length > 0 ? logs[0].timestamp : now.toLocaleTimeString()
                const currentUrl = typeof window !== 'undefined' ? window.location.href : 'Unknown'
                const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown'

                // Format metadata section
                const metadata = `=== ABOUT THESE DIAGNOSTIC LOGS ===
This is a diagnostic logging system that tracks all user interactions, application
events, and errors that occur while using AI Doc Prep. These logs provide a complete
timeline of what happened during your session, making it easier to troubleshoot issues
and understand application behavior. If you encounter problems, share these logs when
asking for help - they contain valuable context for debugging.

=== WHAT THIS TOOL TRACKS ===
Navigation & Page Events:
- Page loads and component mounts
- Navigation link clicks (header menu, logo, tool tiles)
- Mobile menu toggles
- Route changes and browser navigation

User Interactions:
- File uploads (drag-drop, browser selection)
- File validation (success and failures with metadata)
- Button clicks and form submissions
- All tool interactions

Application Events:
- localStorage operations (API key saves, preference updates)
- File processing operations
- Download triggers
- API calls with timing (request/response, duration)

Error Tracking:
- Validation errors (file size, type mismatches)
- Network errors (API failures, timeouts)
- 404 errors (invalid routes)
- Application crashes (via ErrorBoundary)

Performance Metrics:
- API response times (milliseconds)
- Polling durations
- Total operation times

=== SESSION DETAILS ===
Date: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}
Session Start: ${sessionStart}
Current URL: ${currentUrl}
Browser: ${userAgent}

=== STATISTICS ===
Total Logs: ${logs.length}
├─ Errors: ${errorCount}
├─ Success: ${successCount}
└─ Info: ${infoCount}

=== LEGEND ===
ERROR   - Errors, failures, exceptions (shown in red)
SUCCESS - Successful operations, completions (shown in green)
INFO    - General information, events (shown in gray)

Log Format: #ID [timestamp] TYPE: message
- ID: Sequential log number (persists across navigation)
- Timestamp: When the event occurred
- Data: Additional context (JSON format)

=== LOGS ===
`

                // Format logs
                const logsText = logs.map(log =>
                  `#${log.id} [${log.timestamp}] ${log.type.toUpperCase()}: ${log.message}${
                    log.data ? '\n' + JSON.stringify(log.data, null, 2) : ''
                  }`
                ).join('\n\n')

                // Combine metadata + logs
                const fullCopy = metadata + logsText

                navigator.clipboard.writeText(fullCopy)
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
                      #{log.id}
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
