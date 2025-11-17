/**
 * Tests for PaidModeStrategy
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PaidModeStrategy } from './PaidModeStrategy'
import type { MarkerOptions, MarkerSubmitResponse, MarkerPollResponse } from '@/types'
import { API_ENDPOINTS } from '@/lib/constants'

describe('PaidModeStrategy', () => {
  const mockApiKey = 'test-api-key'
  let strategy: PaidModeStrategy

  beforeEach(() => {
    strategy = new PaidModeStrategy(mockApiKey)
    vi.clearAllMocks()
  })

  describe('submitConversion', () => {
    it('should submit file with API key and options', async () => {
      const mockFile = new File(['test'], 'test.pdf', { type: 'application/pdf' })
      const mockOptions: MarkerOptions = { use_llm: true }
      const mockResponse: MarkerSubmitResponse = {
        success: true,
        request_check_url: 'https://api.marker.com/check/123'
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      })

      const result = await strategy.submitConversion(mockFile, mockOptions)

      expect(fetch).toHaveBeenCalledWith(
        API_ENDPOINTS.MARKER,
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData)
        })
      )
      expect(result).toEqual(mockResponse)
    })

    it('should throw error if API request fails', async () => {
      const mockFile = new File(['test'], 'test.pdf', { type: 'application/pdf' })
      const mockOptions: MarkerOptions = { use_llm: true }

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized'
      })

      await expect(strategy.submitConversion(mockFile, mockOptions)).rejects.toThrow(
        'API request failed: 401 - Unauthorized'
      )
    })

    it('should include apiKey in FormData', async () => {
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
      expect(capturedFormData!.get('apiKey')).toBe(mockApiKey)
      expect(capturedFormData!.get('file')).toBe(mockFile)
      expect(capturedFormData!.get('options')).toBe(JSON.stringify(mockOptions))
    })
  })

  describe('pollStatus', () => {
    it('should poll conversion status with checkUrl', async () => {
      const checkUrl = 'https://api.marker.com/check/123'
      const mockResponse: MarkerPollResponse = {
        success: true,
        status: 'processing'
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      })

      const result = await strategy.pollStatus(checkUrl)

      const fetchCall = (fetch as any).mock.calls[0][0]
      expect(fetchCall).toContain(API_ENDPOINTS.MARKER)
      expect(fetchCall).toContain(encodeURIComponent(checkUrl))
      expect(fetchCall).toContain(encodeURIComponent(mockApiKey))
      expect(result).toEqual(mockResponse)
    })

    it('should throw error if polling fails', async () => {
      const checkUrl = 'https://api.marker.com/check/123'

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500
      })

      await expect(strategy.pollStatus(checkUrl)).rejects.toThrow(
        'Polling failed: 500'
      )
    })

    it('should encode checkUrl and apiKey properly', async () => {
      const checkUrl = 'https://api.marker.com/check/123?foo=bar'
      const encodedCheckUrl = encodeURIComponent(checkUrl)
      const encodedApiKey = encodeURIComponent(mockApiKey)

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, status: 'complete' })
      })

      await strategy.pollStatus(checkUrl)

      const fetchCall = (fetch as any).mock.calls[0][0]
      expect(fetchCall).toContain(encodedCheckUrl)
      expect(fetchCall).toContain(encodedApiKey)
    })
  })

  describe('getErrorPrefix', () => {
    it('should return "API"', () => {
      expect(strategy.getErrorPrefix()).toBe('API')
    })
  })

  describe('needsInitialDelay', () => {
    it('should return false', () => {
      expect(strategy.needsInitialDelay()).toBe(false)
    })
  })
})
