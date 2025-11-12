'use client'

import { createContext, useContext, useState, useCallback, useEffect } from 'react'

const LogContext = createContext()
const LOGS_STORAGE_KEY = 'diagnosticLogs'
const MAX_LOGS = 500

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
    const newLog = { timestamp, type, message, data, id: Date.now() + Math.random() }
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

    // Capture JavaScript errors
    const handleError = (event) => {
      addLog('error', 'JavaScript Error', {
        message: event.message,
        filename: event.filename,
        line: event.lineno,
        column: event.colno,
        error: event.error?.toString(),
        errorType: event.error?.name,
        stack: event.error?.stack?.split('\n').slice(0, 8).join('\n'), // More stack trace lines
        url: window.location.href,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent
      })
    }

    // Capture unhandled promise rejections
    const handleUnhandledRejection = (event) => {
      addLog('error', 'Unhandled Promise Rejection', {
        reason: event.reason?.toString() || 'Unknown reason',
        reasonType: event.reason?.name,
        stack: event.reason?.stack?.split('\n').slice(0, 8).join('\n'),
        url: window.location.href,
        timestamp: new Date().toISOString()
      })
    }

    // Intercept console.error and console.warn for additional visibility
    const originalError = console.error
    const originalWarn = console.warn

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

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
      console.error = originalError
      console.warn = originalWarn
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
