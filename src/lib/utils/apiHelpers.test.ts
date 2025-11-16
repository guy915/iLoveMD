import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getNetworkErrorType,
  getNetworkErrorMessage,
  isValidMarkerSubmitResponse,
  isValidMarkerPollResponse,
  fetchWithTimeout
} from './apiHelpers'

describe('apiHelpers', () => {
  describe('getNetworkErrorType', () => {
    it('should detect AbortError as timeout', () => {
      const error = new Error('Aborted')
      error.name = 'AbortError'
      expect(getNetworkErrorType(error)).toBe('timeout')
    })

    it('should detect ETIMEDOUT error code as timeout', () => {
      const error = { code: 'ETIMEDOUT', message: 'timeout' }
      expect(getNetworkErrorType(error)).toBe('timeout')
    })

    it('should detect ESOCKETTIMEDOUT error code as timeout', () => {
      const error = { code: 'ESOCKETTIMEDOUT', message: 'socket timeout' }
      expect(getNetworkErrorType(error)).toBe('timeout')
    })

    it('should detect ECONNREFUSED error code as connection', () => {
      const error = { code: 'ECONNREFUSED', message: 'connection refused' }
      expect(getNetworkErrorType(error)).toBe('connection')
    })

    it('should detect ENOTFOUND error code as dns', () => {
      const error = { code: 'ENOTFOUND', message: 'not found' }
      expect(getNetworkErrorType(error)).toBe('dns')
    })

    it('should detect EAI_AGAIN error code as dns', () => {
      const error = { code: 'EAI_AGAIN', message: 'dns lookup failed' }
      expect(getNetworkErrorType(error)).toBe('dns')
    })

    it('should detect timeout from error message string', () => {
      const error = new Error('request timed out')
      expect(getNetworkErrorType(error)).toBe('timeout')
    })

    it('should detect connection error from error message string', () => {
      const error = new Error('econnrefused occurred')
      expect(getNetworkErrorType(error)).toBe('connection')
    })

    it('should detect dns error from error message string', () => {
      const error = new Error('enotfound - dns failure')
      expect(getNetworkErrorType(error)).toBe('dns')
    })

    it('should return unknown for unrecognized errors', () => {
      const error = new Error('something went wrong')
      expect(getNetworkErrorType(error)).toBe('unknown')
    })

    it('should handle non-object errors', () => {
      expect(getNetworkErrorType('string error')).toBe('unknown')
      expect(getNetworkErrorType(null)).toBe('unknown')
      expect(getNetworkErrorType(undefined)).toBe('unknown')
      expect(getNetworkErrorType(123)).toBe('unknown')
    })

    it('should handle error codes in lowercase', () => {
      const error = { code: 'etimedout', message: 'timeout' }
      expect(getNetworkErrorType(error)).toBe('timeout')
    })
  })

  describe('getNetworkErrorMessage', () => {
    it('should return timeout message for cloud service', () => {
      const message = getNetworkErrorMessage('timeout', false)
      expect(message).toContain('Marker API')
      expect(message).toContain('timed out')
    })

    it('should return timeout message for local service', () => {
      const message = getNetworkErrorMessage('timeout', true)
      expect(message).toContain('local Marker instance')
      expect(message).toContain('timed out')
    })

    it('should return connection message for cloud service', () => {
      const message = getNetworkErrorMessage('connection', false)
      expect(message).toContain('Marker API')
      expect(message).toContain('temporarily unavailable')
    })

    it('should return connection message for local service with Docker instructions', () => {
      const message = getNetworkErrorMessage('connection', true)
      expect(message).toContain('local Marker instance')
      expect(message).toContain('Docker')
      expect(message).toContain('http://localhost:8000')
    })

    it('should return dns message for cloud service', () => {
      const message = getNetworkErrorMessage('dns', false)
      expect(message).toContain('Marker API')
      expect(message).toContain('internet connection')
    })

    it('should return dns message for local service', () => {
      const message = getNetworkErrorMessage('dns', true)
      expect(message).toContain('local Marker instance')
      expect(message).toContain('configuration')
    })

    it('should return generic message for unknown error type (cloud)', () => {
      const message = getNetworkErrorMessage('unknown', false)
      expect(message).toContain('Network error')
      expect(message).toContain('internet connection')
    })

    it('should return generic message for unknown error type (local)', () => {
      const message = getNetworkErrorMessage('unknown', true)
      expect(message).toContain('Network error')
      expect(message).toContain('Docker and Marker are running')
    })

    it('should default to cloud service when isLocal not specified', () => {
      const message = getNetworkErrorMessage('timeout')
      expect(message).toContain('Marker API')
      expect(message).not.toContain('local')
    })
  })

  describe('isValidMarkerSubmitResponse', () => {
    it('should return true for response with error field', () => {
      expect(isValidMarkerSubmitResponse({ error: 'some error' })).toBe(true)
    })

    it('should return true for response with message field', () => {
      expect(isValidMarkerSubmitResponse({ message: 'some message' })).toBe(true)
    })

    it('should return true for response with request_id field', () => {
      expect(isValidMarkerSubmitResponse({ request_id: 'abc123' })).toBe(true)
    })

    it('should return true for response with request_check_url field', () => {
      expect(isValidMarkerSubmitResponse({ request_check_url: 'https://example.com' })).toBe(true)
    })

    it('should return true for response with multiple valid fields', () => {
      expect(isValidMarkerSubmitResponse({
        request_id: 'abc123',
        request_check_url: 'https://example.com',
        message: 'success'
      })).toBe(true)
    })

    it('should return false for null', () => {
      expect(isValidMarkerSubmitResponse(null)).toBe(false)
    })

    it('should return false for undefined', () => {
      expect(isValidMarkerSubmitResponse(undefined)).toBe(false)
    })

    it('should return false for non-object types', () => {
      expect(isValidMarkerSubmitResponse('string')).toBe(false)
      expect(isValidMarkerSubmitResponse(123)).toBe(false)
      expect(isValidMarkerSubmitResponse(true)).toBe(false)
    })

    it('should return false for empty object', () => {
      expect(isValidMarkerSubmitResponse({})).toBe(false)
    })

    it('should return false for object with wrong field types', () => {
      expect(isValidMarkerSubmitResponse({ error: 123 })).toBe(false)
      expect(isValidMarkerSubmitResponse({ message: null })).toBe(false)
      expect(isValidMarkerSubmitResponse({ request_id: {} })).toBe(false)
    })

    it('should return false for object with only unexpected fields', () => {
      expect(isValidMarkerSubmitResponse({ unexpected: 'field' })).toBe(false)
    })
  })

  describe('isValidMarkerPollResponse', () => {
    it('should return true for response with error field', () => {
      expect(isValidMarkerPollResponse({ error: 'some error' })).toBe(true)
    })

    it('should return true for response with status field', () => {
      expect(isValidMarkerPollResponse({ status: 'pending' })).toBe(true)
    })

    it('should return true for response with markdown field', () => {
      expect(isValidMarkerPollResponse({ markdown: '# Title' })).toBe(true)
    })

    it('should return true for response with progress field', () => {
      expect(isValidMarkerPollResponse({ progress: 50 })).toBe(true)
    })

    it('should return true for response with multiple valid fields', () => {
      expect(isValidMarkerPollResponse({
        status: 'complete',
        markdown: '# Content',
        progress: 100
      })).toBe(true)
    })

    it('should return false for null', () => {
      expect(isValidMarkerPollResponse(null)).toBe(false)
    })

    it('should return false for undefined', () => {
      expect(isValidMarkerPollResponse(undefined)).toBe(false)
    })

    it('should return false for non-object types', () => {
      expect(isValidMarkerPollResponse('string')).toBe(false)
      expect(isValidMarkerPollResponse(123)).toBe(false)
      expect(isValidMarkerPollResponse(true)).toBe(false)
    })

    it('should return false for empty object', () => {
      expect(isValidMarkerPollResponse({})).toBe(false)
    })

    it('should return false for object with wrong field types', () => {
      expect(isValidMarkerPollResponse({ error: 123 })).toBe(false)
      expect(isValidMarkerPollResponse({ status: null })).toBe(false)
      expect(isValidMarkerPollResponse({ markdown: {} })).toBe(false)
      expect(isValidMarkerPollResponse({ progress: 'string' })).toBe(false)
    })

    it('should return false for object with only unexpected fields', () => {
      expect(isValidMarkerPollResponse({ unexpected: 'field' })).toBe(false)
    })

    it('should accept progress as 0', () => {
      expect(isValidMarkerPollResponse({ progress: 0 })).toBe(true)
    })
  })

  describe('fetchWithTimeout', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.restoreAllMocks()
      vi.useRealTimers()
    })

    it('should successfully fetch when response is received before timeout', async () => {
      const mockResponse = new Response('{"data": "test"}', { status: 200 })
      global.fetch = vi.fn().mockResolvedValue(mockResponse)

      const promise = fetchWithTimeout('https://example.com', {}, 5000)

      // Let fetch resolve
      await vi.runAllTimersAsync()

      const response = await promise
      expect(response).toBe(mockResponse)
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    })

    it('should throw timeout error when request exceeds timeout', async () => {
      let abortController: AbortController | null = null

      global.fetch = vi.fn().mockImplementation((url, options: RequestInit) => {
        return new Promise((_, reject) => {
          // Capture the signal so we can listen for abort
          if (options.signal) {
            options.signal.addEventListener('abort', () => {
              const error = new Error('Aborted')
              error.name = 'AbortError'
              reject(error)
            })
          }
        })
      })

      const promise = fetchWithTimeout('https://example.com', {}, 1000)

      // Advance time past timeout to trigger abort
      await vi.advanceTimersByTimeAsync(1500)

      await expect(promise).rejects.toThrow('Request timed out after 1 seconds')
    }, 10000)

    it('should use default timeout of 30 seconds when not specified', async () => {
      const mockResponse = new Response('{"data": "test"}', { status: 200 })
      global.fetch = vi.fn().mockResolvedValue(mockResponse)

      const promise = fetchWithTimeout('https://example.com', {})

      await vi.runAllTimersAsync()
      await promise

      expect(global.fetch).toHaveBeenCalled()
    })

    it('should pass through fetch options', async () => {
      const mockResponse = new Response('{"data": "test"}', { status: 200 })
      global.fetch = vi.fn().mockResolvedValue(mockResponse)

      const options = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'data' })
      }

      const promise = fetchWithTimeout('https://example.com', options, 5000)

      await vi.runAllTimersAsync()
      await promise

      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ test: 'data' }),
          signal: expect.any(AbortSignal)
        })
      )
    })

    it('should combine external signal with timeout signal', async () => {
      const mockResponse = new Response('{"data": "test"}', { status: 200 })
      global.fetch = vi.fn().mockResolvedValue(mockResponse)

      const externalController = new AbortController()
      const options = { signal: externalController.signal }

      const promise = fetchWithTimeout('https://example.com', options, 5000)

      await vi.runAllTimersAsync()
      await promise

      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({
          signal: expect.any(AbortSignal)
        })
      )

      // Verify external signal has abort listener attached (Node 18 fallback)
      // In Node 20+, AbortSignal.any would be used instead
    })

    it('should allow external signal to abort request', async () => {
      const externalController = new AbortController()

      global.fetch = vi.fn().mockImplementation((url, options: RequestInit) => {
        return new Promise((_, reject) => {
          if (options.signal) {
            options.signal.addEventListener('abort', () => {
              const error = new Error('User cancelled')
              error.name = 'AbortError'
              reject(error)
            })
          }
        })
      })

      const promise = fetchWithTimeout('https://example.com', { signal: externalController.signal }, 5000)

      // Abort externally before timeout
      setTimeout(() => externalController.abort(), 100)
      await vi.advanceTimersByTimeAsync(200)

      await expect(promise).rejects.toThrow('Request timed out after 5 seconds')
    })

    it('should propagate non-abort errors', async () => {
      const networkError = new Error('Network failure')
      global.fetch = vi.fn().mockRejectedValue(networkError)

      await expect(async () => {
        const promise = fetchWithTimeout('https://example.com', {}, 5000)
        await vi.runAllTimersAsync()
        await promise
      }).rejects.toThrow('Network failure')
    })

    it('should clear timeout after successful response', async () => {
      const mockResponse = new Response('{"data": "test"}', { status: 200 })
      global.fetch = vi.fn().mockResolvedValue(mockResponse)

      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')

      const promise = fetchWithTimeout('https://example.com', {}, 5000)

      await vi.runAllTimersAsync()
      await promise

      expect(clearTimeoutSpy).toHaveBeenCalled()
    })

    it('should clear timeout after error', async () => {
      const networkError = new Error('Network failure')
      global.fetch = vi.fn().mockRejectedValue(networkError)

      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')

      await expect(async () => {
        const promise = fetchWithTimeout('https://example.com', {}, 5000)
        await vi.runAllTimersAsync()
        await promise
      }).rejects.toThrow('Network failure')

      expect(clearTimeoutSpy).toHaveBeenCalled()
    })
  })
})
