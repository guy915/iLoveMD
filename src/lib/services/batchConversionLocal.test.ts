import { describe, it, expect, vi, beforeEach } from 'vitest'
import { convertBatchPdfToMarkdownLocal, type BatchProgress } from './batchConversionService'

vi.mock('./markerApiService', () => ({
  convertPdfToMarkdown: vi.fn(),
  convertPdfToMarkdownLocal: vi.fn(),
}))

vi.mock('jszip', () => {
  const MockJSZip = class {
    file = vi.fn()
    generateAsync = vi.fn().mockResolvedValue(new Blob(['zip']))
  }
  return { default: MockJSZip }
})

import { convertPdfToMarkdownLocal } from './markerApiService'

const makeFile = (name: string) => new File(['%PDF-test'], name, { type: 'application/pdf' })

describe('convertBatchPdfToMarkdownLocal', () => {
  const mockConvert = vi.mocked(convertPdfToMarkdownLocal)

  beforeEach(() => {
    mockConvert.mockReset()
  })

  it('converts each file exactly once', async () => {
    mockConvert.mockImplementation(async (file: File) => ({ success: true, markdown: `# ${file.name}` }))
    const files = ['a.pdf', 'b.pdf', 'c.pdf', 'd.pdf'].map(makeFile)

    const result = await convertBatchPdfToMarkdownLocal(files, {
      geminiApiKey: null,
      markerOptions: {} as never,
    })

    const calledNames = mockConvert.mock.calls.map(c => (c[0] as File).name).sort()
    expect(calledNames).toEqual(['a.pdf', 'b.pdf', 'c.pdf', 'd.pdf'])
    expect(result.success).toBe(true)
    expect(result.completed).toHaveLength(4)
  })

  it('reports consistent progress counts', async () => {
    mockConvert.mockImplementation(async (file: File) => ({ success: true, markdown: `# ${file.name}` }))
    const files = ['a.pdf', 'b.pdf', 'c.pdf'].map(makeFile)
    let last: BatchProgress | null = null

    await convertBatchPdfToMarkdownLocal(files, {
      geminiApiKey: null,
      markerOptions: {} as never,
      onProgress: p => { last = { ...p } },
    })

    expect(last!.completed).toBe(3)
    expect(last!.inProgress).toBe(0)
  })

  it('never runs more than 10 conversions at once', async () => {
    let active = 0
    let peak = 0
    mockConvert.mockImplementation(async () => {
      active++
      peak = Math.max(peak, active)
      await new Promise(r => setTimeout(r, 5))
      active--
      return { success: true, markdown: '# x' }
    })
    const files = Array.from({ length: 25 }, (_, i) => makeFile(`f${i}.pdf`))

    vi.useFakeTimers()
    const promise = convertBatchPdfToMarkdownLocal(files, { geminiApiKey: null, markerOptions: {} as never })
    await vi.runAllTimersAsync()
    const result = await promise
    vi.useRealTimers()

    expect(peak).toBeLessThanOrEqual(10)
    expect(result.completed).toHaveLength(25)
    expect(mockConvert).toHaveBeenCalledTimes(25)
  })

  it('marks files that never started as cancelled when aborted', async () => {
    const controller = new AbortController()
    mockConvert.mockImplementation(async () => {
      controller.abort()
      return { success: false, error: 'Conversion cancelled' }
    })
    const files = ['a.pdf', 'b.pdf', 'c.pdf'].map(makeFile)

    const result = await convertBatchPdfToMarkdownLocal(files, {
      geminiApiKey: null,
      markerOptions: {} as never,
      signal: controller.signal,
    })

    expect(mockConvert).toHaveBeenCalledTimes(1)
    expect(result.success).toBe(false)
    expect(result.failed.every(r => r.status === 'cancelled')).toBe(true)
  })
})

describe('isRetryableError', () => {
  it.each([
    ['API request failed: 401 - Invalid API key', false],
    ['Conversion request failed: 413 - File too large', false],
    ['API request failed: 400 - Only PDF files are accepted', false],
    ['Conversion cancelled', false],
    ['API request failed: 429 - Too many requests', true],
    ['API request failed: 408', true],
    ['API request failed: 503 - Service unavailable', true],
    ['Polling failed: 500', true],
    ['Conversion failed on Modal: Out of memory', true],
    ['Conversion failed on API: This PDF is password-protected. Remove the password and try again.', false],
    ['Conversion failed on Modal: This PDF is damaged or is not a valid PDF file.', false],
    ['No text was found in this PDF. It may be blank.', false],
    ['Conversion timeout. Please try again.', false],
  ])('%s -> %s', async (message, expected) => {
    const { isRetryableError } = await import('./batchConversionService')
    expect(isRetryableError(new Error(message))).toBe(expected)
  })

  it('does not retry a file whose API key is rejected', async () => {
    const mockConvert = vi.mocked(convertPdfToMarkdownLocal)
    mockConvert.mockReset()
    mockConvert.mockResolvedValue({ success: false, error: 'Conversion request failed: 400 - Gemini API key is required' })

    const result = await convertBatchPdfToMarkdownLocal([makeFile('a.pdf'), makeFile('b.pdf')], {
      geminiApiKey: null,
      markerOptions: {} as never,
      maxRetries: 3,
    })

    expect(mockConvert).toHaveBeenCalledTimes(2)
    expect(result.failed.every(r => r.attempts === 1)).toBe(true)
  })
})
