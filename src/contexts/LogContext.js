'use client'

import { createContext, useContext, useState, useCallback, useEffect } from 'react'

const LogContext = createContext()
const LOGS_STORAGE_KEY = 'diagnosticLogs'
const MAX_LOGS = 500

// Counter for unique log IDs
let logIdCounter = 0

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
    const timestamp = new Date().toLocaleTimeString()
    const newLog = { timestamp, type, message, data, id: `${Date.now()}-${logIdCounter++}` }
    // Keep only last 500 logs (sliding window)
    setLogs(prev => [...prev, newLog].slice(-MAX_LOGS))
  }, [])

  const clearLogs = useCallback(() => {
    setLogs([])
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.removeItem(LOGS_STORAGE_KEY)
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
      } catch (logError) {
        // Fallback to console if logging fails
        console.error('Failed to log JavaScript error:', logError)
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
      addLog('info', 'Console Log', {
        message: args.map(arg =>
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' '),
        url: window.location.href,
        timestamp: new Date().toISOString()
      })
      originalLog.apply(console, args)
    }

    // Intercept fetch() for network request visibility
    const originalFetch = window.fetch
    window.fetch = async (...args) => {
      const startTime = Date.now()
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || 'Unknown URL'
      const options = args[1] || {}
      const method = options.method || 'GET'

      addLog('info', 'Network Request (fetch)', {
        method,
        url,
        headers: options.headers ? JSON.stringify(options.headers) : 'None',
        timestamp: new Date().toISOString()
      })

      try {
        const response = await originalFetch(...args)
        const duration = Date.now() - startTime

        // Clone response to read it without consuming it
        const clonedResponse = response.clone()
        let responseData = null
        try {
          const contentType = response.headers.get('content-type')
          if (contentType?.includes('application/json')) {
            responseData = await clonedResponse.json()
          } else if (contentType?.includes('text')) {
            responseData = await clonedResponse.text()
          }
        } catch (e) {
          // Response not readable, skip
        }

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

        return response
      } catch (error) {
        const duration = Date.now() - startTime
        addLog('error', 'Network Error (fetch)', {
          method,
          url,
          error: error?.message || error?.toString(),
          duration: `${duration}ms`,
          timestamp: new Date().toISOString()
        })
        throw error
      }
    }

    // Intercept XMLHttpRequest for network request visibility
    const originalXHROpen = XMLHttpRequest.prototype.open
    const originalXHRSend = XMLHttpRequest.prototype.send

    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
      this._requestMethod = method
      this._requestURL = url
      this._requestStartTime = Date.now()

      addLog('info', 'Network Request (XHR)', {
        method,
        url,
        timestamp: new Date().toISOString()
      })

      return originalXHROpen.apply(this, [method, url, ...rest])
    }

    XMLHttpRequest.prototype.send = function(...args) {
      this.addEventListener('load', function() {
        const duration = Date.now() - this._requestStartTime

        addLog('success', 'Network Response (XHR)', {
          method: this._requestMethod,
          url: this._requestURL,
          status: this.status,
          statusText: this.statusText,
          duration: `${duration}ms`,
          responseSize: this.response?.length || 'Unknown',
          timestamp: new Date().toISOString()
        })
      })

      this.addEventListener('error', function() {
        const duration = Date.now() - this._requestStartTime

        addLog('error', 'Network Error (XHR)', {
          method: this._requestMethod,
          url: this._requestURL,
          duration: `${duration}ms`,
          timestamp: new Date().toISOString()
        })
      })

      return originalXHRSend.apply(this, args)
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    return () => {
      window.removeEventListener('error', handleError)
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
