/**
 * Tests for conversionStrategy (convertWithStrategy function)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { convertWithStrategy, type IConversionStrategy, type ProgressCallback } from './conversionStrategy'
import type { MarkerOptions, MarkerSubmitResponse, MarkerPollResponse } from '@/types'
import { MARKER_CONFIG } from '@/lib/constants'

describe('convertWithStrategy', () => {
  const mockFile = new File(['test'], 'test.pdf', { type: 'application/pdf' })
  const mockOptions: MarkerOptions = { use_llm: true }

  // Mock strategy implementation
  class MockStrategy implements IConversionStrategy {
    submitConversion = vi.fn()
    pollStatus = vi.fn()
    getErrorPrefix = vi.fn().mockReturnValue('Test')
    needsInitialDelay = vi.fn().mockReturnValue(false)
  }

  let mockStrategy: MockStrategy

  beforeEach(() => {
    mockStrategy = new MockStrategy()
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('successful conversion', () => {
    it('should complete conversion successfully', async () => {
      const checkUrl = 'https://test.com/check/123'
      const markdown = '# Test Markdown'

      mockStrategy.submitConversion.mockResolvedValue({
        success: true,
        request_check_url: checkUrl
      } as MarkerSubmitResponse)

      mockStrategy.pollStatus.mockResolvedValue({
        success: true,
        status: 'complete',
        markdown
      } as MarkerPollResponse)

      const promise = convertWithStrategy(mockFile, mockStrategy, mockOptions)
      await vi.runAllTimersAsync()
      const result = await promise

      expect(result).toEqual({
        success: true,
        markdown
      })
      expect(mockStrategy.submitConversion).toHaveBeenCalledWith(mockFile, mockOptions)
      expect(mockStrategy.pollStatus).toHaveBeenCalledWith(checkUrl)
    })

    it('should invoke progress callback', async () => {
      const checkUrl = 'https://test.com/check/123'
      const onProgress = vi.fn()

      mockStrategy.submitConversion.mockResolvedValue({
        success: true,
        request_check_url: checkUrl
      } as MarkerSubmitResponse)

      mockStrategy.pollStatus
        .mockResolvedValueOnce({
          success: true,
          status: 'processing'
        } as MarkerPollResponse)
        .mockResolvedValueOnce({
          success: true,
          status: 'complete',
          markdown: '# Test'
        } as MarkerPollResponse)

      const promise = convertWithStrategy(mockFile, mockStrategy, mockOptions, onProgress)
      await vi.runAllTimersAsync()
      await promise

      expect(onProgress).toHaveBeenCalledWith('processing', 1, expect.any(Number))
      expect(onProgress).toHaveBeenCalledWith('complete', 2, expect.any(Number))
    })

    it('should add initial delay if strategy needs it', async () => {
      mockStrategy.needsInitialDelay.mockReturnValue(true)

      const checkUrl = 'https://test.com/check/123'
      mockStrategy.submitConversion.mockResolvedValue({
        success: true,
        request_check_url: checkUrl
      } as MarkerSubmitResponse)

      mockStrategy.pollStatus.mockResolvedValue({
        success: true,
        status: 'complete',
        markdown: '# Test'
      } as MarkerPollResponse)

      const promise = convertWithStrategy(mockFile, mockStrategy, mockOptions)

      // Initial delay should happen
      await vi.advanceTimersByTimeAsync(MARKER_CONFIG.POLLING.INITIAL_DELAY_MS)
      await vi.runAllTimersAsync()
      await promise

      expect(mockStrategy.needsInitialDelay).toHaveBeenCalled()
      expect(mockStrategy.pollStatus).toHaveBeenCalled()
    })

    it('should not add initial delay if strategy does not need it', async () => {
      mockStrategy.needsInitialDelay.mockReturnValue(false)

      const checkUrl = 'https://test.com/check/123'
      mockStrategy.submitConversion.mockResolvedValue({
        success: true,
        request_check_url: checkUrl
      } as MarkerSubmitResponse)

      mockStrategy.pollStatus.mockResolvedValue({
        success: true,
        status: 'complete',
        markdown: '# Test'
      } as MarkerPollResponse)

      const promise = convertWithStrategy(mockFile, mockStrategy, mockOptions)
      await vi.runAllTimersAsync()
      await promise

      expect(mockStrategy.needsInitialDelay).toHaveBeenCalled()
      expect(mockStrategy.pollStatus).toHaveBeenCalled()
    })
  })

  describe('cancellation handling', () => {
    it('should return error if already cancelled before start', async () => {
      const controller = new AbortController()
      controller.abort()

      const result = await convertWithStrategy(
        mockFile,
        mockStrategy,
        mockOptions,
        undefined,
        controller.signal
      )

      expect(result).toEqual({
        success: false,
        error: 'Conversion cancelled'
      })
      expect(mockStrategy.submitConversion).not.toHaveBeenCalled()
    })

    it('should cancel during polling', async () => {
      const controller = new AbortController()
      const checkUrl = 'https://test.com/check/123'

      mockStrategy.submitConversion.mockResolvedValue({
        success: true,
        request_check_url: checkUrl
      } as MarkerSubmitResponse)

      mockStrategy.pollStatus.mockImplementation(async () => {
        controller.abort()
        return {
          success: true,
          status: 'processing'
        } as MarkerPollResponse
      })

      const promise = convertWithStrategy(
        mockFile,
        mockStrategy,
        mockOptions,
        undefined,
        controller.signal
      )
      await vi.runAllTimersAsync()
      const result = await promise

      expect(result).toEqual({
        success: false,
        error: 'Conversion cancelled'
      })
    })

    it('should cancel during wait between polls', async () => {
      const controller = new AbortController()
      const checkUrl = 'https://test.com/check/123'

      mockStrategy.submitConversion.mockResolvedValue({
        success: true,
        request_check_url: checkUrl
      } as MarkerSubmitResponse)

      mockStrategy.pollStatus.mockResolvedValue({
        success: true,
        status: 'processing'
      } as MarkerPollResponse)

      const promise = convertWithStrategy(
        mockFile,
        mockStrategy,
        mockOptions,
        undefined,
        controller.signal
      )

      // Let first poll happen
      await vi.advanceTimersByTimeAsync(100)

      // Cancel during wait
      controller.abort()
      await vi.runAllTimersAsync()
      const result = await promise

      expect(result).toEqual({
        success: false,
        error: 'Conversion cancelled'
      })
    })
  })

  describe('error handling', () => {
    it('should handle submit error', async () => {
      mockStrategy.submitConversion.mockRejectedValue(new Error('Submit failed'))

      const promise = convertWithStrategy(mockFile, mockStrategy, mockOptions)
      await vi.runAllTimersAsync()
      const result = await promise

      expect(result).toEqual({
        success: false,
        error: 'Submit failed'
      })
    })

    it('should handle missing check URL', async () => {
      mockStrategy.submitConversion.mockResolvedValue({
        success: true
        // Missing request_check_url
      } as MarkerSubmitResponse)

      const promise = convertWithStrategy(mockFile, mockStrategy, mockOptions)
      await vi.runAllTimersAsync()
      const result = await promise

      expect(result).toEqual({
        success: false,
        error: 'No status check URL returned from Test'
      })
      expect(mockStrategy.getErrorPrefix).toHaveBeenCalled()
    })

    it('should handle poll error', async () => {
      const checkUrl = 'https://test.com/check/123'

      mockStrategy.submitConversion.mockResolvedValue({
        success: true,
        request_check_url: checkUrl
      } as MarkerSubmitResponse)

      mockStrategy.pollStatus.mockRejectedValue(new Error('Poll failed'))

      const promise = convertWithStrategy(mockFile, mockStrategy, mockOptions)
      await vi.runAllTimersAsync()
      const result = await promise

      expect(result).toEqual({
        success: false,
        error: 'Poll failed'
      })
    })

    it('should handle error status from server', async () => {
      const checkUrl = 'https://test.com/check/123'

      mockStrategy.submitConversion.mockResolvedValue({
        success: true,
        request_check_url: checkUrl
      } as MarkerSubmitResponse)

      mockStrategy.pollStatus.mockResolvedValue({
        success: true,
        status: 'error'
      } as MarkerPollResponse)

      const promise = convertWithStrategy(mockFile, mockStrategy, mockOptions)
      await vi.runAllTimersAsync()
      const result = await promise

      expect(result).toEqual({
        success: false,
        error: 'Conversion failed on Test'
      })
      expect(mockStrategy.getErrorPrefix).toHaveBeenCalled()
    })

    it('should handle missing markdown content', async () => {
      const checkUrl = 'https://test.com/check/123'

      mockStrategy.submitConversion.mockResolvedValue({
        success: true,
        request_check_url: checkUrl
      } as MarkerSubmitResponse)

      mockStrategy.pollStatus.mockResolvedValue({
        success: true,
        status: 'complete'
        // Missing markdown
      } as MarkerPollResponse)

      const promise = convertWithStrategy(mockFile, mockStrategy, mockOptions)
      await vi.runAllTimersAsync()
      const result = await promise

      expect(result).toEqual({
        success: false,
        error: 'No content received from Test'
      })
      expect(mockStrategy.getErrorPrefix).toHaveBeenCalled()
    })

    it('should use error prefix in generic error message', async () => {
      mockStrategy.getErrorPrefix.mockReturnValue('CustomService')
      mockStrategy.submitConversion.mockRejectedValue(new Error())

      const promise = convertWithStrategy(mockFile, mockStrategy, mockOptions)
      await vi.runAllTimersAsync()
      const result = await promise

      expect(result.error).toContain('customservice')
    })
  })

  describe('timeout handling', () => {
    it('should timeout after max attempts', async () => {
      const checkUrl = 'https://test.com/check/123'

      mockStrategy.submitConversion.mockResolvedValue({
        success: true,
        request_check_url: checkUrl
      } as MarkerSubmitResponse)

      // Always return processing
      mockStrategy.pollStatus.mockResolvedValue({
        success: true,
        status: 'processing'
      } as MarkerPollResponse)

      const promise = convertWithStrategy(mockFile, mockStrategy, mockOptions)
      await vi.runAllTimersAsync()
      const result = await promise

      expect(result).toEqual({
        success: false,
        error: 'Conversion timeout. Please try again.'
      })

      // Should poll MAX_ATTEMPTS times
      expect(mockStrategy.pollStatus).toHaveBeenCalledTimes(MARKER_CONFIG.POLLING.MAX_ATTEMPTS)
    })

    it('should wait between poll attempts', async () => {
      const checkUrl = 'https://test.com/check/123'

      mockStrategy.submitConversion.mockResolvedValue({
        success: true,
        request_check_url: checkUrl
      } as MarkerSubmitResponse)

      let pollCount = 0
      mockStrategy.pollStatus.mockImplementation(async () => {
        pollCount++
        if (pollCount === 2) {
          return {
            success: true,
            status: 'complete',
            markdown: '# Test'
          } as MarkerPollResponse
        }
        return {
          success: true,
          status: 'processing'
        } as MarkerPollResponse
      })

      const promise = convertWithStrategy(mockFile, mockStrategy, mockOptions)

      // First poll should happen immediately
      await vi.advanceTimersByTimeAsync(0)
      expect(pollCount).toBe(1)

      // Second poll after interval
      await vi.advanceTimersByTimeAsync(MARKER_CONFIG.POLLING.INTERVAL_MS)
      expect(pollCount).toBe(2)

      await vi.runAllTimersAsync()
      await promise
    })
  })
})
