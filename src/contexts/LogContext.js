'use client'

import { createContext, useContext, useState, useCallback, useEffect } from 'react'

const LogContext = createContext()
const LOGS_STORAGE_KEY = 'diagnosticLogs'

export function LogProvider({ children }) {
  // Initialize logs from localStorage if available
  const [logs, setLogs] = useState(() => {
    if (typeof window === 'undefined') return []

    try {
      const stored = window.localStorage.getItem(LOGS_STORAGE_KEY)
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      console.error('Error loading logs from localStorage:', error)
      return []
    }
  })

  // Save logs to localStorage whenever they change
  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      window.localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(logs))
    } catch (error) {
      console.error('Error saving logs to localStorage:', error)
    }
  }, [logs])

  const addLog = useCallback((type, message, data = null) => {
    const timestamp = new Date().toLocaleTimeString()
    const newLog = { timestamp, type, message, data, id: Date.now() + Math.random() }
    setLogs(prev => [...prev, newLog])
  }, [])

  const clearLogs = useCallback(() => {
    setLogs([])
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(LOGS_STORAGE_KEY)
      } catch (error) {
        console.error('Error clearing logs from localStorage:', error)
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
        lineno: event.lineno,
        colno: event.colno,
        error: event.error?.toString(),
        stack: event.error?.stack?.split('\n').slice(0, 5).join('\n')
      })
    }

    // Capture unhandled promise rejections
    const handleUnhandledRejection = (event) => {
      addLog('error', 'Unhandled Promise Rejection', {
        reason: event.reason?.toString() || 'Unknown reason',
        promise: 'Promise rejected',
        stack: event.reason?.stack?.split('\n').slice(0, 5).join('\n')
      })
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
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
