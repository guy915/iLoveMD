/**
 * Global Error Handlers Hook
 *
 * Extracts global error handling logic from LogContext.
 * Handles:
 * - JavaScript errors (window.onerror)
 * - Unhandled promise rejections
 * - Console method interception (error, warn, log)
 * - Network request interception (fetch, XMLHttpRequest)
 *
 * This separation improves:
 * - Testability (can test error handlers independently)
 * - Maintainability (clearer separation of concerns)
 * - Reusability (can be used in other contexts)
 */

import { useEffect } from 'react'
import type { LogType } from '@/types'

/**
 * Options for global error handlers
 */
export interface UseGlobalErrorHandlersOptions {
  /**
   * Callback to log errors/events
   */
  onLog: (type: LogType, message: string, data?: Record<string, unknown> | null) => void

  /**
   * Whether to intercept console methods
   * @default true
   */
  interceptConsole?: boolean

  /**
   * Whether to intercept network requests
   * @default true
   */
  interceptNetwork?: boolean

  /**
   * Whether to capture global errors
   * @default true
   */
  captureGlobalErrors?: boolean
}

/**
 * Filter out Next.js internal URLs from logging
 */
function shouldLogUrl(url: string | undefined): boolean {
  if (!url || url === 'Unknown URL') return false

  const ignorePatterns = [
    '/__nextjs_original-stack-frame',
    '/_next/static',
    '/__nextjs',
    '/webpack-hmr',
    '/_next/webpack-hmr'
  ]

  return !ignorePatterns.some(pattern => url.includes(pattern))
}

/**
 * Hook for setting up global error handlers
 */
