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
      expect(mockStrategy.submitConversion).toHaveBeenCalledWith(mockFile, mockOptions, undefined)
      expect(mockStrategy.pollStatus).toHaveBeenCalledWith(checkUrl, undefined)
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

    it('should report a blank PDF (empty markdown) clearly', async () => {
      mockStrategy.submitConversion.mockResolvedValue({
        success: true,
        request_check_url: 'https://test.com/check/123'
      } as MarkerSubmitResponse)
      mockStrategy.pollStatus.mockResolvedValue({
        success: true,
        status: 'complete',
        markdown: ''
      } as MarkerPollResponse)

      const promise = convertWithStrategy(mockFile, mockStrategy, mockOptions)
      await vi.runAllTimersAsync()
      const result = await promise

      expect(result).toEqual({
        success: false,
        error: 'No text was found in this PDF. It may be blank.'
      })
    })

    it('should report cancellation when a request is aborted mid-flight', async () => {
      const controller = new AbortController()
      mockStrategy.submitConversion.mockImplementation(async () => {
        controller.abort()
        throw new DOMException('The operation was aborted.', 'AbortError')
      })

      const promise = convertWithStrategy(mockFile, mockStrategy, mockOptions, undefined, controller.signal)
      await vi.runAllTimersAsync()
      const result = await promise

      expect(result).toEqual({ success: false, error: 'Conversion cancelled' })
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
    it('should time out after the polling time limit', async () => {
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

      // Polls every 2s for the first minute, then every 5s, until the 2-hour limit
      const calls = mockStrategy.pollStatus.mock.calls.length
      const fastPolls = MARKER_CONFIG.POLLING.FAST_PHASE_MS / MARKER_CONFIG.POLLING.INTERVAL_MS
      const slowPolls = (MARKER_CONFIG.POLLING.TIMEOUT_DURATION_MS - MARKER_CONFIG.POLLING.FAST_PHASE_MS) / MARKER_CONFIG.POLLING.SLOW_INTERVAL_MS
      expect(calls).toBeGreaterThan(fastPolls + slowPolls - 5)
      expect(calls).toBeLessThan(fastPolls + slowPolls + 5)
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

describe('convertWithStrategy rate limits and cancel', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  const makeStrategy = () => ({
    submitConversion: vi.fn().mockResolvedValue({ success: true, request_check_url: 'https://x.test/status/1' }),
    pollStatus: vi.fn(),
    getErrorPrefix: vi.fn().mockReturnValue('Test'),
    needsInitialDelay: vi.fn().mockReturnValue(false),
    cancelConversion: vi.fn().mockResolvedValue(undefined)
  })
  const file = new File(['%PDF-'], 'a.pdf', { type: 'application/pdf' })

  it('does not count 429 poll failures as failures', async () => {
    const strategy = makeStrategy()
    for (let i = 0; i < 6; i++) {
      strategy.pollStatus.mockRejectedValueOnce(new Error('Polling failed: 429 - Too many requests'))
    }
    strategy.pollStatus.mockResolvedValueOnce({ success: true, status: 'complete', markdown: '# ok' })

    const promise = convertWithStrategy(file, strategy, {})
    await vi.runAllTimersAsync()
    expect(await promise).toEqual({ success: true, markdown: '# ok' })
  })

  it('returns images with the markdown', async () => {
    const strategy = makeStrategy()
    strategy.pollStatus.mockResolvedValueOnce({ success: true, status: 'complete', markdown: '![](a.png)', images: { 'a.png': 'AAAA' } })

    const promise = convertWithStrategy(file, strategy, {})
    await vi.runAllTimersAsync()
    expect(await promise).toEqual({ success: true, markdown: '![](a.png)', images: { 'a.png': 'AAAA' } })
  })

  it('asks the service to stop the job when cancelled', async () => {
    const strategy = makeStrategy()
    const controller = new AbortController()
    strategy.pollStatus.mockImplementation(async () => {
      controller.abort()
      return { success: true, status: 'processing' }
    })

    const promise = convertWithStrategy(file, strategy, {}, undefined, controller.signal)
    await vi.runAllTimersAsync()
    expect(await promise).toEqual({ success: false, error: 'Conversion cancelled' })
    expect(strategy.cancelConversion).toHaveBeenCalledWith('https://x.test/status/1')
  })
})

describe('describeJobError', () => {
  it.each([
    ['Unexpected error: Failed to load document (PDFium: Incorrect password error).', 'This PDF is password-protected. Remove the password and try again.'],
    ['Unexpected error: Failed to load document (PDFium: Data format error).', 'This PDF is damaged or is not a valid PDF file.'],
    ['Unexpected error: CUDA out of memory', 'CUDA out of memory'],
    ['Rate limited', 'Rate limited'],
  ])('%s', async (raw, expected) => {
    const { describeJobError } = await import('./conversionStrategy')
    expect(describeJobError(raw)).toBe(expected)
  })
})
