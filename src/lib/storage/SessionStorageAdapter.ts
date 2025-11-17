/**
 * SessionStorage Adapter
 *
 * Implementation of IStorageAdapter for browser sessionStorage.
 * Handles SSR safety, quota errors, and provides graceful fallbacks.
 * Includes automatic quota management with log trimming.
 */

import type { IStorageAdapter, StorageOptions } from './IStorageAdapter'

/**
 * Options specific to sessionStorage operations
 */
export interface SessionStorageOptions extends StorageOptions {
  /**
   * Automatically trim logs when quota is exceeded
   * @default false
   */
  autoTrimOnQuota?: boolean

  /**
   * Maximum items to keep when auto-trimming
   * @default 30
   */
  maxItemsOnTrim?: number
}

/**
 * Adapter for browser sessionStorage
 */
export class SessionStorageAdapter implements IStorageAdapter {
  private quotaExceeded = false

  constructor() {
    // Adapter instance created - availability checked dynamically
  }

  /**
   * Get the storage instance (checked dynamically for test compatibility)
   */
  private getStorage(): Storage | null {
    if (typeof window === 'undefined' || typeof window.sessionStorage === 'undefined') {
      return null
    }
    return window.sessionStorage
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

  setItem(key: string, value: string, options?: SessionStorageOptions): boolean {
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
      
      // Handle quota exceeded errors with auto-trimming
      if (err.name === 'QuotaExceededError') {
        this.quotaExceeded = true
        
        // Try auto-trimming if enabled and value is an array
        if (options?.autoTrimOnQuota && this.isArrayValue(value)) {
          const trimmed = this.trimArrayValue(value, options.maxItemsOnTrim || 30)
          if (trimmed) {
            // Retry with trimmed value (disable auto-trim to prevent recursion)
            const retryOptions: SessionStorageOptions = {
              ...options,
              autoTrimOnQuota: false
            }
            const retryResult = this.setItem(key, trimmed, retryOptions)
            // If retry with trimmed data also fails, log a warning
            if (!retryResult && options?.onError) {
              options.onError(
                new Error('Storage quota exceeded even after auto-trimming'),
                'setItem',
                key
              )
            }
            return retryResult
          }
        }
        
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
   * Check if value is a JSON array (for auto-trimming)
   */
  private isArrayValue(value: string): boolean {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed)
    } catch {
      return false
    }
  }

  /**
   * Trim array value to keep only most recent items
   */
  private trimArrayValue(value: string, maxItems: number): string | null {
    try {
      const array = JSON.parse(value) as unknown[]
      if (Array.isArray(array) && array.length > maxItems) {
        const trimmed = array.slice(-maxItems)
        return JSON.stringify(trimmed)
      }
    } catch {
      // If parsing/trimming fails, return null
    }
    return null
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
        console.warn(`[SessionStorageAdapter] ${operation} failed for key "${key}":`, error)
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

