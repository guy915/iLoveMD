import { useState, useEffect, useRef, useCallback } from 'react'
import { MARKER_CONFIG, STORAGE_KEYS } from '@/lib/constants'
import * as storageService from '@/lib/services/storageService'
import type { MarkerOptions } from '@/types'
import { useLogs } from '@/contexts/LogContext'

interface UseConversionOptionsReturn {
  options: MarkerOptions
  handleOptionChange: (key: keyof MarkerOptions, value: boolean | string) => void
  hasLoadedOptions: boolean
}

/**
 * Custom hook for managing conversion options with localStorage persistence.
 * Handles option loading, saving, and change logging.
 */
export function useConversionOptions(): UseConversionOptionsReturn {
  const [options, setOptions] = useState<MarkerOptions>(MARKER_CONFIG.DEFAULT_OPTIONS)
  const [hasLoadedOptions, setHasLoadedOptions] = useState(false)
  const { addLog } = useLogs()
  const prevOptionsRef = useRef<MarkerOptions>(options)

  // Load options from localStorage on mount
  useEffect(() => {
    const savedOptions = storageService.getJSON<Partial<MarkerOptions>>(STORAGE_KEYS.MARKER_OPTIONS)
    if (savedOptions) {
      // Merge with defaults to handle missing fields from old versions
      const mergedOptions = { ...MARKER_CONFIG.DEFAULT_OPTIONS, ...savedOptions }
      setOptions(mergedOptions)
      addLog('info', 'Loaded saved options from localStorage', { options: mergedOptions })
    }
    setHasLoadedOptions(true)
  }, [addLog])

  // Save options to localStorage whenever they change (after initial load)
  useEffect(() => {
    if (hasLoadedOptions) {
      storageService.setJSON(STORAGE_KEYS.MARKER_OPTIONS, options)
    }
  }, [options, hasLoadedOptions])

  // Log option changes using useEffect to avoid setState-during-render warning
  // This observes the committed state changes rather than calling addLog during render
  useEffect(() => {
    // Skip logging on initial load
    if (!hasLoadedOptions) return

    // Find which option changed by comparing with previous state
    const prev = prevOptionsRef.current
    const current = options

    for (const key in current) {
      const typedKey = key as keyof MarkerOptions
      if (prev[typedKey] !== current[typedKey]) {
        addLog('info', `Option changed: ${key}`, {
          newValue: current[typedKey],
          allOptions: current
        })
        break // Only log first change to avoid duplicate logs when multiple options change
      }
    }

    // Update ref for next comparison
    prevOptionsRef.current = options
  }, [options, hasLoadedOptions, addLog])

  const handleOptionChange = useCallback((key: keyof MarkerOptions, value: boolean | string) => {
    setOptions(prev => ({ ...prev, [key]: value }))
  }, [])

  return { options, handleOptionChange, hasLoadedOptions }
}
