/**
 * Storage Service - Abstraction layer for browser storage
 *
 * This service provides a clean interface for localStorage operations,
 * making it easier to:
 * - Test components without browser dependencies
 * - Migrate to different storage mechanisms (sessionStorage, IndexedDB, etc.)
 * - Handle SSR safely
 * - Centralize error handling
 */

/**
 * Checks if localStorage is available (handles SSR)
 */
function isStorageAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

/**
 * Get an item from localStorage
 * @param key - The storage key
 * @returns The stored value or null if not found
 */
export function getItem(key: string): string | null {
  if (!isStorageAvailable()) {
    return null
  }

  try {
    return localStorage.getItem(key)
  } catch (error) {
    console.error(`[StorageService] Failed to get item "${key}":`, error)
    return null
  }
}

/**
 * Set an item in localStorage
 * @param key - The storage key
 * @param value - The value to store
 * @returns True if successful, false otherwise
 */
export function setItem(key: string, value: string): boolean {
  if (!isStorageAvailable()) {
    return false
  }

  try {
    localStorage.setItem(key, value)
    return true
  } catch (error) {
    console.error(`[StorageService] Failed to set item "${key}":`, error)
    return false
  }
}

/**
 * Remove an item from localStorage
 * @param key - The storage key
 * @returns True if successful, false otherwise
 */
export function removeItem(key: string): boolean {
  if (!isStorageAvailable()) {
    return false
  }

  try {
    localStorage.removeItem(key)
    return true
  } catch (error) {
    console.error(`[StorageService] Failed to remove item "${key}":`, error)
    return false
  }
}

/**
 * Get a JSON object from localStorage
 * @param key - The storage key
 * @returns The parsed object or null if not found/invalid
 */
export function getJSON<T>(key: string): T | null {
  const value = getItem(key)
  if (!value) {
    return null
  }

  try {
    return JSON.parse(value) as T
  } catch (error) {
    console.error(`[StorageService] Failed to parse JSON for key "${key}":`, error)
    return null
  }
}

/**
 * Set a JSON object in localStorage
 * @param key - The storage key
 * @param value - The object to store
 * @returns True if successful, false otherwise
 */
export function setJSON<T>(key: string, value: T): boolean {
  try {
    const jsonString = JSON.stringify(value)
    return setItem(key, jsonString)
  } catch (error) {
    console.error(`[StorageService] Failed to stringify JSON for key "${key}":`, error)
    return false
  }
}
