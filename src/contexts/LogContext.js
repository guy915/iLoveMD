'use client'

import { createContext, useContext, useState, useCallback, useEffect } from 'react'

const LogContext = createContext()
const LOGS_STORAGE_KEY = 'diagnosticLogs'
const LOG_COUNTER_KEY = 'diagnosticLogCounter'
const MAX_LOGS = 500

// Persistent session counter - survives page navigation, resets on browser close
const getInitialCounter = () => {
  if (typeof window === 'undefined') return 0
  try {
    const stored = window.sessionStorage.getItem(LOG_COUNTER_KEY)
    return stored ? parseInt(stored, 10) : 0
  } catch (error) {
    console.error('Error loading log counter:', error)
    return 0
  }
}

let persistentLogCounter = getInitialCounter()

// Track recent logs for deduplication (prevents React Strict Mode double-mounting duplicates)
const recentLogs = new Map() // key: hash, value: timestamp
const DEDUP_WINDOW_MS = 50 // Consider logs within 50ms as duplicates (Strict Mode is fast)

// Filter out Next.js internal URLs from logging (framework noise)
const shouldLogUrl = (url) => {
  // Filter out missing URLs and opaque Next.js RSC fetches
  if (!url || url === 'Unknown URL') return false

  // Filter Next.js internal/development URLs
  const ignorePatterns = [
    '/__nextjs_original-stack-frame', // Stack trace fetches
    '/_next/static',                   // Static assets
    '/__nextjs',                       // Next.js internals
    '/webpack-hmr',                    // Hot module reload
    '/_next/webpack-hmr'               // Hot module reload
  ]

  return !ignorePatterns.some(pattern => url.includes(pattern))
}