export function useGlobalErrorHandlers({
  onLog,
  interceptConsole = true,
  interceptNetwork = true,
  captureGlobalErrors = true
}: UseGlobalErrorHandlersOptions): void {
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Flag to prevent infinite error loops
    let isLoggingError = false

    // Capture JavaScript errors
    const handleError = (event: ErrorEvent) => {
      if (isLoggingError || !captureGlobalErrors) return
      isLoggingError = true

      try {
        // Check if this is a resource loading error
        if (event.target && (event.target as HTMLElement).tagName && !event.error) {
          const target = event.target as HTMLElement & { src?: string; href?: string }
          const tagName = target.tagName.toLowerCase()
          const resourceUrl = target.src || target.href || 'Unknown URL'

          if (shouldLogUrl(resourceUrl)) {
            onLog('error', 'Resource Loading Failed', {
              resourceType: tagName,
              resourceUrl,
              pageUrl: window.location.href,
              occurredAt: new Date().toISOString()
            })
          }
        } else {
          // JavaScript error
          onLog('error', 'JavaScript Error', {
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
        console.error('Failed to log error:', logError)
      } finally {
        isLoggingError = false
      }
    }

    // Capture unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isLoggingError || !captureGlobalErrors) return
      isLoggingError = true

      try {
        const reason = event.reason as Error | undefined
        onLog('error', 'Unhandled Promise Rejection', {
          reason: reason?.toString() || 'Unknown reason',
          reasonType: reason?.name,
          stack: reason?.stack ? reason.stack.split('\n').slice(0, 8).join('\n') : 'No stack trace available',
          url: window.location.href,
          occurredAt: new Date().toISOString()
        })
      } catch (logError) {
        console.error('Failed to log promise rejection:', logError)
      } finally {
        isLoggingError = false
      }
    }

    // Store original console methods
    const originalError = console.error
    const originalWarn = console.warn
    const originalLog = console['log']

    // Track which methods were wrapped by this hook instance
    let wrappedConsoleError = false
    let wrappedConsoleWarn = false
    let wrappedConsoleLog = false

    // Wrap console methods
    if (interceptConsole && !(console.error as any).__wrapped__) {
      wrappedConsoleError = true
      const wrappedError = (...args: unknown[]) => {
        onLog('error', 'Console Error', {
          message: args.map(arg =>
            typeof arg === 'object' && arg !== null ? JSON.stringify(arg, null, 2) : String(arg)
          ).join(' '),
          url: window.location.href,
          occurredAt: new Date().toISOString()
        })
        originalError.apply(console, args)
      }
      ;(wrappedError as any).__wrapped__ = true
      console.error = wrappedError
    }

    if (interceptConsole && !(console.warn as any).__wrapped__) {
      wrappedConsoleWarn = true
      const wrappedWarn = (...args: unknown[]) => {
        onLog('error', 'Console Warning', {
          message: args.map(arg =>
            typeof arg === 'object' && arg !== null ? JSON.stringify(arg, null, 2) : String(arg)
          ).join(' '),
          url: window.location.href,
          occurredAt: new Date().toISOString()
        })
        originalWarn.apply(console, args)
      }
      ;(wrappedWarn as any).__wrapped__ = true
      console.warn = wrappedWarn
    }

    if (interceptConsole && !(console['log'] as any).__wrapped__) {
      wrappedConsoleLog = true
      const wrappedLog = (...args: unknown[]) => {
        const message = args.map(arg =>
          typeof arg === 'object' && arg !== null ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ')

        if (!message.startsWith('[Fast Refresh]')) {
          onLog('info', 'Console Log', {
            message,
            url: window.location.href,
            occurredAt: new Date().toISOString()
          })
        }

        originalLog.apply(console, args)
      }
      ;(wrappedLog as any).__wrapped__ = true
      console['log'] = wrappedLog
    }

    // Intercept fetch()
    const originalFetch = window.fetch
    let didWrapFetch = false
    if (interceptNetwork && !(window.fetch as any).__wrapped__) {
      didWrapFetch = true
      const wrappedFetch = async (...args: Parameters<typeof fetch>): Promise<Response> => {
        const startTime = Date.now()
        const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request)?.url || 'Unknown URL'
        const options = args[1] || {}
        const method = options.method || 'GET'
        const shouldLog = shouldLogUrl(url)

        // Filter sensitive headers
        const sanitizedHeaders = options.headers ?
          Object.fromEntries(
            Object.entries(options.headers).map(([key, value]) =>
              /authorization|api-key|token/i.test(key) ? [key, '[REDACTED]'] : [key, value]
            )
          ) : 'None'

        if (shouldLog) {
          try {
            onLog('info', 'Network Request (fetch)', {
              method,
              url,
              headers: JSON.stringify(sanitizedHeaders),
              occurredAt: new Date().toISOString()
            })
          } catch (logError) {
            console.error('Failed to log fetch request:', logError)
          }
        }

        try {
          const response = await originalFetch(...args)
          const duration = Date.now() - startTime

          if (shouldLog) {
            try {
              onLog('success', 'Network Response (fetch)', {
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
              onLog('error', 'Network Error (fetch)', {
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
      }
      ;(wrappedFetch as any).__wrapped__ = true
      window.fetch = wrappedFetch
    }

    // Intercept XMLHttpRequest
    interface XHRMetadata {
      method: string
      url: string
      startTime: number
      shouldLog: boolean
    }
    const xhrMetaMap = new WeakMap<XMLHttpRequest, XHRMetadata>()
    const originalXHROpen = XMLHttpRequest.prototype.open
    const originalXHRSend = XMLHttpRequest.prototype.send
    let didWrapXHR = false

    if (interceptNetwork && !(XMLHttpRequest.prototype.open as any).__wrapped__) {
      didWrapXHR = true
      const wrappedXHROpen = function(
        this: XMLHttpRequest,
        method: string,
        url: string | URL,
        async?: boolean,
        username?: string | null,
        password?: string | null
      ) {
        const urlString = url.toString()
        const shouldLog = shouldLogUrl(urlString)
        xhrMetaMap.set(this, {
          method,
          url: urlString,
          startTime: Date.now(),
          shouldLog
        })

        if (shouldLog) {
          try {
            onLog('info', 'Network Request (XHR)', {
              method,
              url: urlString,
              occurredAt: new Date().toISOString()
            })
          } catch (logError) {
            console.error('Failed to log XHR request:', logError)
          }
        }

        return originalXHROpen.call(this, method, url, async ?? true, username, password)
      }
      ;(wrappedXHROpen as any).__wrapped__ = true
      XMLHttpRequest.prototype.open = wrappedXHROpen

      const wrappedXHRSend = function(this: XMLHttpRequest, body?: XMLHttpRequestBodyInit | Document | null) {
        const meta = xhrMetaMap.get(this)

        this.addEventListener('load', () => {
          const duration = meta ? (Date.now() - meta.startTime) : 0

          if (meta?.shouldLog) {
            try {
              onLog('success', 'Network Response (XHR)', {
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
              onLog('error', 'Network Error (XHR)', {
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
      }
      ;(wrappedXHRSend as any).__wrapped__ = true
      XMLHttpRequest.prototype.send = wrappedXHRSend
    }

    // Register event listeners
    if (captureGlobalErrors) {
      window.addEventListener('error', handleError, true)
      window.addEventListener('unhandledrejection', handleUnhandledRejection)
    }

    // Cleanup
    return () => {
      if (captureGlobalErrors) {
        window.removeEventListener('error', handleError, true)
        window.removeEventListener('unhandledrejection', handleUnhandledRejection)
      }
      // Only restore console methods if we wrapped them
      if (wrappedConsoleError) {
        console.error = originalError
      }
      if (wrappedConsoleWarn) {
        console.warn = originalWarn
      }
      if (wrappedConsoleLog) {
        console['log'] = originalLog
      }
      // Only restore network methods if we wrapped them
      if (didWrapFetch) {
        window.fetch = originalFetch
      }
      if (didWrapXHR) {
        XMLHttpRequest.prototype.open = originalXHROpen
        XMLHttpRequest.prototype.send = originalXHRSend
      }
    }
  }, [onLog, interceptConsole, interceptNetwork, captureGlobalErrors])
}

