/**
 * LocalStorageRepository
 *
 * Concrete implementation of IStorageRepository that uses browser localStorage.
 * Wraps the existing storageService to provide a repository interface.
 *
 * Benefits:
 * - SSR-safe (checks for window before accessing localStorage)
 * - Handles JSON serialization/deserialization
 * - Graceful error handling (returns null/false on errors)
 * - Type-safe with generics
 */

import type { IStorageRepository } from '@/domain/repositories'
import { getJSON, setJSON, removeItem } from '@/lib/services/storageService'

/**
 * Repository implementation for localStorage
 */
export class LocalStorageRepository implements IStorageRepository {
  /**
   * Retrieve a value from localStorage
   */
  get<T>(key: string): T | null {
    return getJSON<T>(key)
  }

  /**
   * Store a value in localStorage
   */
  set<T>(key: string, value: T): boolean {
    return setJSON(key, value)
  }

  /**
   * Remove a value from localStorage
   */
  remove(key: string): boolean {
    return removeItem(key)
  }

  /**
   * Clear all values from localStorage
   */
  clear(): boolean {
    if (typeof window === 'undefined') {
      return false
    }

    try {
      window.localStorage.clear()
      return true
    } catch (error) {
      console.error('Failed to clear localStorage:', error)
      return false
    }
  }

  /**
   * Check if a key exists in localStorage
   */
  has(key: string): boolean {
    if (typeof window === 'undefined') {
      return false
    }

    try {
      return window.localStorage.getItem(key) !== null
    } catch (error) {
      return false
    }
  }

  /**
   * Get all keys currently in localStorage
   */
  keys(): string[] {
    if (typeof window === 'undefined') {
      return []
    }

    try {
      const keys: string[] = []
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i)
        if (key) {
          keys.push(key)
        }
      }
      return keys
    } catch (error) {
      console.error('Failed to get localStorage keys:', error)
      return []
    }
  }
}
