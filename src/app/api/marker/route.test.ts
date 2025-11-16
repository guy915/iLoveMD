import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GET } from './route'
import { NextRequest } from 'next/server'

/**
 * API Route Tests
 *
 * Note: POST /api/marker tests are excluded from this suite because they require
 * FormData parsing via request.formData(), which doesn't work reliably in unit tests
 * without a real HTTP server. The POST handler should be tested via integration tests
 * or E2E tests using tools like Playwright or Cypress.
 *
 * These tests focus on:
 * - GET /api/marker (polling endpoint)
 * - Network error handling
 * - Response validation
 * - Error scenarios
 */

// Helper to create NextRequest for GET
function createGetRequest(searchParams: Record<string, string>, headers?: Record<string, string>): NextRequest {
  const url = new URL('http://localhost:3000/api/marker')
  Object.entries(searchParams).forEach(([key, value]) => {
    url.searchParams.set(key, value)
  })

  const request = new NextRequest(url, {
    method: 'GET',
    headers: headers || {},
  })

  return request
}

describe('GET /api/marker', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    global.fetch = fetchMock
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('validation errors', () => {
    it('should return 400 when checkUrl is missing', async () => {
      const request = createGetRequest({}, { 'x-api-key': 'test-key' })
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Missing parameters')
    })

    it('should return 400 when API key header is missing', async () => {
      const request = createGetRequest({ checkUrl: 'https://www.datalab.to/api/v1/marker/check' })
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Missing parameters')
    })

    it('should return 400 when both checkUrl and API key are missing', async () => {
      const request = createGetRequest({})
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Missing parameters')
    })
  })

  describe('network errors', () => {
    it('should return 503 on timeout error', async () => {
      const abortError = new Error('Request timed out')
      abortError.name = 'AbortError'
      fetchMock.mockRejectedValueOnce(abortError)

      const request = createGetRequest(
        { checkUrl: 'https://www.datalab.to/api/v1/marker/check' },
        { 'x-api-key': 'test-key' }
      )
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Request timed out')
      expect(data.details?.errorType).toBe('timeout')
    })

    it('should return 503 on connection error', async () => {
      const connectionError = new Error('Connection refused')
      ;(connectionError as any).code = 'ECONNREFUSED'
      fetchMock.mockRejectedValueOnce(connectionError)

      const request = createGetRequest(
        { checkUrl: 'https://www.datalab.to/api/v1/marker/check' },
        { 'x-api-key': 'test-key' }
      )
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Unable to connect')
      expect(data.details?.errorType).toBe('connection')
    })

    it('should return 503 on DNS error', async () => {
      const dnsError = new Error('DNS lookup failed')
      ;(dnsError as any).code = 'ENOTFOUND'
      fetchMock.mockRejectedValueOnce(dnsError)

      const request = createGetRequest(
        { checkUrl: 'https://www.datalab.to/api/v1/marker/check' },
        { 'x-api-key': 'test-key' }
      )
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Unable to resolve')
      expect(data.details?.errorType).toBe('dns')
    })

    it('should return 503 on unknown network error', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Unknown network error'))

      const request = createGetRequest(
        { checkUrl: 'https://www.datalab.to/api/v1/marker/check' },
        { 'x-api-key': 'test-key' }
      )
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Network error occurred')
      expect(data.details?.errorType).toBe('unknown')
    })

    it('should detect timeout from error message string', async () => {
      fetchMock.mockRejectedValueOnce(new Error('request timed out'))

      const request = createGetRequest(
        { checkUrl: 'https://www.datalab.to/api/v1/marker/check' },
        { 'x-api-key': 'test-key' }
      )
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.details?.errorType).toBe('timeout')
    })

    it('should detect connection error from error message string', async () => {
      fetchMock.mockRejectedValueOnce(new Error('econnrefused occurred'))

      const request = createGetRequest(
        { checkUrl: 'https://www.datalab.to/api/v1/marker/check' },
        { 'x-api-key': 'test-key' }
      )
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.details?.errorType).toBe('connection')
    })
  })

  describe('API response handling', () => {
    it('should return 502 when response is not valid JSON', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error('Invalid JSON')
        },
      })

      const request = createGetRequest(
        { checkUrl: 'https://www.datalab.to/api/v1/marker/check' },
        { 'x-api-key': 'test-key' }
      )
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(502)
      expect(data.success).toBe(false)
      expect(data.error).toContain('invalid response')
      expect(data.details?.httpStatus).toBe(200)
    })

    it('should return 502 when response structure is invalid', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          unexpected: 'field',
        }),
      })

      const request = createGetRequest(
        { checkUrl: 'https://www.datalab.to/api/v1/marker/check' },
        { 'x-api-key': 'test-key' }
      )
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(502)
      expect(data.success).toBe(false)
      expect(data.error).toContain('malformed response')
      expect(data.details?.receivedKeys).toEqual(['unexpected'])
    })

    it('should handle API error responses', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({
          error: 'Request not found',
        }),
      })

      const request = createGetRequest(
        { checkUrl: 'https://www.datalab.to/api/v1/marker/check' },
        { 'x-api-key': 'test-key' }
      )
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Request not found')
    })

    it('should use default error message when no error field present', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({
          status: 'error',
        }),
      })

      const request = createGetRequest(
        { checkUrl: 'https://www.datalab.to/api/v1/marker/check' },
        { 'x-api-key': 'test-key' }
      )
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Failed to check status')
    })

    it('should handle 401 Unauthorized responses', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          error: 'Invalid API key',
        }),
      })

      const request = createGetRequest(
        { checkUrl: 'https://www.datalab.to/api/v1/marker/check' },
        { 'x-api-key': 'invalid-key' }
      )
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Invalid API key')
    })

    it('should handle 429 Rate Limit responses', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          error: 'Rate limit exceeded',
        }),
      })

      const request = createGetRequest(
        { checkUrl: 'https://www.datalab.to/api/v1/marker/check' },
        { 'x-api-key': 'test-key' }
      )
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Rate limit exceeded')
    })
  })

  describe('successful polling', () => {
    it('should successfully poll with pending status', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          status: 'pending',
          progress: 0,
        }),
      })

      const request = createGetRequest(
        { checkUrl: 'https://www.datalab.to/api/v1/marker/check' },
        { 'x-api-key': 'test-key' }
      )
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.status).toBe('pending')
      expect(data.progress).toBe(0)
    })

    it('should successfully poll with processing status', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          status: 'processing',
          progress: 50,
        }),
      })

      const request = createGetRequest(
        { checkUrl: 'https://www.datalab.to/api/v1/marker/check' },
        { 'x-api-key': 'test-key' }
      )
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.status).toBe('processing')
      expect(data.progress).toBe(50)
    })

    it('should successfully poll with complete status and markdown', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          status: 'complete',
          markdown: '# Test Document\n\nContent here.',
          progress: 100,
        }),
      })

      const request = createGetRequest(
        { checkUrl: 'https://www.datalab.to/api/v1/marker/check' },
        { 'x-api-key': 'test-key' }
      )
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.status).toBe('complete')
      expect(data.markdown).toBe('# Test Document\n\nContent here.')
      expect(data.progress).toBe(100)
    })

    it('should successfully poll with error status', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          status: 'error',
          error: 'Conversion failed',
        }),
      })

      const request = createGetRequest(
        { checkUrl: 'https://www.datalab.to/api/v1/marker/check' },
        { 'x-api-key': 'test-key' }
      )
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.status).toBe('error')
    })

    it('should handle response with only status field', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          status: 'pending',
        }),
      })

      const request = createGetRequest(
        { checkUrl: 'https://www.datalab.to/api/v1/marker/check' },
        { 'x-api-key': 'test-key' }
      )
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.status).toBe('pending')
      expect(data.progress).toBeUndefined()
      expect(data.markdown).toBeUndefined()
    })

    it('should handle response with only error field', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          error: 'Processing error',
        }),
      })

      const request = createGetRequest(
        { checkUrl: 'https://www.datalab.to/api/v1/marker/check' },
        { 'x-api-key': 'test-key' }
      )
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.status).toBeUndefined()
    })
  })

  describe('edge cases', () => {
    it('should handle empty checkUrl gracefully', async () => {
      const request = createGetRequest(
        { checkUrl: '' },
        { 'x-api-key': 'test-key' }
      )
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Missing parameters')
    })

    it('should handle empty API key gracefully', async () => {
      const request = createGetRequest(
        { checkUrl: 'https://www.datalab.to/api/v1/marker/check' },
        { 'x-api-key': '' }
      )
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Missing parameters')
    })

    it('should handle response with progress field only', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          progress: 75,
        }),
      })

      const request = createGetRequest(
        { checkUrl: 'https://www.datalab.to/api/v1/marker/check' },
        { 'x-api-key': 'test-key' }
      )
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.progress).toBe(75)
    })

    it('should send API key in X-Api-Key header to external service', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          status: 'pending',
        }),
      })

      const request = createGetRequest(
        { checkUrl: 'https://www.datalab.to/api/v1/marker/check' },
        { 'x-api-key': 'my-secret-key' }
      )
      await GET(request)

      expect(fetchMock).toHaveBeenCalledWith(
        'https://www.datalab.to/api/v1/marker/check',
        expect.objectContaining({
          headers: {
            'X-Api-Key': 'my-secret-key',
          },
        })
      )
    })

    it('should use GET method when calling external API', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          status: 'pending',
        }),
      })

      const request = createGetRequest(
        { checkUrl: 'https://www.datalab.to/api/v1/marker/check' },
        { 'x-api-key': 'test-key' }
      )
      await GET(request)

      expect(fetchMock).toHaveBeenCalledWith(
        'https://www.datalab.to/api/v1/marker/check',
        expect.objectContaining({
          method: 'GET',
        })
      )
    })
  })
})
