/**
 * Storage abstraction exports
 */

export * from './IStorageAdapter'
export * from './LocalStorageAdapter'
export * from './SessionStorageAdapter'

// Export types for convenience
export type { StorageOptions } from './IStorageAdapter'
export type { SessionStorageOptions } from './SessionStorageAdapter'

