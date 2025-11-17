'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react'
import type { LogEntry, LogType, LogContextValue } from '@/types'
import { SessionStorageAdapter } from '@/lib/storage'
import { useGlobalErrorHandlers } from '@/hooks/useGlobalErrorHandlers'

const LogContext = createContext<LogContextValue | undefined>(undefined)
const LOGS_STORAGE_KEY = 'diagnosticLogs'
const LOG_COUNTER_KEY = 'diagnosticLogCounter'
const MAX_LOGS = 50
const DEDUP_WINDOW_MS = 50 // Consider logs within 50ms as duplicates (React Strict Mode)

interface LogProviderProps {
  children: ReactNode
}

/**
 * LogProvider - Simplified context provider for diagnostic logging
 *
 * Improvements over previous version:
 * - Uses SessionStorageAdapter instead of module-level functions
 * - Moves persistentLogCounter and recentLogs into React state (no global state)
 * - Extracts global error handlers into useGlobalErrorHandlers hook
 * - Cleaner separation of concerns
 * - Better testability
 */
export function LogProvider({ children }: LogProviderProps) {
  // Create storage adapter instance (created once per provider)
  const storageAdapterRef = useRef<SessionStorageAdapter | null>(null)
  if (!storageAdapterRef.current) {
    storageAdapterRef.current = new SessionStorageAdapter()
  }
  const storageAdapter = storageAdapterRef.current

  // Initialize logs from sessionStorage
  const [logs, setLogs] = useState<LogEntry[]>(() => {
    try {
      const stored = storageAdapter.getItem(LOGS_STORAGE_KEY)
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      console.error('Error parsing logs from sessionStorage:', error)
      return []
    }
  })

  // Initialize log counter from sessionStorage
  const [logCounter, setLogCounter] = useState<number>(() => {
    try {
      const stored = storageAdapter.getItem(LOG_COUNTER_KEY)
      return stored ? parseInt(stored, 10) : 1
    } catch {
      return 1
    }
  })

  // Use ref for counter to ensure sequential IDs even with rapid calls
  const counterRef = useRef(logCounter)
  counterRef.current = logCounter

  // Track recent logs for deduplication (React state instead of module-level Map)
  const [recentLogs] = useState<Map<string, number>>(() => new Map())

  // Save logs to sessionStorage with debouncing
  useEffect(() => {
    // Store original console methods to avoid recursive logging when storage fails
    // (useGlobalErrorHandlers wraps console.warn, which would create infinite loops)
    const originalConsoleWarn = console.warn
    const originalConsoleError = console.error

    const timeoutId = setTimeout(() => {
      try {
        const options = {
          autoTrimOnQuota: true,
          maxItemsOnTrim: 30,
          onError: (error: Error) => {
            // Silent failure - logs continue in memory
            // Use original console.warn to avoid recursive logging via useGlobalErrorHandlers
            originalConsoleWarn.call(console, 'Failed to save logs to sessionStorage:', error)
          }
        }
        storageAdapter.setItem(LOGS_STORAGE_KEY, JSON.stringify(logs), options)
      } catch (error) {
        // Use original console.error to avoid recursive logging
        originalConsoleError.call(console, 'Error stringifying logs for sessionStorage:', error)
      }
    }, 1000) // Wait 1 second after last log before saving

    return () => clearTimeout(timeoutId)
  }, [logs, storageAdapter])

  // Save counter to sessionStorage whenever it changes
  useEffect(() => {
    storageAdapter.setItem(LOG_COUNTER_KEY, logCounter.toString())
  }, [logCounter, storageAdapter])

  const addLog = useCallback((type: LogType, message: string, data: Record<string, unknown> | null = null) => {
    // Create hash for deduplication
    const dataKeys = data ? Object.keys(data).filter(k => k !== 'timestamp').sort().join(',') : ''
    const dataValuesSnippet = data ? JSON.stringify(data).slice(0, 32) : ''
    const hash = `${type}:${message}:${dataKeys}:${dataValuesSnippet}`
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
    // Use current ref value for ID, then increment ref synchronously
    // This ensures sequential IDs even with rapid calls
    const id = counterRef.current
    counterRef.current = id + 1
    // Update state to keep it in sync (functional update ensures correctness)
    setLogCounter(prev => prev + 1)

    const newLog: LogEntry = { timestamp, type, message, data, id }
    // Keep only last 50 logs (sliding window)
    setLogs(prev => {
      const newLogs = [...prev, newLog]
      return newLogs.length > MAX_LOGS ? newLogs.slice(-MAX_LOGS) : newLogs
    })
  }, [recentLogs, setLogCounter])

  const clearLogs = useCallback(() => {
    setLogs([])
    counterRef.current = 1 // Reset ref to 1
    setLogCounter(1) // Reset counter state to 1
    recentLogs.clear() // Clear deduplication map
    storageAdapter.removeItem(LOGS_STORAGE_KEY)
    storageAdapter.removeItem(LOG_COUNTER_KEY)
  }, [storageAdapter, recentLogs])

  // Use global error handlers hook
  useGlobalErrorHandlers({
    onLog: addLog,
    interceptConsole: true,
    interceptNetwork: true,
    captureGlobalErrors: true
  })

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
