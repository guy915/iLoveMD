import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PaidModeStrategy } from './PaidModeStrategy'
import { FreeModeStrategy } from './FreeModeStrategy'
import { API_ENDPOINTS, FILE_SIZE, MARKER_CONFIG } from '@/lib/constants'

function fileOfSize(size: number): File {
  const file = new File(['%PDF-1.4'], 'big.pdf', { type: 'application/pdf' })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

const options = { ...MARKER_CONFIG.DEFAULT_OPTIONS }
const largeSize = FILE_SIZE.MAX_PROXY_UPLOAD_SIZE + 1

const jsonResponse = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
  text: async () => JSON.stringify(body),
})

describe('large file uploads bypass the API route', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    global.fetch = fetchMock as unknown as typeof fetch
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('PaidModeStrategy', () => {
    it('sends small files through the API route as before', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, request_check_url: 'u' }))

      await new PaidModeStrategy('key').submitConversion(fileOfSize(1000), options)

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchMock.mock.calls[0][0]).toBe(API_ENDPOINTS.MARKER)
      expect((fetchMock.mock.calls[0][1].body as FormData).get('file')).not.toBeNull()
    })

    it('uploads large files to storage and submits only the reference', async () => {
      const file = fileOfSize(largeSize)
      fetchMock
        .mockResolvedValueOnce(jsonResponse({
          success: true, upload_url: 'https://storage.example.com/put', file_id: '7', reference: 'datalab://file-x',
        }))
        .mockResolvedValueOnce({ ok: true, status: 200 })
        .mockResolvedValueOnce(jsonResponse({ success: true, request_id: 'r', request_check_url: 'u' }))

      const result = await new PaidModeStrategy('key').submitConversion(file, options)

      expect(result.request_check_url).toBe('u')
      expect(fetchMock.mock.calls[0][0]).toBe(API_ENDPOINTS.MARKER_UPLOAD_URL)
      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ apiKey: 'key', filename: 'big.pdf', size: largeSize })

      expect(fetchMock.mock.calls[1][0]).toBe('https://storage.example.com/put')
      expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'PUT', body: file })

      const submitted = fetchMock.mock.calls[2][1].body as FormData
      expect(fetchMock.mock.calls[2][0]).toBe(API_ENDPOINTS.MARKER)
      expect(submitted.get('file')).toBeNull()
      expect(submitted.get('fileReference')).toBe('datalab://file-x')
      expect(submitted.get('fileId')).toBe('7')
    })

    it('reports a failed storage upload', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({
          success: true, upload_url: 'https://storage.example.com/put', file_id: '7', reference: 'datalab://file-x',
        }))
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))

      await expect(new PaidModeStrategy('key').submitConversion(fileOfSize(largeSize), options))
        .rejects.toThrow('Failed to upload the file to Marker storage: Failed to fetch')
    })

    it('shows the error from the upload URL request', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ success: false, error: 'Invalid API key' }, 401))

      await expect(new PaidModeStrategy('key').submitConversion(fileOfSize(largeSize), options))
        .rejects.toThrow('API request failed: 401 - Invalid API key')
    })
  })

  describe('FreeModeStrategy', () => {
    it('sends large files straight to Modal and polls Modal directly', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ request_id: 'abc', request_check_url: '/status/abc' }))
        .mockResolvedValueOnce(jsonResponse({}, 404))
        .mockResolvedValueOnce(jsonResponse({ status: 'complete', markdown: '# Big' }))

      const strategy = new FreeModeStrategy(null)
      const submit = await strategy.submitConversion(fileOfSize(largeSize), options)

      const statusUrl = `${API_ENDPOINTS.LOCAL_MARKER_INSTANCE}/status/abc`
      expect(fetchMock.mock.calls[0][0]).toBe(`${API_ENDPOINTS.LOCAL_MARKER_INSTANCE}/marker`)
      const sent = fetchMock.mock.calls[0][1].body as FormData
      expect(sent.get('output_format')).toBe('markdown')
      expect(sent.get('api_key')).toBeNull()
      expect(submit.request_check_url).toBe(statusUrl)

      // Job not visible yet -> still processing
      expect(await strategy.pollStatus(statusUrl)).toEqual({ success: true, status: 'processing' })
      expect(await strategy.pollStatus(statusUrl)).toMatchObject({ success: true, status: 'complete', markdown: '# Big' })
      expect(fetchMock.mock.calls[2][0]).toBe(statusUrl)
    })

    it('passes through the job error when polling directly', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ request_id: 'abc', request_check_url: '/status/abc' }))
        .mockResolvedValueOnce(jsonResponse({ status: 'error', error: 'Out of memory' }))

      const strategy = new FreeModeStrategy(null)
      const submit = await strategy.submitConversion(fileOfSize(largeSize), options)

      expect(await strategy.pollStatus(submit.request_check_url!)).toEqual({
        success: true, status: 'error', error: 'Out of memory', markdown: undefined, progress: undefined,
      })
    })

    it('requires a Gemini key for LLM mode on direct uploads', async () => {
      await expect(new FreeModeStrategy(null).submitConversion(fileOfSize(largeSize), { ...options, use_llm: true }))
        .rejects.toThrow('Gemini API key is required')
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('sends small files through the API route as before', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, request_check_url: 'https://x.modal.run/status/1' }))

      await new FreeModeStrategy(null).submitConversion(fileOfSize(1000), options)

      expect(fetchMock.mock.calls[0][0]).toBe(API_ENDPOINTS.MARKER_LOCAL)
    })
  })
})
