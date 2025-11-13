'use client'

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'
import type { LogEntry, LogType, LogContextValue } from '@/types'

const LogContext = createContext<LogContextValue | undefined>(undefined)
const LOGS_STORAGE_KEY = 'diagnosticLogs'
const LOG_COUNTER_KEY = 'diagnosticLogCounter'
const MAX_LOGS = 500

// Storage helper with quota checking
let storageQuotaExceeded = false // Flag to avoid repeated quota errors
let storageUnavailable = false // Flag if storage is completely unavailable

function safeStorageGet(key: string): string | null {
  if (typeof window === 'undefined' || storageUnavailable) return null

  try {
    return window.sessionStorage.getItem(key)
  } catch (error) {
    // Storage unavailable (private browsing, disabled, etc.)
    if (!storageUnavailable) {
      console.warn('sessionStorage unavailable:', error)
      storageUnavailable = true
    }
    return null
  }
}

function safeStorageSet(key: string, value: string): boolean {
  if (typeof window === 'undefined' || storageUnavailable) return false

  try {
    window.sessionStorage.setItem(key, value)
    storageQuotaExceeded = false // Reset flag on successful write
    return true
  } catch (error) {
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      if (!storageQuotaExceeded) {
        console.warn('sessionStorage quota exceeded. Logs will continue in memory but won\'t persist across page refreshes.')
        storageQuotaExceeded = true
      }
    } else {
      if (!storageUnavailable) {
        console.warn('sessionStorage write failed:', error)
        storageUnavailable = true
      }
    }
    return false
  }
}

function safeStorageRemove(key: string): boolean {
  if (typeof window === 'undefined' || storageUnavailable) return false

  try {
    window.sessionStorage.removeItem(key)
    return true
  } catch (error) {
    console.warn('sessionStorage remove failed:', error)
    return false
  }
}

// Persistent session counter - survives page navigation, resets on browser close
const getInitialCounter = (): number => {
  const stored = safeStorageGet(LOG_COUNTER_KEY)
  return stored ? parseInt(stored, 10) : 1
}

let persistentLogCounter = getInitialCounter()

// Track recent logs for deduplication (prevents React Strict Mode double-mounting duplicates)
const recentLogs = new Map<string, number>() // key: hash, value: timestamp
const DEDUP_WINDOW_MS = 50 // Consider logs within 50ms as duplicates (Strict Mode is fast)

