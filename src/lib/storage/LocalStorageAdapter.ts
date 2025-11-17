/**
 * LocalStorage Adapter
 *
 * Implementation of IStorageAdapter for browser localStorage.
 * Handles SSR safety, quota errors, and provides graceful fallbacks.
 */

import type { IStorageAdapter, StorageOptions } from './IStorageAdapter'

/**
 * Adapter for browser localStorage
 */
export class LocalStorageAdapter implements IStorageAdapter {
  private quotaExceeded = false

  constructor() {
    // Adapter instance created - availability checked dynamically
  }

  /**
   * Reset internal state (useful for testing)
   */
  reset(): void {
    this.quotaExceeded = false
  }

  /**
   * Get the storage instance (checked dynamically for test compatibility)
   */
  private getStorage(): Storage | null {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
      return null
    }
    return window.localStorage
  }

  isAvailable(): boolean {
    return this.getStorage() !== null
  }

  getItem(key: string): string | null {
    const storage = this.getStorage()
    if (!storage) {
      return null
    }

    try {
      return storage.getItem(key)
    } catch (error) {
      this.handleError(error as Error, 'getItem', key)
      return null
    }
  }

  setItem(key: string, value: string, options?: StorageOptions): boolean {
    const storage = this.getStorage()
    if (!storage) {
      return false
    }

    try {
      storage.setItem(key, value)
      // Reset quota flag on successful write
      this.quotaExceeded = false
      return true
    } catch (error) {
      const err = error as Error
      
      // Handle quota exceeded errors
      if (err.name === 'QuotaExceededError') {
        this.quotaExceeded = true
        this.handleError(err, 'setItem', key, options)
      } else {
        this.handleError(err, 'setItem', key, options)
      }
      
      return false
    }
  }

  removeItem(key: string, options?: StorageOptions): boolean {
    const storage = this.getStorage()
    if (!storage) {
      return false
    }

    try {
      storage.removeItem(key)
      return true
    } catch (error) {
      this.handleError(error as Error, 'removeItem', key, options)
      return false
    }
  }

  clear(options?: StorageOptions): boolean {
    const storage = this.getStorage()
    if (!storage) {
      return false
    }

    try {
      storage.clear()
      return true
    } catch (error) {
      this.handleError(error as Error, 'clear', '', options)
      return false
    }
  }

  length(): number {
    const storage = this.getStorage()
    if (!storage) {
      return 0
    }

    try {
      return storage.length
    } catch {
      return 0
    }
  }

  /**
   * Handle storage errors with optional error handler
   */
  private handleError(
    error: Error,
    operation: string,
    key: string,
    options?: StorageOptions
  ): void {
    if (options?.onError) {
      options.onError(error, operation, key)
    } else if (options?.throwOnError) {
      throw error
    } else {
      // Silent failure by default (graceful degradation)
      // Only log getItem errors to avoid spam (setItem/removeItem errors are usually quota issues)
      if (operation === 'getItem') {
        console.warn(`[LocalStorageAdapter] ${operation} failed for key "${key}":`, error)
      }
    }
  }

  /**
   * Check if quota was exceeded (useful for retry logic)
   */
  wasQuotaExceeded(): boolean {
    return this.quotaExceeded
  }
}

