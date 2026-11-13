import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from './route'

function createRequest(body: unknown): NextRequest {
  return new NextRequest(new URL('http://localhost:3000/api/marker/upload-url'), {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/marker/upload-url', () => {
  const apiKey = 'k'.repeat(40)
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    global.fetch = fetchMock
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the presigned upload URL from Datalab', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        file_id: 123,
        upload_url: 'https://storage.example.com/upload?sig=1',
        reference: 'datalab://file-abc',
        expires_in: 3600,
      }),
    })

    const response = await POST(createRequest({ apiKey, filename: 'big.pdf', size: 50 * 1024 * 1024 }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({
      success: true,
      upload_url: 'https://storage.example.com/upload?sig=1',
      file_id: '123',
      reference: 'datalab://file-abc',
    })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://www.datalab.to/api/v1/files/upload')
    expect(init.headers['X-Api-Key']).toBe(apiKey)
    expect(JSON.parse(init.body)).toEqual({ filename: 'big.pdf', content_type: 'application/pdf' })
  })

  it.each([
    [{ filename: 'a.pdf', size: 10 }, 'API key is required'],
    [{ apiKey: 'short', filename: 'a.pdf', size: 10 }, 'Invalid API key format (must be 32-128 alphanumeric characters)'],
    [{ apiKey, filename: 'a.docx', size: 10 }, 'Only PDF files are accepted'],
    [{ apiKey, filename: 'a.pdf', size: 0 }, 'File is empty. Please upload a valid PDF file.'],
  ])('rejects invalid input %#', async (body, error) => {
    const response = await POST(createRequest(body))
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe(error)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects files over 200 MB', async () => {
    const response = await POST(createRequest({ apiKey, filename: 'a.pdf', size: 201 * 1024 * 1024 }))

    expect(response.status).toBe(413)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('passes through a Datalab auth error', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ detail: 'Invalid API key' }) })

    const response = await POST(createRequest({ apiKey, filename: 'a.pdf', size: 10 }))
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Invalid API key')
  })

  it('rejects a non-HTTPS upload URL', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ file_id: 1, upload_url: 'http://insecure', reference: 'datalab://file-a' }),
    })

    const response = await POST(createRequest({ apiKey, filename: 'a.pdf', size: 10 }))

    expect(response.status).toBe(502)
  })
})
