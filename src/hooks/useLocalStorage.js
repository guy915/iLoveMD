import { useState, useCallback } from 'react'

/**
 * Custom hook for syncing state with localStorage
 * Safely handles SSR by checking for window object
 *
 * @param {string} key - localStorage key to use
 * @param {any} initialValue - Initial value if key doesn't exist
 * @returns {[any, Function]} Tuple of [storedValue, setValue]
 *
 * @example
 * const [apiKey, setApiKey] = useLocalStorage('markerApiKey', '')
 * setApiKey('new-key-value')
 */
export default function useLocalStorage(key, initialValue) {
  // Initialize state with a function to avoid race condition
  const [storedValue, setStoredValue] = useState(() => {
    if (typeof window === 'undefined') return initialValue

    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch (error) {
      console.error('Error reading from localStorage:', error)
      return initialValue
    }
  })

  /**
   * Set value in both state and localStorage
   * Memoized to prevent unnecessary re-renders in child components
   * @param {any} value - Value to store
   */
  const setValue = useCallback((value) => {
    try {
      setStoredValue(value)
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(value))
      }
    } catch (error) {
      console.error('Error writing to localStorage:', error)
    }
  }, [key])

  return [storedValue, setValue]
}
