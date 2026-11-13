/**
 * Tests for FreeModeStrategy
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FreeModeStrategy } from './FreeModeStrategy'
import type { MarkerOptions, MarkerSubmitResponse, MarkerPollResponse } from '@/types'
import { API_ENDPOINTS } from '@/lib/constants'

describe('FreeModeStrategy', () => {
  let strategy: FreeModeStrategy

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('submitConversion', () => {
    it('should submit file with Gemini API key', async () => {
      const geminiKey = 'test-gemini-key'
      strategy = new FreeModeStrategy(geminiKey)

      const mockFile = new File(['test'], 'test.pdf', { type: 'application/pdf' })
      const mockOptions: MarkerOptions = { use_llm: true }
      const mockResponse: MarkerSubmitResponse = {
        success: true,
        request_check_url: 'https://modal.com/check/123'
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      })

      const result = await strategy.submitConversion(mockFile, mockOptions)

      expect(fetch).toHaveBeenCalledWith(
        API_ENDPOINTS.MARKER_LOCAL,
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData)
        })
      )
      expect(result).toEqual(mockResponse)
    })

    it('should submit file without Gemini API key', async () => {
      strategy = new FreeModeStrategy(null)

      const mockFile = new File(['test'], 'test.pdf', { type: 'application/pdf' })
      const mockOptions: MarkerOptions = { use_llm: false }
      const mockResponse: MarkerSubmitResponse = {
        success: true,
        request_check_url: 'https://modal.com/check/123'
      }

      let capturedFormData: FormData | null = null
      global.fetch = vi.fn().mockImplementation(async (url, options) => {
        capturedFormData = options.body as FormData
        return {
          ok: true,
          json: async () => mockResponse
        }
      })

      const result = await strategy.submitConversion(mockFile, mockOptions)

      expect(capturedFormData).toBeTruthy()
      expect(capturedFormData!.get('geminiApiKey')).toBeNull()
      expect(capturedFormData!.get('file')).toBe(mockFile)
      expect(result).toEqual(mockResponse)
    })

    it('should include Gemini key in FormData when provided', async () => {
      const geminiKey = 'test-gemini-key'
      strategy = new FreeModeStrategy(geminiKey)

      const mockFile = new File(['test'], 'test.pdf', { type: 'application/pdf' })
      const mockOptions: MarkerOptions = { use_llm: true }

      let capturedFormData: FormData | null = null
      global.fetch = vi.fn().mockImplementation(async (url, options) => {
        capturedFormData = options.body as FormData
        return {
          ok: true,
          json: async () => ({ success: true, request_check_url: 'test-url' })
        }
      })

      await strategy.submitConversion(mockFile, mockOptions)

      expect(capturedFormData).toBeTruthy()
      expect(capturedFormData!.get('geminiApiKey')).toBe(geminiKey)
      expect(capturedFormData!.get('file')).toBe(mockFile)
      expect(capturedFormData!.get('options')).toBe(JSON.stringify(mockOptions))
    })

    it('should throw error if Modal request fails', async () => {
      strategy = new FreeModeStrategy('test-key')

      const mockFile = new File(['test'], 'test.pdf', { type: 'application/pdf' })
      const mockOptions: MarkerOptions = { use_llm: true }

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error'
      })

      await expect(strategy.submitConversion(mockFile, mockOptions)).rejects.toThrow(
        'Modal request failed: 500 - Internal Server Error'
      )
    })
  })

  describe('pollStatus', () => {
    const checkUrl = `${API_ENDPOINTS.LOCAL_MARKER_INSTANCE}/status/abc-123`

    afterEach(() => {
      vi.useRealTimers()
    })

    it('polls the Modal status URL directly and passes images through', async () => {
      strategy = new FreeModeStrategy(null)
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 'complete', markdown: '![](a.jpeg)', images: { 'a.jpeg': 'AAAA' } })
      })

      const result = await strategy.pollStatus(checkUrl)

      expect(fetch).toHaveBeenCalledWith(checkUrl, undefined)
      expect(result).toEqual({
        success: true,
        status: 'complete',
        markdown: '![](a.jpeg)',
        progress: undefined,
        images: { 'a.jpeg': 'AAAA' }
      })
    })

    it('refuses status URLs from other hosts', async () => {
      strategy = new FreeModeStrategy(null)
      global.fetch = vi.fn()
      await expect(strategy.pollStatus('https://evil.example/status/1')).rejects.toThrow('Invalid status URL')
      expect(fetch).not.toHaveBeenCalled()
    })

    it('throws when polling fails', async () => {
      strategy = new FreeModeStrategy(null)
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503, text: async () => '' })
      await expect(strategy.pollStatus(checkUrl)).rejects.toThrow('Polling failed: 503')
    })

    it('treats 404 as processing for a new job, and as lost after the grace period', async () => {
      vi.useFakeTimers()
      strategy = new FreeModeStrategy(null)
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 })

      expect(await strategy.pollStatus(checkUrl)).toEqual({ success: true, status: 'processing' })

      vi.advanceTimersByTime(FreeModeStrategy.JOB_VISIBLE_GRACE_MS + 1)
      const lost = await strategy.pollStatus(checkUrl)
      expect(lost.status).toBe('error')
      expect(lost.error).toContain('lost')
    })
  })

  describe('cancelConversion', () => {
    it('asks Modal to cancel the job', async () => {
      strategy = new FreeModeStrategy(null)
      global.fetch = vi.fn().mockResolvedValue({ ok: true })
      await strategy.cancelConversion(`${API_ENDPOINTS.LOCAL_MARKER_INSTANCE}/status/abc-123`)
      expect(fetch).toHaveBeenCalledWith(`${API_ENDPOINTS.LOCAL_MARKER_INSTANCE}/cancel/abc-123`, { method: 'POST' })
    })
  })

  describe('getErrorPrefix', () => {
    it('should return "Modal"', () => {
      strategy = new FreeModeStrategy(null)
      expect(strategy.getErrorPrefix()).toBe('Modal')
    })
  })

  describe('needsInitialDelay', () => {
    it('should return true', () => {
      strategy = new FreeModeStrategy(null)
      expect(strategy.needsInitialDelay()).toBe(true)
    })
  })
})
