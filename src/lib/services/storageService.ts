/**
 * Storage Service - Abstraction layer for browser storage
 *
 * This service provides a clean interface for localStorage operations,
 * using the storage adapter pattern for better testability and flexibility.
 *
 * Benefits:
 * - Uses IStorageAdapter interface for clean abstraction
 * - Easy to swap implementations (localStorage → IndexedDB → API)
 * - SSR-safe with automatic window checks
 * - Centralized error handling
 */

import { LocalStorageAdapter } from '@/lib/storage'

// Create singleton adapter instance
const storageAdapter = new LocalStorageAdapter()

/**
 * Reset adapter state (useful for testing)
 */
export function resetAdapter(): void {
  storageAdapter.reset()
}

/**
 * Get an item from localStorage
 * @param key - The storage key
 * @returns The stored value or null if not found
 */
export function getItem(key: string): string | null {
  return storageAdapter.getItem(key)
}

/**
 * Set an item in localStorage
 * @param key - The storage key
 * @param value - The value to store
 * @returns True if successful, false otherwise
 */
export function setItem(key: string, value: string): boolean {
  return storageAdapter.setItem(key, value)
}

/**
 * Remove an item from localStorage
 * @param key - The storage key
 * @returns True if successful, false otherwise
 */
export function removeItem(key: string): boolean {
  return storageAdapter.removeItem(key)
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