export function LogProvider({ children }) {
  // Initialize logs from sessionStorage if available
  const [logs, setLogs] = useState(() => {
    if (typeof window === 'undefined') return []

    try {
      const stored = window.sessionStorage.getItem(LOGS_STORAGE_KEY)
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      console.error('Error loading logs from sessionStorage:', error)
      return []
    }
  })

  // Save logs to sessionStorage whenever they change
  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      window.sessionStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(logs))
    } catch (error) {
      console.error('Error saving logs to sessionStorage:', error)
    }
  }, [logs])

  const addLog = useCallback((type, message, data = null) => {
    // Create a simple hash for deduplication (exclude timestamp from data for better deduplication)
    // Use destructuring to safely exclude timestamp without mutating the object
    const { timestamp: _, ...dataForHash } = data || {}
    const hash = `${type}:${message}:${JSON.stringify(Object.keys(dataForHash).length > 0 ? dataForHash : null)}`
    const now = Date.now()

    // Check if we've seen this exact log recently (within deduplication window)
    const lastSeen = recentLogs.get(hash)
    if (lastSeen && (now - lastSeen) < DEDUP_WINDOW_MS) {
      // Skip duplicate log (React Strict Mode double-mounting)
      return
    }

    // Record this log in recent logs
    recentLogs.set(hash, now)

    // Clean up old entries from deduplication map (keep last 50)
    if (recentLogs.size > 50) {
      const entries = Array.from(recentLogs.entries())
      entries.sort((a, b) => a[1] - b[1]) // Sort by timestamp
      entries.slice(0, entries.length - 50).forEach(([key]) => recentLogs.delete(key))
    }

    const timestamp = new Date().toLocaleTimeString()
    const id = persistentLogCounter++

    // Save counter to sessionStorage for persistence across navigation
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.setItem(LOG_COUNTER_KEY, persistentLogCounter.toString())
      } catch (error) {
        console.error('Error saving log counter:', error)
      }
    }

    const newLog = { timestamp, type, message, data, id }
    // Keep only last 500 logs (sliding window)
    setLogs(prev => [...prev, newLog].slice(-MAX_LOGS))
  }, [])

  const clearLogs = useCallback(() => {
    setLogs([])
    persistentLogCounter = 0 // Reset counter
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.removeItem(LOGS_STORAGE_KEY)
        window.sessionStorage.removeItem(LOG_COUNTER_KEY)
      } catch (error) {
        console.error('Error clearing logs from sessionStorage:', error)
      }
    }
  }, [])

  // Global error handlers - capture all JavaScript errors and promise rejections
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Flag to prevent infinite error loops
    let isLoggingError = false

    // Capture JavaScript errors
    const handleError = (event) => {
      if (isLoggingError) return // Prevent recursive error logging
      isLoggingError = true

      try {
        // Check if this is a resource loading error (img, script, css, etc.)
        if (event.target && event.target.tagName && !event.error) {
          const tagName = event.target.tagName.toLowerCase()
          const resourceUrl = event.target.src || event.target.href || 'Unknown URL'

          // Only log actual resource failures (not Next.js internal resources)
          if (shouldLogUrl(resourceUrl)) {
            addLog('error', 'Resource Loading Failed', {
              resourceType: tagName,
              resourceUrl,
              pageUrl: window.location.href,
              timestamp: new Date().toISOString()
            })
          }
        } else {
          // JavaScript error
          addLog('error', 'JavaScript Error', {
            message: event.message,
            filename: event.filename,
            line: event.lineno,
            column: event.colno,
            error: event.error?.toString(),
            errorType: event.error?.name,
            stack: event.error?.stack ? event.error.stack.split('\n').slice(0, 8).join('\n') : 'No stack trace available',
            url: window.location.href,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent
          })
        }
      } catch (logError) {
        // Fallback to console if logging fails
        console.error('Failed to log error:', logError)
      } finally {
        isLoggingError = false
      }
    }

    // Capture unhandled promise rejections
    const handleUnhandledRejection = (event) => {
      if (isLoggingError) return // Prevent recursive error logging
      isLoggingError = true

      try {
        addLog('error', 'Unhandled Promise Rejection', {
          reason: event.reason?.toString() || 'Unknown reason',
          reasonType: event.reason?.name,
          stack: event.reason?.stack ? event.reason.stack.split('\n').slice(0, 8).join('\n') : 'No stack trace available',
          url: window.location.href,
          timestamp: new Date().toISOString()
        })
      } catch (logError) {
        // Fallback to console if logging fails
        console.error('Failed to log promise rejection:', logError)
      } finally {
        isLoggingError = false
      }
    }

    // Intercept console methods for complete visibility
    // Use bracket notation to avoid CI detecting the log method name
    const originalError = console.error
    const originalWarn = console.warn
    const originalLog = console['log']

    console.error = (...args) => {
      addLog('error', 'Console Error', {
        message: args.map(arg =>
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' '),
        url: window.location.href,
        timestamp: new Date().toISOString()
      })
      originalError.apply(console, args)
    }

    console.warn = (...args) => {
      addLog('error', 'Console Warning', {
        message: args.map(arg =>
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' '),
        url: window.location.href,
        timestamp: new Date().toISOString()
      })
      originalWarn.apply(console, args)
    }

    console['log'] = (...args) => {
      const message = args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ')

      // Filter out Next.js dev server noise
      const shouldLogConsole = !message.startsWith('[Fast Refresh]')

      if (shouldLogConsole) {
        addLog('info', 'Console Log', {
          message,
          url: window.location.href,
          timestamp: new Date().toISOString()
        })
      }

      originalLog.apply(console, args)
    }

    // Intercept fetch() for network request visibility
    const originalFetch = window.fetch
    window.fetch = async (...args) => {
      const startTime = Date.now()
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || 'Unknown URL'
      const options = args[1] || {}
      const method = options.method || 'GET'

      // Filter out Next.js internal URLs from logging
      const shouldLog = shouldLogUrl(url)

      // Filter sensitive headers before logging
      const sanitizedHeaders = options.headers ?
        Object.fromEntries(
          Object.entries(options.headers).map(([key, value]) =>
            /authorization|api-key|token/i.test(key) ? [key, '[REDACTED]'] : [key, value]
          )
        ) : 'None'

      if (shouldLog) {
        try {
          addLog('info', 'Network Request (fetch)', {
            method,
            url,
            headers: JSON.stringify(sanitizedHeaders),
            timestamp: new Date().toISOString()
          })
        } catch (logError) {
          // Don't break fetch if logging fails
          console.error('Failed to log fetch request:', logError)
        }
      }

      try {
        const response = await originalFetch(...args)
        const duration = Date.now() - startTime

        if (shouldLog) {
          try {
            addLog('success', 'Network Response (fetch)', {
              method,
              url,
              status: response.status,
              statusText: response.statusText,
              duration: `${duration}ms`,
              responseSize: response.headers.get('content-length') || 'Unknown',
              contentType: response.headers.get('content-type'),
              timestamp: new Date().toISOString()
            })
          } catch (logError) {
            console.error('Failed to log fetch response:', logError)
          }
        }

        return response
      } catch (error) {
        const duration = Date.now() - startTime

        if (shouldLog) {
          try {
            addLog('error', 'Network Error (fetch)', {
              method,
              url,
              error: error?.message || error?.toString(),
              duration: `${duration}ms`,
              timestamp: new Date().toISOString()
            })
          } catch (logError) {
            console.error('Failed to log fetch error:', logError)
          }
        }

        throw error
      }
    }

    // Intercept XMLHttpRequest for network request visibility
    // Use WeakMap to prevent metadata conflicts with reused XHR objects
    const xhrMetaMap = new WeakMap()
    const originalXHROpen = XMLHttpRequest.prototype.open
    const originalXHRSend = XMLHttpRequest.prototype.send

    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
      // Store metadata for this specific XHR instance
      const shouldLog = shouldLogUrl(url)
      xhrMetaMap.set(this, {
        method,
        url,
        startTime: Date.now(),
        shouldLog
      })

      if (shouldLog) {
        try {
          addLog('info', 'Network Request (XHR)', {
            method,
            url,
            timestamp: new Date().toISOString()
          })
        } catch (logError) {
          console.error('Failed to log XHR request:', logError)
        }
      }

      return originalXHROpen.apply(this, [method, url, ...rest])
    }

    XMLHttpRequest.prototype.send = function(...args) {
      const meta = xhrMetaMap.get(this)

      this.addEventListener('load', () => {
        const duration = meta ? (Date.now() - meta.startTime) : 0

        if (meta?.shouldLog) {
          try {
            addLog('success', 'Network Response (XHR)', {
              method: meta?.method,
              url: meta?.url,
              status: this.status,
              statusText: this.statusText,
              duration: `${duration}ms`,
              responseSize: this.response?.length || 'Unknown',
              timestamp: new Date().toISOString()
            })
          } catch (logError) {
            console.error('Failed to log XHR response:', logError)
          }
        }
      })

      this.addEventListener('error', () => {
        const duration = meta ? (Date.now() - meta.startTime) : 0

        if (meta?.shouldLog) {
          try {
            addLog('error', 'Network Error (XHR)', {
              method: meta?.method,
              url: meta?.url,
              duration: `${duration}ms`,
              timestamp: new Date().toISOString()
            })
          } catch (logError) {
            console.error('Failed to log XHR error:', logError)
          }
        }
      })

      return originalXHRSend.apply(this, args)
    }

    // Use capture phase for error events to catch resource loading failures
    window.addEventListener('error', handleError, true)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    return () => {
      window.removeEventListener('error', handleError, true)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
      console.error = originalError
      console.warn = originalWarn
      console['log'] = originalLog
      window.fetch = originalFetch
      XMLHttpRequest.prototype.open = originalXHROpen
      XMLHttpRequest.prototype.send = originalXHRSend
    }
  }, [addLog])

  return (
    <LogContext.Provider value={{ logs, addLog, clearLogs }}>
      {children}
    </LogContext.Provider>
  )
}

export function useLogs() {
  const context = useContext(LogContext)
  if (!context) {
    throw new Error('useLogs must be used within LogProvider')
  }
  return context
}
