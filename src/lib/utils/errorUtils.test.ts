import { describe, it, expect, vi } from 'vitest'
import {
  isTransientError,
  delay,
  retryWithBackoff,
  getErrorMessage,
  classifyError,
  createErrorLogData
} from './errorUtils'
import { ErrorCode } from '@/types'

describe('errorUtils', () => {
  describe('isTransientError', () => {
    it('should return false for non-object errors', () => {
      expect(isTransientError('string error')).toBe(false)
      expect(isTransientError(123)).toBe(false)
      expect(isTransientError(null)).toBe(false)
      expect(isTransientError(undefined)).toBe(false)
    })

    it('should return false for AbortError (user cancelled)', () => {
      const error = { name: 'AbortError' }
      expect(isTransientError(error)).toBe(false)
    })

    it('should return true for fetch TypeError', () => {
      const error = { name: 'TypeError', message: 'fetch failed' }
      expect(isTransientError(error)).toBe(true)
    })

    it('should return true for timeout errors', () => {
      expect(isTransientError({ code: 'ETIMEDOUT' })).toBe(true)
      expect(isTransientError({ code: 'ESOCKETTIMEDOUT' })).toBe(true)
    })

    it('should return true for connection errors', () => {
      expect(isTransientError({ code: 'ECONNREFUSED' })).toBe(true)
      expect(isTransientError({ code: 'ECONNRESET' })).toBe(true)
    })

    it('should return true for 5xx HTTP errors', () => {
      expect(isTransientError({ status: 500 })).toBe(true)
      expect(isTransientError({ status: 502 })).toBe(true)
      expect(isTransientError({ status: 503 })).toBe(true)
      expect(isTransientError({ status: 504 })).toBe(true)
      expect(isTransientError({ status: 599 })).toBe(true)
    })

    it('should return true for specific transient status codes', () => {
      expect(isTransientError({ status: 408 })).toBe(true) // Request Timeout
      expect(isTransientError({ status: 429 })).toBe(true) // Too Many Requests
    })

    it('should return false for non-transient errors', () => {
      expect(isTransientError({ status: 400 })).toBe(false)
      expect(isTransientError({ status: 401 })).toBe(false)
      expect(isTransientError({ status: 404 })).toBe(false)
      expect(isTransientError({ name: 'ValidationError' })).toBe(false)
    })
  })

  describe('delay', () => {
    it('should delay for specified milliseconds', async () => {
      const start = Date.now()
      await delay(100)
      const elapsed = Date.now() - start
      expect(elapsed).toBeGreaterThanOrEqual(90) // Allow some margin
    })
  })

  describe('retryWithBackoff', () => {
    it('should succeed on first attempt if function succeeds', async () => {
      const fn = vi.fn().mockResolvedValue('success')
      const result = await retryWithBackoff(fn, { maxAttempts: 3 })
      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should retry on transient errors', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce({ status: 503 })
        .mockRejectedValueOnce({ status: 503 })
        .mockResolvedValue('success')

      const result = await retryWithBackoff(fn, {
        maxAttempts: 3,
        initialDelayMs: 10
      })

      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(3)
    })

    it('should not retry on non-transient errors', async () => {
      const fn = vi.fn().mockRejectedValue({ status: 400 })

      await expect(
        retryWithBackoff(fn, { maxAttempts: 3, initialDelayMs: 10 })
      ).rejects.toEqual({ status: 400 })

      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should throw last error after max attempts', async () => {
      const error = { status: 503, message: 'Service Unavailable' }
      const fn = vi.fn().mockRejectedValue(error)

      await expect(
        retryWithBackoff(fn, { maxAttempts: 3, initialDelayMs: 10 })
      ).rejects.toEqual(error)

      expect(fn).toHaveBeenCalledTimes(3)
    })

    it('should use exponential backoff', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce({ status: 503 })
        .mockRejectedValueOnce({ status: 503 })
        .mockResolvedValue('success')

      const onRetry = vi.fn()

      await retryWithBackoff(fn, {
        maxAttempts: 3,
        initialDelayMs: 50,
        backoffMultiplier: 2,
        onRetry
      })

      // Should have retried twice
      expect(onRetry).toHaveBeenCalledTimes(2)
      expect(onRetry).toHaveBeenNthCalledWith(1, 1, { status: 503 })
      expect(onRetry).toHaveBeenNthCalledWith(2, 2, { status: 503 })
    })

    it('should cap delay at maxDelayMs', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce({ status: 503 })
        .mockRejectedValueOnce({ status: 503 })
        .mockResolvedValue('success')

      const start = Date.now()

      await retryWithBackoff(fn, {
        maxAttempts: 3,
        initialDelayMs: 100,
        maxDelayMs: 50,
        backoffMultiplier: 2
      })

      const elapsed = Date.now() - start
      // Should use maxDelayMs (50) instead of exponential (100, 200)
      expect(elapsed).toBeLessThan(150)
    })

    it('should call onRetry callback', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce({ status: 503 })
        .mockResolvedValue('success')

      const onRetry = vi.fn()

      await retryWithBackoff(fn, {
        maxAttempts: 2,
        initialDelayMs: 10,
        onRetry
      })

      expect(onRetry).toHaveBeenCalledTimes(1)
      expect(onRetry).toHaveBeenCalledWith(1, { status: 503 })
    })

    it('should use custom shouldRetry function', async () => {
      const fn = vi.fn().mockRejectedValue({ code: 'CUSTOM_ERROR' })
      const shouldRetry = vi.fn().mockReturnValue(false)

      await expect(
        retryWithBackoff(fn, {
          maxAttempts: 3,
          initialDelayMs: 10,
          shouldRetry
        })
      ).rejects.toEqual({ code: 'CUSTOM_ERROR' })

      expect(fn).toHaveBeenCalledTimes(1)
      expect(shouldRetry).toHaveBeenCalledWith({ code: 'CUSTOM_ERROR' })
    })
  })

  describe('getErrorMessage', () => {
    it('should extract message from string error', () => {
      expect(getErrorMessage('Error occurred')).toBe('Error occurred')
    })

    it('should extract message from Error object', () => {
      const error = new Error('Something went wrong')
      expect(getErrorMessage(error)).toBe('Something went wrong')
    })

    it('should extract message from object with message property', () => {
      expect(getErrorMessage({ message: 'Failed' })).toBe('Failed')
    })

    it('should extract error from object with error property', () => {
      expect(getErrorMessage({ error: 'Not found' })).toBe('Not found')
    })

    it('should return default message for unknown types', () => {
      expect(getErrorMessage(null)).toBe('An unknown error occurred')
      expect(getErrorMessage(undefined)).toBe('An unknown error occurred')
      expect(getErrorMessage(123)).toBe('An unknown error occurred')
      expect(getErrorMessage({})).toBe('An unknown error occurred')
    })
  })

  describe('classifyError', () => {
    it('should return UNKNOWN_ERROR for non-objects', () => {
      expect(classifyError(null)).toBe(ErrorCode.UNKNOWN_ERROR)
      expect(classifyError('error')).toBe(ErrorCode.UNKNOWN_ERROR)
      expect(classifyError(123)).toBe(ErrorCode.UNKNOWN_ERROR)
    })

    it('should classify quota errors', () => {
      expect(classifyError({ name: 'QuotaExceededError' })).toBe(ErrorCode.QUOTA_EXCEEDED)
      expect(classifyError({ message: 'quota exceeded' })).toBe(ErrorCode.QUOTA_EXCEEDED)
    })

    it('should classify memory errors', () => {
      expect(classifyError({ message: 'out of memory' })).toBe(ErrorCode.OUT_OF_MEMORY)
      expect(classifyError({ message: 'allocation failed' })).toBe(ErrorCode.OUT_OF_MEMORY)
    })

    it('should classify network timeout errors', () => {
      expect(classifyError({ name: 'AbortError' })).toBe(ErrorCode.NETWORK_TIMEOUT)
      expect(classifyError({ code: 'ETIMEDOUT' })).toBe(ErrorCode.NETWORK_TIMEOUT)
      expect(classifyError({ code: 'ESOCKETTIMEDOUT' })).toBe(ErrorCode.NETWORK_TIMEOUT)
    })

    it('should classify network connection errors', () => {
      expect(classifyError({ code: 'ECONNREFUSED' })).toBe(ErrorCode.NETWORK_CONNECTION)
    })

    it('should classify DNS errors', () => {
      expect(classifyError({ code: 'ENOTFOUND' })).toBe(ErrorCode.NETWORK_DNS)
      expect(classifyError({ code: 'EAI_AGAIN' })).toBe(ErrorCode.NETWORK_DNS)
    })

    it('should classify file errors', () => {
      expect(classifyError({ name: 'NotFoundError' })).toBe(ErrorCode.FILE_NOT_FOUND)
      expect(classifyError({ name: 'SecurityError' })).toBe(ErrorCode.FILE_SECURITY_ERROR)
      expect(classifyError({ name: 'NotReadableError' })).toBe(ErrorCode.FILE_NOT_READABLE)
    })

    it('should classify HTTP errors', () => {
      expect(classifyError({ status: 413 })).toBe(ErrorCode.FILE_TOO_LARGE)
      expect(classifyError({ status: 400 })).toBe(ErrorCode.INVALID_OPTIONS)
      expect(classifyError({ status: 401 })).toBe(ErrorCode.INVALID_API_KEY)
      expect(classifyError({ status: 403 })).toBe(ErrorCode.INVALID_API_KEY)
      expect(classifyError({ status: 500 })).toBe(ErrorCode.EXTERNAL_SERVICE_ERROR)
      expect(classifyError({ status: 503 })).toBe(ErrorCode.EXTERNAL_SERVICE_ERROR)
    })

    it('should return UNEXPECTED_ERROR for unclassified errors', () => {
      expect(classifyError({ unknown: 'field' })).toBe(ErrorCode.UNEXPECTED_ERROR)
    })
  })

  describe('createErrorLogData', () => {
    it('should create log data from Error object', () => {
      const error = new Error('Test error')
      const logData = createErrorLogData(error)

      expect(logData.message).toBe('Test error')
      expect(logData.code).toBe(ErrorCode.UNEXPECTED_ERROR)
      expect(logData.name).toBe('Error')
      expect(logData.stack).toBeDefined()
    })

    it('should create log data from object with status', () => {
      const error = { status: 500, message: 'Server error' }
      const logData = createErrorLogData(error)

      expect(logData.message).toBe('Server error')
      expect(logData.code).toBe(ErrorCode.EXTERNAL_SERVICE_ERROR)
      expect(logData.name).toBe('object')
    })

    it('should create log data from string', () => {
      const error = 'Simple error string'
      const logData = createErrorLogData(error)

      expect(logData.message).toBe('Simple error string')
      expect(logData.code).toBe(ErrorCode.UNKNOWN_ERROR)
      expect(logData.name).toBe('string')
      expect(logData.stack).toBeUndefined()
    })

    it('should truncate stack trace to 5 lines', () => {
      const error = new Error('Test error')
      // Create a fake long stack trace
      error.stack = Array(20).fill('at function (file:line)').join('\n')

      const logData = createErrorLogData(error)

      const stackLines = logData.stack?.split('\n').length || 0
      expect(stackLines).toBeLessThanOrEqual(5)
    })
  })
})
