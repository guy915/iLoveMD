import { useState, useEffect } from 'react'
import { STORAGE_KEYS } from '@/lib/constants'
import * as storageService from '@/lib/services/storageService'
import { useLogs } from '@/contexts/LogContext'

interface UseApiKeysReturn {
  apiKey: string
  setApiKey: (key: string) => void
  geminiApiKey: string
  setGeminiApiKey: (key: string) => void
  hasLoadedKeys: boolean
}

/**
 * Custom hook for managing API keys with localStorage persistence.
 * Handles loading and saving of Marker API key and Gemini API key.
 */
export function useApiKeys(): UseApiKeysReturn {
  const [apiKey, setApiKeyState] = useState('')
  const [geminiApiKey, setGeminiApiKeyState] = useState('')
  const [hasLoadedKeys, setHasLoadedKeys] = useState(false)
  const { addLog } = useLogs()

  // Load API keys from localStorage on mount
  useEffect(() => {
    const savedMarkerKey = storageService.getItem(STORAGE_KEYS.MARKER_API_KEY)
    // One-time migration: Remove old test key if found
    const OLD_TEST_KEY = 'w4IU5bCYNudH_JZ0IKCUIZAo8ive3gc6ZPk6mzLtqxQ'
    if (savedMarkerKey === OLD_TEST_KEY) {
      storageService.removeItem(STORAGE_KEYS.MARKER_API_KEY)
      addLog('info', 'Removed old test API key from localStorage')
    } else if (savedMarkerKey) {
      setApiKeyState(savedMarkerKey)
      addLog('info', 'Loaded saved Marker API key from localStorage')
    }

    const savedGeminiKey = storageService.getItem(STORAGE_KEYS.GEMINI_API_KEY)
    if (savedGeminiKey) {
      setGeminiApiKeyState(savedGeminiKey)
      addLog('info', 'Loaded saved Gemini API key from localStorage')
    }

    setHasLoadedKeys(true)
  }, [addLog])

  // Save Marker API key to localStorage whenever it changes
  useEffect(() => {
    if (hasLoadedKeys) {
      storageService.setItem(STORAGE_KEYS.MARKER_API_KEY, apiKey)
    }
  }, [apiKey, hasLoadedKeys])

  // Save Gemini API key to localStorage whenever it changes
  useEffect(() => {
    if (hasLoadedKeys) {
      storageService.setItem(STORAGE_KEYS.GEMINI_API_KEY, geminiApiKey)
    }
  }, [geminiApiKey, hasLoadedKeys])

  return {
    apiKey,
    setApiKey: setApiKeyState,
    geminiApiKey,
    setGeminiApiKey: setGeminiApiKeyState,
    hasLoadedKeys
  }
}
