import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GET, POST } from './route'
import { NextRequest } from 'next/server'
import { FILE_SIZE, MARKER_CONFIG } from '@/lib/constants'

/**
 * API Route Tests
 *
 * Tests both GET and POST endpoints with comprehensive error handling coverage
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

  describe('SSRF protection', () => {
    it('should reject checkUrl from non-datalab.to domain', async () => {
      const request = createGetRequest(
        { checkUrl: 'https://evil.com/api/v1/marker/check' },
        { 'x-api-key': 'test-key' }
      )
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Invalid check URL domain')
    })

    it('should reject checkUrl with invalid subdomain', async () => {
      const request = createGetRequest(
        { checkUrl: 'https://evil-datalab.to/api' },
        { 'x-api-key': 'test-key' }
      )
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Invalid check URL domain')
    })

    it('should accept valid datalab.to domain', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'pending' }),
      })

      const request = createGetRequest(
        { checkUrl: 'https://datalab.to/api/check' },
        { 'x-api-key': 'test-key' }
      )
      const response = await GET(request)

      expect(response.status).toBe(200)
    })

    it('should accept valid www.datalab.to subdomain', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'pending' }),
      })

      const request = createGetRequest(
        { checkUrl: 'https://www.datalab.to/api/check' },
        { 'x-api-key': 'test-key' }
      )
      const response = await GET(request)

      expect(response.status).toBe(200)
    })

    it('should accept valid api.datalab.to subdomain', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'pending' }),
      })

      const request = createGetRequest(
        { checkUrl: 'https://api.datalab.to/check' },
        { 'x-api-key': 'test-key' }
      )
      const response = await GET(request)

      expect(response.status).toBe(200)
    })

    it('should reject non-HTTPS checkUrl', async () => {
      const request = createGetRequest(
        { checkUrl: 'http://www.datalab.to/api/check' },
        { 'x-api-key': 'test-key' }
      )
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Invalid checkUrl: must use HTTPS')
    })
  })
})

// Helper to create a mock PDF file for POST tests
function createMockPdfFile(name: string, size: number, content = '%PDF-1.4 mock content'): File {
  const blob = new Blob([content], { type: 'application/pdf' })
  const file = new File([blob], name, { type: 'application/pdf' })
  
  Object.defineProperty(file, 'size', {
    value: size,
    writable: false,
  })
  
  Object.defineProperty(file, 'arrayBuffer', {
    value: async () => new TextEncoder().encode(content).buffer,
    writable: false,
  })
  
  return file
}

// Helper to create NextRequest for POST with FormData
function createPostRequest(formData: FormData): NextRequest {
  const url = new URL('http://localhost:3000/api/marker')
  const request = new NextRequest(url, {
    method: 'POST',
    body: formData as any,
  })
  
  // Mock formData method
  ;(request as any).formData = async () => formData
  
  return request
}

describe('POST /api/marker', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  describe('validation errors', () => {
    it('should return 400 when file is missing', async () => {
      const formData = new FormData()
      formData.append('apiKey', 'test-key-12345678901234567890123456789012')
      
      const request = createPostRequest(formData)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('No file provided')
    })

    it('should return 400 when API key is missing', async () => {
      const formData = new FormData()
      const file = createMockPdfFile('test.pdf', 1000)
      formData.append('file', file)
      
      const request = createPostRequest(formData)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('API key is required')
    })

    it('should return 400 for file without PDF MIME type', async () => {
      const formData = new FormData()
      const file = new File(['content'], 'test.txt', { type: 'text/plain' })
      formData.append('file', file)
      formData.append('apiKey', 'test-key-12345678901234567890123456789012')
      
      const request = createPostRequest(formData)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Only PDF files are accepted')
    })

    it('should return 400 for file without PDF extension', async () => {
      const formData = new FormData()
      const file = new File(['%PDF-1.4 content'], 'test.txt', { type: 'application/pdf' })
      formData.append('file', file)
      formData.append('apiKey', 'test-key-12345678901234567890123456789012')
      
      const request = createPostRequest(formData)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Only PDF files are accepted (invalid file extension)')
    })

    it('should return 400 for empty file', async () => {
      const formData = new FormData()
      const file = createMockPdfFile('test.pdf', 0, '')
      formData.append('file', file)
      formData.append('apiKey', 'test-key-12345678901234567890123456789012')
      
      const request = createPostRequest(formData)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('File is empty. Please upload a valid PDF file.')
    })

    it('should return 400 for file too small', async () => {
      const formData = new FormData()
      const file = createMockPdfFile('test.pdf', 50, '%PDF')
      formData.append('file', file)
      formData.append('apiKey', 'test-key-12345678901234567890123456789012')
      
      const request = createPostRequest(formData)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('File too small to be a valid PDF')
    })

    it('should return 400 for invalid PDF magic bytes', async () => {
      const formData = new FormData()
      const file = createMockPdfFile('test.pdf', 1000, 'NOT A PDF FILE')
      formData.append('file', file)
      formData.append('apiKey', 'test-key-12345678901234567890123456789012')
      
      const request = createPostRequest(formData)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Invalid PDF file format (file does not appear to be a PDF)')
    })

    it('should return 413 for file too large', async () => {
      const formData = new FormData()
      const file = createMockPdfFile('large.pdf', FILE_SIZE.MAX_PDF_FILE_SIZE + 1)
      formData.append('file', file)
      formData.append('apiKey', 'test-key-12345678901234567890123456789012')
      
      const request = createPostRequest(formData)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(413)
      expect(data.success).toBe(false)
      expect(data.error).toContain('File too large')
    })

    it('should return 400 for API key too short', async () => {
      const formData = new FormData()
      const file = createMockPdfFile('test.pdf', 1000)
      formData.append('file', file)
      formData.append('apiKey', 'short')
      
      const request = createPostRequest(formData)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Invalid API key format')
    })

    it('should return 400 for invalid API key format', async () => {
      const formData = new FormData()
      const file = createMockPdfFile('test.pdf', 1000)
      formData.append('file', file)
      formData.append('apiKey', 'invalid@key#with$special%chars!!!')
      
      const request = createPostRequest(formData)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Invalid API key format (must be 32-128 alphanumeric characters)')
    })

    it('should return 400 for invalid options JSON', async () => {
      const formData = new FormData()
      const file = createMockPdfFile('test.pdf', 1000)
      formData.append('file', file)
      formData.append('apiKey', 'test-key-12345678901234567890123456789012')
      formData.append('options', '{ invalid json }')
      
      const request = createPostRequest(formData)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Invalid options format')
    })
  })

  describe('successful submission', () => {
    it('should submit PDF successfully with valid inputs', async () => {
      const formData = new FormData()
      const file = createMockPdfFile('test.pdf', 1000)
      formData.append('file', file)
      formData.append('apiKey', 'test-key-12345678901234567890123456789012')

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          request_id: 'test-request-123',
          request_check_url: 'https://www.datalab.to/api/v1/marker/check',
        }),
      })

      const request = createPostRequest(formData)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.request_id).toBe('test-request-123')
      expect(data.request_check_url).toBe('https://www.datalab.to/api/v1/marker/check')
    })

    it('should handle valid options JSON', async () => {
      const formData = new FormData()
      const file = createMockPdfFile('test.pdf', 1000)
      formData.append('file', file)
      formData.append('apiKey', 'test-key-12345678901234567890123456789012')
      formData.append('options', JSON.stringify({ paginate: false, use_llm: true }))

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          request_id: 'test-request-123',
          request_check_url: 'https://www.datalab.to/api/v1/marker/check',
        }),
      })

      const request = createPostRequest(formData)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should trim API key before validation', async () => {
      const formData = new FormData()
      const file = createMockPdfFile('test.pdf', 1000)
      formData.append('file', file)
      formData.append('apiKey', '  test-key-12345678901234567890123456789012  ')

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          request_id: 'test-request-123',
          request_check_url: 'https://www.datalab.to/api/v1/marker/check',
        }),
      })

      const request = createPostRequest(formData)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })
  })

  describe('API error responses', () => {
    it('should handle API 401 Unauthorized', async () => {
      const formData = new FormData()
      const file = createMockPdfFile('test.pdf', 1000)
      formData.append('file', file)
      formData.append('apiKey', 'invalid-key-12345678901234567890123')

      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          success: false,
          error: 'Invalid API key',
        }),
      })

      const request = createPostRequest(formData)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Invalid API key')
    })

    it('should handle API network timeout', async () => {
      const formData = new FormData()
      const file = createMockPdfFile('test.pdf', 1000)
      formData.append('file', file)
      formData.append('apiKey', 'test-key-12345678901234567890123456789012')

      const timeoutError = new Error('Request timed out')
      timeoutError.name = 'AbortError'
      fetchMock.mockRejectedValueOnce(timeoutError)

      const request = createPostRequest(formData)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.success).toBe(false)
      expect(data.error).toContain('timed out')
    })

    it('should handle malformed API response', async () => {
      const formData = new FormData()
      const file = createMockPdfFile('test.pdf', 1000)
      formData.append('file', file)
      formData.append('apiKey', 'test-key-12345678901234567890123456789012')

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          unexpected: 'fields',
        }),
      })

      const request = createPostRequest(formData)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(502)
      expect(data.success).toBe(false)
      expect(data.error).toContain('malformed response')
    })

    it('should handle JSON parse errors', async () => {
      const formData = new FormData()
      const file = createMockPdfFile('test.pdf', 1000)
      formData.append('file', file)
      formData.append('apiKey', 'test-key-12345678901234567890123456789012')

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error('Invalid JSON')
        },
      })

      const request = createPostRequest(formData)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(502)
      expect(data.success).toBe(false)
      expect(data.error).toContain('invalid response')
    })

    it('should handle response missing required fields', async () => {
      const formData = new FormData()
      const file = createMockPdfFile('test.pdf', 1000)
      formData.append('file', file)
      formData.append('apiKey', 'test-key-12345678901234567890123456789012')

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          // Missing request_id and request_check_url
        }),
      })

      const request = createPostRequest(formData)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(502)
      expect(data.success).toBe(false)
      expect(data.error).toContain('malformed response')
    })
  })
})
