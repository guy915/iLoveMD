/**
 * Tests for markerApiService - PDF to Markdown conversion service
 *
 * Tests cover:
 * - Cloud API submission: submitPdfConversion with mocked fetch
 * - Cloud status polling: pollConversionStatus with various statuses
 * - Cloud conversion flow: convertPdfToMarkdown with polling simulation
 * - Local API submission: submitPdfConversionLocal with Gemini key support
 * - Local status polling: pollConversionStatusLocal without API key requirement
 * - Local conversion flow: convertPdfToMarkdownLocal with redo_inline_math option
 * - Error handling: network errors, API errors, timeouts
 * - Cancellation: AbortSignal support
 * - Progress callbacks: onProgress updates
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  submitPdfConversion,
  pollConversionStatus,
  convertPdfToMarkdown,
  submitPdfConversionLocal,
  pollConversionStatusLocal,
  convertPdfToMarkdownLocal,
} from './markerApiService'
import { MARKER_CONFIG, FILE_SIZE } from '@/lib/constants'
import type { MarkerOptions } from '@/types'

// Helper to create mock File objects
function createMockFile(name: string, size: number, type: string = 'application/pdf'): File {
  // Create a minimal blob and override the size property
  const blob = new Blob(['test content'], { type })
  const file = new File([blob], name, { type })

  // Override size property for testing
  Object.defineProperty(file, 'size', {
    value: size,
    writable: false,
  })

  return file
}

// Default marker options for testing
const defaultOptions: MarkerOptions = {
  output_format: 'markdown',
  langs: 'English',
  paginate: false,
  format_lines: false,
  use_llm: false,
  disable_image_extraction: false,
  redo_inline_math: false,
}

describe('markerApiService', () => {
  describe('submitPdfConversion', () => {
    let fetchMock: ReturnType<typeof vi.fn>

    beforeEach(() => {
      fetchMock = vi.fn()
      global.fetch = fetchMock
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('should submit file successfully', async () => {
      const file = createMockFile('test.pdf', 1024)
      const apiKey = 'test-api-key'

      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          request_id: 'req-123',
          request_check_url: 'https://api.example.com/check/123',
        }),
      })

      const result = await submitPdfConversion(file, apiKey, defaultOptions)

      expect(result.success).toBe(true)
      expect(result.request_id).toBe('req-123')
      expect(result.request_check_url).toBe('https://api.example.com/check/123')
      expect(fetchMock).toHaveBeenCalledWith('/api/marker', {
        method: 'POST',
        body: expect.any(FormData),
      })
    })

    it('should include file, apiKey, and options in FormData', async () => {
      const file = createMockFile('test.pdf', 1024)
      const apiKey = 'my-key'
      const options: MarkerOptions = {
        ...defaultOptions,
        paginate: true,
        use_llm: true,
      }

      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, request_check_url: 'url' }),
      })

      await submitPdfConversion(file, apiKey, options)

      const call = fetchMock.mock.calls[0]
      const formData = call[1].body as FormData

      expect(formData.get('file')).toBe(file)
      expect(formData.get('apiKey')).toBe(apiKey)
      expect(formData.get('options')).toBe(JSON.stringify(options))
    })

    it('should throw error if response is not ok', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        json: async () => ({ success: false, error: 'Invalid API key' }),
      })

      const file = createMockFile('test.pdf', 1024)

      await expect(submitPdfConversion(file, 'bad-key', defaultOptions))
        .rejects.toThrow('Invalid API key')
    })

    it('should throw error if success is false', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ success: false, error: 'File too large' }),
      })

      const file = createMockFile('test.pdf', 1024)

      await expect(submitPdfConversion(file, 'key', defaultOptions))
        .rejects.toThrow('File too large')
    })

    it('should throw generic error if no error message provided', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        json: async () => ({ success: false }),
      })

      const file = createMockFile('test.pdf', 1024)

      await expect(submitPdfConversion(file, 'key', defaultOptions))
        .rejects.toThrow('Failed to submit file for conversion')
    })

    it('should handle network errors', async () => {
      fetchMock.mockRejectedValue(new Error('Network error'))

      const file = createMockFile('test.pdf', 1024)

      await expect(submitPdfConversion(file, 'key', defaultOptions))
        .rejects.toThrow('Network error')
    })
  })

  describe('pollConversionStatus', () => {
    let fetchMock: ReturnType<typeof vi.fn>

    beforeEach(() => {
      fetchMock = vi.fn()
      global.fetch = fetchMock
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('should poll status successfully', async () => {
      const checkUrl = 'https://api.example.com/check/123'
      const apiKey = 'test-key'

      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          status: 'processing',
          progress: 50,
        }),
      })

      const result = await pollConversionStatus(checkUrl, apiKey)

      expect(result.success).toBe(true)
      expect(result.status).toBe('processing')
      expect(result.progress).toBe(50)
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(encodeURIComponent(checkUrl)),
        expect.objectContaining({
          headers: { 'x-api-key': apiKey },
        })
      )
    })

    it('should return complete status with markdown', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          status: 'complete',
          markdown: '# Converted Content',
        }),
      })

      const result = await pollConversionStatus('url', 'key')

      expect(result.status).toBe('complete')
      expect(result.markdown).toBe('# Converted Content')
    })

    it('should handle error status from API', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        json: async () => ({
          success: false,
          error: 'Conversion failed',
        }),
      })

      await expect(pollConversionStatus('url', 'key'))
        .rejects.toThrow('Conversion failed')
    })

    it('should encode checkUrl in query parameter', async () => {
      const checkUrl = 'https://api.com/check?id=123&token=abc'

      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, status: 'pending' }),
      })

      await pollConversionStatus(checkUrl, 'key')

      const call = fetchMock.mock.calls[0][0] as string
      expect(call).toContain(encodeURIComponent(checkUrl))
    })
  })

  describe('convertPdfToMarkdown', () => {
    let fetchMock: ReturnType<typeof vi.fn>

    beforeEach(() => {
      fetchMock = vi.fn()
      global.fetch = fetchMock
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.restoreAllMocks()
      vi.useRealTimers()
    })

    it('should complete full conversion workflow', async () => {
      const file = createMockFile('test.pdf', 1024)
      const apiKey = 'key'

      // Mock submit response
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          request_check_url: 'check-url',
        }),
      })

      // Mock poll response (complete)
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          status: 'complete',
          markdown: '# Result',
        }),
      })

      const promise = convertPdfToMarkdown(file, apiKey, defaultOptions)
      await vi.runAllTimersAsync()
      const result = await promise

      expect(result.success).toBe(true)
      expect(result.markdown).toBe('# Result')
    })

    it('should poll multiple times until complete', async () => {
      const file = createMockFile('test.pdf', 1024)

      // Submit response
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          request_check_url: 'check-url',
        }),
      })

      // First poll: pending
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          status: 'pending',
        }),
      })

      // Second poll: processing
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          status: 'processing',
        }),
      })

      // Third poll: complete
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          status: 'complete',
          markdown: '# Done',
        }),
      })

      const promise = convertPdfToMarkdown(file, 'key', defaultOptions)
      await vi.runAllTimersAsync()
      const result = await promise

      expect(result.success).toBe(true)
      expect(result.markdown).toBe('# Done')
      expect(fetchMock).toHaveBeenCalledTimes(4) // 1 submit + 3 polls
    })

    it('should call onProgress callback', async () => {
      const file = createMockFile('test.pdf', 1024)
      const onProgress = vi.fn()

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, request_check_url: 'url' }),
      })

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, status: 'processing' }),
      })

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, status: 'complete', markdown: '# Done' }),
      })

      const promise = convertPdfToMarkdown(file, 'key', defaultOptions, onProgress)
      await vi.runAllTimersAsync()
      await promise

      expect(onProgress).toHaveBeenCalledWith('processing', 1, expect.any(Number))
      expect(onProgress).toHaveBeenCalledWith('complete', 2, expect.any(Number))
    })

    it('should handle cancellation via AbortSignal', async () => {
      const file = createMockFile('test.pdf', 1024)
      const controller = new AbortController()

      // Cancel immediately
      controller.abort()

      const result = await convertPdfToMarkdown(file, 'key', defaultOptions, undefined, controller.signal)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Conversion cancelled')
    })

    it('should handle cancellation during polling', async () => {
      const file = createMockFile('test.pdf', 1024)
      const controller = new AbortController()

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, request_check_url: 'url' }),
      })

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, status: 'processing' }),
      })

      const promise = convertPdfToMarkdown(file, 'key', defaultOptions, undefined, controller.signal)

      // Cancel after first poll
      await vi.advanceTimersByTimeAsync(100)
      controller.abort()
      await vi.runAllTimersAsync()

      const result = await promise

      expect(result.success).toBe(false)
      expect(result.error).toBe('Conversion cancelled')
    })

    it('should timeout after max attempts', async () => {
      const file = createMockFile('test.pdf', 1024)

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, request_check_url: 'url' }),
      })

      // Always return processing status
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, status: 'processing' }),
      })

      const promise = convertPdfToMarkdown(file, 'key', defaultOptions)
      await vi.runAllTimersAsync()
      const result = await promise

      expect(result.success).toBe(false)
      expect(result.error).toBe('Conversion timeout. Please try again.')
    })

    it('should handle error status from server', async () => {
      const file = createMockFile('test.pdf', 1024)

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, request_check_url: 'url' }),
      })

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, status: 'error' }),
      })

      const promise = convertPdfToMarkdown(file, 'key', defaultOptions)
      await vi.runAllTimersAsync()
      const result = await promise

      expect(result.success).toBe(false)
      expect(result.error).toBe('Conversion failed on server')
    })

    it('should handle missing check URL from submit', async () => {
      const file = createMockFile('test.pdf', 1024)

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }), // No request_check_url
      })

      const result = await convertPdfToMarkdown(file, 'key', defaultOptions)

      expect(result.success).toBe(false)
      expect(result.error).toBe('No status check URL returned from API')
    })

    it('should handle missing markdown in complete response', async () => {
      const file = createMockFile('test.pdf', 1024)

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, request_check_url: 'url' }),
      })

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, status: 'complete' }), // No markdown
      })

      const promise = convertPdfToMarkdown(file, 'key', defaultOptions)
      await vi.runAllTimersAsync()
      const result = await promise

      expect(result.success).toBe(false)
      expect(result.error).toBe('No content received from API')
    })

    it('should catch and return errors from submit', async () => {
      const file = createMockFile('test.pdf', 1024)

      fetchMock.mockRejectedValueOnce(new Error('Network error'))

      const result = await convertPdfToMarkdown(file, 'key', defaultOptions)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Network error')
    })

    it('should catch and return errors from polling', async () => {
      const file = createMockFile('test.pdf', 1024)

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, request_check_url: 'url' }),
      })

      fetchMock.mockRejectedValueOnce(new Error('Poll error'))

      const promise = convertPdfToMarkdown(file, 'key', defaultOptions)
      await vi.runAllTimersAsync()
      const result = await promise

      expect(result.success).toBe(false)
      expect(result.error).toBe('Poll error')
    })
  })

  describe('submitPdfConversionLocal', () => {
    let fetchMock: ReturnType<typeof vi.fn>

    beforeEach(() => {
      fetchMock = vi.fn()
      global.fetch = fetchMock
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('should submit file successfully without Gemini API key', async () => {
      const file = createMockFile('test.pdf', 1024)

      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          request_id: 'local-req-123',
          request_check_url: 'http://localhost:8000/check/123',
        }),
      })

      const result = await submitPdfConversionLocal(file, null, defaultOptions)

      expect(result.success).toBe(true)
      expect(result.request_id).toBe('local-req-123')
      expect(result.request_check_url).toBe('http://localhost:8000/check/123')
      expect(fetchMock).toHaveBeenCalledWith('/api/marker/local', {
        method: 'POST',
        body: expect.any(FormData),
      })
    })

    it('should submit file with Gemini API key when use_llm is enabled', async () => {
      const file = createMockFile('test.pdf', 1024)
      const geminiApiKey = 'gemini-test-key'
      const options: MarkerOptions = {
        ...defaultOptions,
        use_llm: true,
      }

      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, request_check_url: 'url' }),
      })

      await submitPdfConversionLocal(file, geminiApiKey, options)

      const call = fetchMock.mock.calls[0]
      const formData = call[1].body as FormData

      expect(formData.get('file')).toBe(file)
      expect(formData.get('geminiApiKey')).toBe(geminiApiKey)
      expect(formData.get('options')).toBe(JSON.stringify(options))
    })

    it('should include redo_inline_math option', async () => {
      const file = createMockFile('test.pdf', 1024)
      const options: MarkerOptions = {
        ...defaultOptions,
        redo_inline_math: true,
      }

      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, request_check_url: 'url' }),
      })

      await submitPdfConversionLocal(file, null, options)

      const call = fetchMock.mock.calls[0]
      const formData = call[1].body as FormData

      expect(formData.get('options')).toBe(JSON.stringify(options))
    })

    it('should throw error if response is not ok', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        json: async () => ({ success: false, error: 'Modal instance not running' }),
      })

      const file = createMockFile('test.pdf', 1024)

      await expect(submitPdfConversionLocal(file, null, defaultOptions))
        .rejects.toThrow('Modal instance not running')
    })

    it('should throw generic error if no error message provided', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        json: async () => ({ success: false }),
      })

      const file = createMockFile('test.pdf', 1024)

      await expect(submitPdfConversionLocal(file, null, defaultOptions))
        .rejects.toThrow('Failed to submit file for local conversion')
    })

    it('should handle network errors', async () => {
      fetchMock.mockRejectedValue(new Error('Connection refused'))

      const file = createMockFile('test.pdf', 1024)

      await expect(submitPdfConversionLocal(file, null, defaultOptions))
        .rejects.toThrow('Connection refused')
    })
  })

  describe('pollConversionStatusLocal', () => {
    let fetchMock: ReturnType<typeof vi.fn>

    beforeEach(() => {
      fetchMock = vi.fn()
      global.fetch = fetchMock
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('should poll status successfully without API key', async () => {
      const checkUrl = 'http://localhost:8000/check/123'

      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          status: 'processing',
          progress: 50,
        }),
      })

      const result = await pollConversionStatusLocal(checkUrl)

      expect(result.success).toBe(true)
      expect(result.status).toBe('processing')
      expect(result.progress).toBe(50)
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(encodeURIComponent(checkUrl))
      )
    })

    it('should return complete status with markdown', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          status: 'complete',
          markdown: '# Local Converted Content',
        }),
      })

      const result = await pollConversionStatusLocal('url')

      expect(result.status).toBe('complete')
      expect(result.markdown).toBe('# Local Converted Content')
    })

    it('should handle error status from Modal', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        json: async () => ({
          success: false,
          error: 'Local conversion failed',
        }),
      })

      await expect(pollConversionStatusLocal('url'))
        .rejects.toThrow('Local conversion failed')
    })

    it('should encode checkUrl in query parameter', async () => {
      const checkUrl = 'http://localhost:8000/check?id=123&token=abc'

      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, status: 'pending' }),
      })

      await pollConversionStatusLocal(checkUrl)

      const call = fetchMock.mock.calls[0][0] as string
      expect(call).toContain(encodeURIComponent(checkUrl))
    })

    it('should throw generic error if no error message provided', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        json: async () => ({ success: false }),
      })

      await expect(pollConversionStatusLocal('url'))
        .rejects.toThrow('Failed to check local conversion status')
    })
  })

  describe('convertPdfToMarkdownLocal', () => {
    let fetchMock: ReturnType<typeof vi.fn>

    beforeEach(() => {
      fetchMock = vi.fn()
      global.fetch = fetchMock
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.restoreAllMocks()
      vi.useRealTimers()
    })

    it('should complete full local conversion workflow', async () => {
      const file = createMockFile('test.pdf', 1024)

      // Mock submit response
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          request_check_url: 'local-check-url',
        }),
      })

      // Mock poll response (complete)
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          status: 'complete',
          markdown: '# Local Result',
        }),
      })

      const promise = convertPdfToMarkdownLocal(file, null, defaultOptions)
      await vi.runAllTimersAsync()
      const result = await promise

      expect(result.success).toBe(true)
      expect(result.markdown).toBe('# Local Result')
    })

    it('should poll multiple times until complete', async () => {
      const file = createMockFile('test.pdf', 1024)

      // Submit response
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          request_check_url: 'check-url',
        }),
      })

      // First poll: pending
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          status: 'pending',
        }),
      })

      // Second poll: processing
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          status: 'processing',
        }),
      })

      // Third poll: complete
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          status: 'complete',
          markdown: '# Done Locally',
        }),
      })

      const promise = convertPdfToMarkdownLocal(file, null, defaultOptions)
      await vi.runAllTimersAsync()
      const result = await promise

      expect(result.success).toBe(true)
      expect(result.markdown).toBe('# Done Locally')
      expect(fetchMock).toHaveBeenCalledTimes(4) // 1 submit + 3 polls
    })

    it('should call onProgress callback', async () => {
      const file = createMockFile('test.pdf', 1024)
      const onProgress = vi.fn()

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, request_check_url: 'url' }),
      })

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, status: 'processing' }),
      })

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, status: 'complete', markdown: '# Done' }),
      })

      const promise = convertPdfToMarkdownLocal(file, null, defaultOptions, onProgress)
      await vi.runAllTimersAsync()
      await promise

      expect(onProgress).toHaveBeenCalledWith('processing', 1, expect.any(Number))
      expect(onProgress).toHaveBeenCalledWith('complete', 2, expect.any(Number))
    })

    it('should handle cancellation via AbortSignal', async () => {
      const file = createMockFile('test.pdf', 1024)
      const controller = new AbortController()

      // Cancel immediately
      controller.abort()

      const result = await convertPdfToMarkdownLocal(file, null, defaultOptions, undefined, controller.signal)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Conversion cancelled')
    })

    it('should handle cancellation during polling', async () => {
      const file = createMockFile('test.pdf', 1024)
      const controller = new AbortController()

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, request_check_url: 'url' }),
      })

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, status: 'processing' }),
      })

      const promise = convertPdfToMarkdownLocal(file, null, defaultOptions, undefined, controller.signal)

      // Cancel after first poll
      await vi.advanceTimersByTimeAsync(100)
      controller.abort()
      await vi.runAllTimersAsync()

      const result = await promise

      expect(result.success).toBe(false)
      expect(result.error).toBe('Conversion cancelled')
    })

    it('should timeout after max attempts', async () => {
      const file = createMockFile('test.pdf', 1024)

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, request_check_url: 'url' }),
      })

      // Always return processing status
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, status: 'processing' }),
      })

      const promise = convertPdfToMarkdownLocal(file, null, defaultOptions)
      await vi.runAllTimersAsync()
      const result = await promise

      expect(result.success).toBe(false)
      expect(result.error).toBe('Conversion timeout. Please try again.')
    })

    it('should handle error status from Modal', async () => {
      const file = createMockFile('test.pdf', 1024)

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, request_check_url: 'url' }),
      })

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, status: 'error' }),
      })

      const promise = convertPdfToMarkdownLocal(file, null, defaultOptions)
      await vi.runAllTimersAsync()
      const result = await promise

      expect(result.success).toBe(false)
      expect(result.error).toBe('Conversion failed on Modal')
    })

    it('should handle missing check URL from submit', async () => {
      const file = createMockFile('test.pdf', 1024)

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }), // No request_check_url
      })

      const result = await convertPdfToMarkdownLocal(file, null, defaultOptions)

      expect(result.success).toBe(false)
      expect(result.error).toBe('No status check URL returned from Modal')
    })

    it('should handle missing markdown in complete response', async () => {
      const file = createMockFile('test.pdf', 1024)

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, request_check_url: 'url' }),
      })

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, status: 'complete' }), // No markdown
      })

      const promise = convertPdfToMarkdownLocal(file, null, defaultOptions)
      await vi.runAllTimersAsync()
      const result = await promise

      expect(result.success).toBe(false)
      expect(result.error).toBe('No content received from Modal')
    })

    it('should catch and return errors from submit', async () => {
      const file = createMockFile('test.pdf', 1024)

      fetchMock.mockRejectedValueOnce(new Error('Connection refused'))

      const result = await convertPdfToMarkdownLocal(file, null, defaultOptions)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Connection refused')
    })

    it('should catch and return errors from polling', async () => {
      const file = createMockFile('test.pdf', 1024)

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, request_check_url: 'url' }),
      })

      fetchMock.mockRejectedValueOnce(new Error('Poll error'))

      const promise = convertPdfToMarkdownLocal(file, null, defaultOptions)
      await vi.runAllTimersAsync()
      const result = await promise

      expect(result.success).toBe(false)
      expect(result.error).toBe('Poll error')
    })

    it('should pass Gemini API key when use_llm is enabled', async () => {
      const file = createMockFile('test.pdf', 1024)
      const geminiApiKey = 'gemini-key-123'
      const options: MarkerOptions = {
        ...defaultOptions,
        use_llm: true,
      }

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          request_check_url: 'url',
        }),
      })

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          status: 'complete',
          markdown: '# Result',
        }),
      })

      const promise = convertPdfToMarkdownLocal(file, geminiApiKey, options)
      await vi.runAllTimersAsync()
      const result = await promise

      expect(result.success).toBe(true)

      // Verify Gemini API key was passed in submit
      const submitCall = fetchMock.mock.calls[0]
      const formData = submitCall[1].body as FormData
      expect(formData.get('geminiApiKey')).toBe(geminiApiKey)
    })
  })
})
