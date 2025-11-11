'use client'

import { createContext, useContext, useState, useCallback } from 'react'

const LogContext = createContext()

export function LogProvider({ children }) {
  const [logs, setLogs] = useState([])

  const addLog = useCallback((type, message, data = null) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [...prev, { timestamp, type, message, data, id: Date.now() }])
  }, [])

  const clearLogs = useCallback(() => {
    setLogs([])
  }, [])

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
