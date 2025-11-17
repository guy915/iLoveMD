import { useState, useEffect } from 'react'
import { STORAGE_KEYS } from '@/lib/constants'
import * as storageService from '@/lib/services/storageService'
import { useLogs } from '@/contexts/LogContext'

export type ConversionMode = 'free' | 'paid'

interface UseConversionModeReturn {
  mode: ConversionMode
  setMode: (mode: ConversionMode) => void
  mounted: boolean
}

/**
 * Custom hook for managing conversion mode state with localStorage persistence.
 * Handles SSR-safe mode loading and automatic persistence.
 */
export function useConversionMode(): UseConversionModeReturn {
  // Start with 'free' to match SSR, then load from localStorage after mount
  const [mode, setModeState] = useState<ConversionMode>('free')
  const [mounted, setMounted] = useState(false)
  const { addLog } = useLogs()

  // Load mode from localStorage on mount
  useEffect(() => {
    setMounted(true)

    const savedMode = storageService.getItem(STORAGE_KEYS.MARKER_MODE) as 'free' | 'paid' | 'local' | 'cloud' | null
    // Support old mode names for backwards compatibility
    if (savedMode === 'free' || savedMode === 'paid') {
      setModeState(savedMode)
    } else if (savedMode === 'local') {
      setModeState('free') // Old 'local' → new 'free'
    } else if (savedMode === 'cloud') {
      setModeState('paid') // Old 'cloud' → new 'paid'
    }
  }, [])

  // Save mode to localStorage whenever it changes (only after mount)
  useEffect(() => {
    if (mounted) {
      storageService.setItem(STORAGE_KEYS.MARKER_MODE, mode)
    }
  }, [mode, mounted])

  const setMode = (newMode: ConversionMode) => {
    setModeState(newMode)
    addLog('info', `Switched to ${newMode === 'free' ? 'Free mode (Modal GPU)' : 'Paid mode (Marker API)'}`)
  }

  return { mode, setMode, mounted }
}
