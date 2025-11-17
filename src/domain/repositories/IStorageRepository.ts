/**
 * Repository interface for persistent storage
 *
 * This interface abstracts storage operations (localStorage, sessionStorage, etc.)
 * allowing the domain logic to persist and retrieve data without knowing
 * the underlying storage mechanism.
 *
 * Benefits:
 * - Storage implementation can be swapped (localStorage → IndexedDB → API)
 * - Easy to test with in-memory implementation
 * - SSR-safe (implementation handles window checks)
 * - Type-safe with generics
 */

/**
 * Repository interface for storing and retrieving user preferences
 */
export interface IStorageRepository {
  /**
   * Retrieve a value from storage
   *
   * @param key - Storage key
   * @returns The stored value or null if not found
   */
  get<T>(key: string): T | null

  /**
   * Store a value in storage
   *
   * @param key - Storage key
   * @param value - Value to store (will be serialized to JSON)
   * @returns true if stored successfully, false otherwise
   */
  set<T>(key: string, value: T): boolean

  /**
   * Remove a value from storage
   *
   * @param key - Storage key to remove
   * @returns true if removed successfully, false otherwise
   */
  remove(key: string): boolean

  /**
   * Clear all values from storage
   *
   * @returns true if cleared successfully, false otherwise
   */
  clear(): boolean

  /**
   * Check if a key exists in storage
   *
   * @param key - Storage key to check
   * @returns true if the key exists, false otherwise
   */
  has(key: string): boolean

  /**
   * Get all keys currently in storage
   *
   * @returns Array of all storage keys
   */
  keys(): string[]
}

/**
 * Storage keys used in the application
 */
export const STORAGE_KEYS = {
  MARKER_API_KEY: 'markerApiKey',
  GEMINI_API_KEY: 'geminiApiKey',
  MARKER_MODE: 'markerMode',
  MARKER_OPTIONS: 'markerOptions',
  DIAGNOSTIC_LOGS: 'diagnosticLogs',
  LOG_COUNTER: 'logCounter',
} as const
