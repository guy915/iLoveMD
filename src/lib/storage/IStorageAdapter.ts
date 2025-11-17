/**
 * Storage Adapter Interface
 *
 * Defines the contract for storage implementations (localStorage, sessionStorage, IndexedDB, etc.)
 * This abstraction allows swapping storage mechanisms without changing business logic.
 *
 * Benefits:
 * - Testability: Can mock storage for unit tests
 * - Flexibility: Easy to swap implementations
 * - SSR-safe: Adapters handle window checks internally
 * - Error handling: Centralized error handling logic
 */

/**
 * Options for storage operations
 */
export interface StorageOptions {
  /**
   * Whether to throw errors or return null/false on failure
   * @default false (graceful failure)
   */
  throwOnError?: boolean

  /**
   * Custom error handler
   */
  onError?: (error: Error, operation: string, key: string) => void
}

/**
 * Storage adapter interface for different storage mechanisms
 */
export interface IStorageAdapter {
  /**
   * Get a value from storage
   * @param key - Storage key
   * @returns The stored value or null if not found/unavailable
   */
  getItem(key: string): string | null

  /**
   * Set a value in storage
   * @param key - Storage key
   * @param value - Value to store
   * @param options - Optional storage options
   * @returns True if successful, false otherwise
   */
  setItem(key: string, value: string, options?: StorageOptions): boolean

  /**
   * Remove a value from storage
   * @param key - Storage key
   * @param options - Optional storage options
   * @returns True if successful, false otherwise
   */
  removeItem(key: string, options?: StorageOptions): boolean

  /**
   * Check if storage is available
   * @returns True if storage is available, false otherwise
   */
  isAvailable(): boolean

  /**
   * Clear all items from storage
   * @param options - Optional storage options
   * @returns True if successful, false otherwise
   */
  clear(options?: StorageOptions): boolean

  /**
   * Get the number of items in storage
   * @returns Number of items or 0 if unavailable
   */
  length(): number
}

