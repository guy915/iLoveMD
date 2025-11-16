/**
 * Error handling utilities for consistent error management
 *
 * This module provides infrastructure for standardized error handling across the application.
 * While not currently integrated into all error handling code, these utilities are available
 * for use when implementing new features or refactoring existing error handling.
 *
 * Key use cases:
 * - Use `retryWithBackoff()` for network operations that might fail transiently
 * - Use `classifyError()` to standardize error codes in API responses
 * - Use `createErrorLogData()` for consistent error logging format
 * - Use `isTransientError()` to determine if an operation should be retried
 *
 * Example usage:
 * ```typescript
 * import { retryWithBackoff, createErrorLogData } from '@/lib/utils/errorUtils'
 *
 * // Retry a network request with exponential backoff
 * const data = await retryWithBackoff(
 *   () => fetch('/api/endpoint').then(r => r.json()),
 *   { maxAttempts: 3, initialDelayMs: 1000 }
 * )
 *
 * // Log error with standardized format
 * try {
 *   // ... operation
 * } catch (error) {
 *   addLog('error', 'Operation failed', createErrorLogData(error))
 * }
 * ```
 */

import { ErrorCode } from '@/types'

/**
 * Check if an error is a transient error that can be retried
 */
export function isTransientError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false
  }

  const err = error as any

  // Network errors are usually transient
  if (err.name === 'AbortError') return false // User intentionally aborted
  if (err.name === 'TypeError' && err.message?.includes('fetch')) return true
  if (err.code === 'ETIMEDOUT' || err.code === 'ESOCKETTIMEDOUT') return true
  if (err.code === 'ECONNREFUSED') return true
  if (err.code === 'ECONNRESET') return true

  // HTTP 5xx errors are transient (server errors)
  if (err.status >= 500 && err.status < 600) return true

  // Specific transient status codes
  if (err.status === 408) return true // Request Timeout
  if (err.status === 429) return true // Too Many Requests
  if (err.status === 502) return true // Bad Gateway
  if (err.status === 503) return true // Service Unavailable
  if (err.status === 504) return true // Gateway Timeout

  return false
}

/**
 * Delay execution for a specified number of milliseconds
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Retry a function with exponential backoff
 *
 * @param fn Function to retry
 * @param options Retry options
 * @returns Result of the function
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number
    initialDelayMs?: number
    maxDelayMs?: number
    backoffMultiplier?: number
    shouldRetry?: (error: unknown) => boolean
    onRetry?: (attempt: number, error: unknown) => void
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelayMs = 1000,
    maxDelayMs = 30000,
    backoffMultiplier = 2,
    shouldRetry = isTransientError,
    onRetry
  } = options

  let lastError: unknown
  let currentDelay = initialDelayMs

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      // Don't retry if this is the last attempt
      if (attempt === maxAttempts) {
        break
      }

      // Don't retry if the error is not transient
      if (!shouldRetry(error)) {
        break
      }

      // Call retry callback if provided
      if (onRetry) {
        onRetry(attempt, error)
      }

      // Wait before retrying with exponential backoff
      await delay(Math.min(currentDelay, maxDelayMs))
      currentDelay *= backoffMultiplier
    }
  }

  // All attempts failed, throw the last error
  throw lastError
}

/**
 * Extract error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error
  }

  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'object' && error !== null) {
    const err = error as any
    if (typeof err.message === 'string') {
      return err.message
    }
    if (typeof err.error === 'string') {
      return err.error
    }
  }

  return 'An unknown error occurred'
}

/**
 * Classify error and return appropriate ErrorCode
 */
export function classifyError(error: unknown): ErrorCode {
  if (typeof error !== 'object' || error === null) {
    return ErrorCode.UNKNOWN_ERROR
  }

  const err = error as any

  // Memory errors
  if (err.name === 'QuotaExceededError' || err.message?.toLowerCase().includes('quota')) {
    return ErrorCode.QUOTA_EXCEEDED
  }
  if (err.message?.toLowerCase().includes('memory') || err.message?.toLowerCase().includes('allocation')) {
    return ErrorCode.OUT_OF_MEMORY
  }

  // Network errors
  if (err.name === 'AbortError') {
    return ErrorCode.NETWORK_TIMEOUT
  }
  if (err.code === 'ETIMEDOUT' || err.code === 'ESOCKETTIMEDOUT') {
    return ErrorCode.NETWORK_TIMEOUT
  }
  if (err.code === 'ECONNREFUSED') {
    return ErrorCode.NETWORK_CONNECTION
  }
  if (err.code === 'ENOTFOUND' || err.code === 'EAI_AGAIN') {
    return ErrorCode.NETWORK_DNS
  }

  // File errors
  if (err.name === 'NotFoundError') {
    return ErrorCode.FILE_NOT_FOUND
  }
  if (err.name === 'SecurityError') {
    return ErrorCode.FILE_SECURITY_ERROR
  }
  if (err.name === 'NotReadableError') {
    return ErrorCode.FILE_NOT_READABLE
  }

  // HTTP errors
  if (err.status) {
    if (err.status === 413) return ErrorCode.FILE_TOO_LARGE
    if (err.status === 400) return ErrorCode.INVALID_OPTIONS
    if (err.status === 401 || err.status === 403) return ErrorCode.INVALID_API_KEY
    if (err.status >= 500) return ErrorCode.EXTERNAL_SERVICE_ERROR
  }

  return ErrorCode.UNEXPECTED_ERROR
}

/**
 * Create a standardized error response for logging
 */
export function createErrorLogData(error: unknown): Record<string, unknown> {
  return {
    message: getErrorMessage(error),
    code: classifyError(error),
    name: error instanceof Error ? error.name : typeof error,
    stack: error instanceof Error ? error.stack?.split('\n').slice(0, 5).join('\n') : undefined
  }
}
