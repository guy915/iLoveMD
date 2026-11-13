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
