'use client'

import { createContext, useContext, useState, useCallback, useEffect } from 'react'

const LogContext = createContext()
const LOGS_STORAGE_KEY = 'diagnosticLogs'

export function LogProvider({ children }) {
  // Initialize with empty array on server to avoid hydration errors
  // Load from localStorage only on client after mount
  const [logs, setLogs] = useState([])

  // Load logs from localStorage on client mount only
  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const stored = window.localStorage.getItem(LOGS_STORAGE_KEY)
      if (stored) {
        setLogs(JSON.parse(stored))
      }
    } catch (error) {
      console.error('Error loading logs from localStorage:', error)
    }
  }, [])

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
    const newLog = { timestamp, type, message, data, id: Date.now() }
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

  // Global error handlers - capture all uncaught errors
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Capture uncaught JavaScript errors
    const handleError = (event) => {
      addLog('error', `Uncaught error: ${event.message}`, {
        message: event.message,
        filename: event.filename,
        line: event.lineno,
        column: event.colno,
        error: event.error?.toString(),
        stack: event.error?.stack?.split('\n').slice(0, 5).join('\n')
      })
    }

    // Capture unhandled promise rejections
    const handleRejection = (event) => {
      addLog('error', `Unhandled promise rejection: ${event.reason}`, {
        reason: event.reason?.toString(),
        stack: event.reason?.stack?.split('\n').slice(0, 5).join('\n'),
        promise: event.promise?.toString()
      })
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleRejection)

    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleRejection)
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