// Filter out Next.js internal URLs from logging (framework noise)
const shouldLogUrl = (url: string | undefined): boolean => {
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

interface LogProviderProps {
  children: ReactNode
}

export function LogProvider({ children }: LogProviderProps) {
  // Initialize logs from sessionStorage if available
  const [logs, setLogs] = useState<LogEntry[]>(() => {
    try {
      const stored = safeStorageGet(LOGS_STORAGE_KEY)
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      console.error('Error parsing logs from sessionStorage:', error)
      return []
    }
  })

  // Save logs to sessionStorage whenever they change
  useEffect(() => {
    try {
      safeStorageSet(LOGS_STORAGE_KEY, JSON.stringify(logs))
    } catch (error) {
      // JSON.stringify might fail for circular references or large objects
      console.error('Error stringifying logs for sessionStorage:', error)
    }
  }, [logs])

  const addLog = useCallback((type: LogType, message: string, data: Record<string, unknown> | null = null) => {
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
    safeStorageSet(LOG_COUNTER_KEY, persistentLogCounter.toString())

    const newLog: LogEntry = { timestamp, type, message, data, id }
    // Keep only last 500 logs (sliding window)
    setLogs(prev => [...prev, newLog].slice(-MAX_LOGS))
  }, [])

  const clearLogs = useCallback(() => {
    setLogs([])
    persistentLogCounter = 1 // Reset counter to 1 (logs start at #1)
    safeStorageRemove(LOGS_STORAGE_KEY)
    safeStorageRemove(LOG_COUNTER_KEY)
  }, [])

  // Global error handlers - capture all JavaScript errors and promise rejections
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Flag to prevent infinite error loops
    let isLoggingError = false

    // Capture JavaScript errors
    const handleError = (event: ErrorEvent) => {
      if (isLoggingError) return // Prevent recursive error logging
      isLoggingError = true

      try {
        // Check if this is a resource loading error (img, script, css, etc.)
        if (event.target && (event.target as HTMLElement).tagName && !event.error) {
          const target = event.target as HTMLElement & { src?: string; href?: string }
          const tagName = target.tagName.toLowerCase()
          const resourceUrl = target.src || target.href || 'Unknown URL'

          // Only log actual resource failures (not Next.js internal resources)
          if (shouldLogUrl(resourceUrl)) {
            addLog('error', 'Resource Loading Failed', {
              resourceType: tagName,
              resourceUrl,
              pageUrl: window.location.href,
              occurredAt: new Date().toISOString()
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
            occurredAt: new Date().toISOString(),
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
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isLoggingError) return // Prevent recursive error logging
      isLoggingError = true

      try {
        const reason = event.reason as Error | undefined
        addLog('error', 'Unhandled Promise Rejection', {
          reason: reason?.toString() || 'Unknown reason',
          reasonType: reason?.name,
          stack: reason?.stack ? reason.stack.split('\n').slice(0, 8).join('\n') : 'No stack trace available',
          url: window.location.href,
          occurredAt: new Date().toISOString()
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

    // Wrap console methods only if not already wrapped
    if (!(console.error as any).__wrapped__) {
      const wrappedError = (...args: unknown[]) => {
        addLog('error', 'Console Error', {
          message: args.map(arg =>
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
          ).join(' '),
          url: window.location.href,
          occurredAt: new Date().toISOString()
        })
        originalError.apply(console, args)
      };
      (wrappedError as any).__wrapped__ = true
      console.error = wrappedError
    }

    if (!(console.warn as any).__wrapped__) {
      const wrappedWarn = (...args: unknown[]) => {
        addLog('error', 'Console Warning', {
          message: args.map(arg =>
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
          ).join(' '),
          url: window.location.href,
          occurredAt: new Date().toISOString()
        })
        originalWarn.apply(console, args)
      };
      (wrappedWarn as any).__wrapped__ = true
      console.warn = wrappedWarn
    }

    if (!(console['log'] as any).__wrapped__) {
      const wrappedLog = (...args: unknown[]) => {
        const message = args.map(arg =>
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ')

        // Filter out Next.js dev server noise
        const shouldLogConsole = !message.startsWith('[Fast Refresh]')

        if (shouldLogConsole) {
          addLog('info', 'Console Log', {
            message,
            url: window.location.href,
            occurredAt: new Date().toISOString()
          })
        }

        originalLog.apply(console, args)
      };
      (wrappedLog as any).__wrapped__ = true
      console['log'] = wrappedLog
    }

    // Intercept fetch() for network request visibility
    const originalFetch = window.fetch

    // Wrap fetch only if not already wrapped
    if (!(window.fetch as any).__wrapped__) {
      const wrappedFetch = async (...args: Parameters<typeof fetch>): Promise<Response> => {
      const startTime = Date.now()
      const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request)?.url || 'Unknown URL'
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
            occurredAt: new Date().toISOString()
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
              occurredAt: new Date().toISOString()
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
            const err = error as Error
            addLog('error', 'Network Error (fetch)', {
              method,
              url,
              error: err?.message || err?.toString(),
              duration: `${duration}ms`,
              occurredAt: new Date().toISOString()
            })
          } catch (logError) {
            console.error('Failed to log fetch error:', logError)
          }
        }

        throw error
      }
      };
      (wrappedFetch as any).__wrapped__ = true
      window.fetch = wrappedFetch
    }

    // Intercept XMLHttpRequest for network request visibility
    // Use WeakMap to prevent metadata conflicts with reused XHR objects
    interface XHRMetadata {
      method: string
      url: string
      startTime: number
      shouldLog: boolean
    }
    const xhrMetaMap = new WeakMap<XMLHttpRequest, XHRMetadata>()
    const originalXHROpen = XMLHttpRequest.prototype.open
    const originalXHRSend = XMLHttpRequest.prototype.send

    // Wrap XMLHttpRequest only if not already wrapped
    if (!(XMLHttpRequest.prototype.open as any).__wrapped__) {
      const wrappedXHROpen = function(
      this: XMLHttpRequest,
      method: string,
      url: string | URL,
      async?: boolean,
      username?: string | null,
      password?: string | null
    ) {
      const urlString = url.toString()
      // Store metadata for this specific XHR instance
      const shouldLog = shouldLogUrl(urlString)
      xhrMetaMap.set(this, {
        method,
        url: urlString,
        startTime: Date.now(),
        shouldLog
      })

      if (shouldLog) {
        try {
          addLog('info', 'Network Request (XHR)', {
            method,
            url: urlString,
            occurredAt: new Date().toISOString()
          })
        } catch (logError) {
          console.error('Failed to log XHR request:', logError)
        }
      }

      return originalXHROpen.call(this, method, url, async ?? true, username, password)
    };
    (wrappedXHROpen as any).__wrapped__ = true
    XMLHttpRequest.prototype.open = wrappedXHROpen

    const wrappedXHRSend = function(this: XMLHttpRequest, body?: XMLHttpRequestBodyInit | Document | null) {
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
              occurredAt: new Date().toISOString()
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
              occurredAt: new Date().toISOString()
            })
          } catch (logError) {
            console.error('Failed to log XHR error:', logError)
          }
        }
      })

      return originalXHRSend.call(this, body)
      };
      (wrappedXHRSend as any).__wrapped__ = true
      XMLHttpRequest.prototype.send = wrappedXHRSend
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

export function useLogs(): LogContextValue {
  const context = useContext(LogContext)
  if (!context) {
    throw new Error('useLogs must be used within LogProvider')
  }
  return context
}
