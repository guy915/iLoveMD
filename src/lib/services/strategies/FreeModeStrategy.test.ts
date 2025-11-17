/**
 * Tests for FreeModeStrategy
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
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
    it('should poll conversion status with checkUrl', async () => {
      strategy = new FreeModeStrategy(null)

      const checkUrl = 'https://modal.com/check/123'
      const mockResponse: MarkerPollResponse = {
        success: true,
        status: 'processing'
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      })

      const result = await strategy.pollStatus(checkUrl)

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(API_ENDPOINTS.MARKER_LOCAL)
      )
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(encodeURIComponent(checkUrl))
      )
      expect(result).toEqual(mockResponse)
    })

    it('should throw error if polling fails', async () => {
      strategy = new FreeModeStrategy(null)

      const checkUrl = 'https://modal.com/check/123'

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503
      })

      await expect(strategy.pollStatus(checkUrl)).rejects.toThrow(
        'Polling failed: 503'
      )
    })

    it('should encode checkUrl properly', async () => {
      strategy = new FreeModeStrategy(null)

      const checkUrl = 'https://modal.com/check/123?foo=bar&baz=qux'
      const encodedCheckUrl = encodeURIComponent(checkUrl)

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, status: 'complete' })
      })

      await strategy.pollStatus(checkUrl)

      const fetchCall = (fetch as any).mock.calls[0][0]
      expect(fetchCall).toContain(encodedCheckUrl)
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
