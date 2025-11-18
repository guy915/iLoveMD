import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  convertBatchPdfToMarkdown,
  filterPdfFiles,
  filterImmediateFolderFiles,
  getFolderName,
  type BatchConversionOptions,
  type BatchProgress,
  type FileConversionResult,
} from './batchConversionService'
import { MARKER_CONFIG, FILE_SIZE } from '@/lib/constants'
import type { MarkerConversionResult } from '@/types'

// Mock dependencies
vi.mock('./markerApiService', () => ({
  convertPdfToMarkdown: vi.fn(),
}))

vi.mock('@/lib/utils/downloadUtils', () => ({
  replaceExtension: vi.fn((filename: string) => filename.replace(/\.pdf$/i, '.md')),
}))

// Mock JSZip to avoid actual ZIP generation in tests
vi.mock('jszip', () => {
  // Create a mock class constructor
  const MockJSZip = class {
    file = vi.fn()
    generateAsync = vi.fn().mockResolvedValue(new Blob(['mock zip content']))
  }

  return {
    default: MockJSZip,
  }
})

// Import mocked functions
import { convertPdfToMarkdown } from './markerApiService'

// Helper to create mock File with custom properties
function createMockFile(
  name: string,
  size: number,
  type: string = 'application/pdf',
  webkitRelativePath?: string
): File {
  const blob = new Blob(['test content'], { type })
  const file = new File([blob], name, { type })

  // Override size property
  Object.defineProperty(file, 'size', {
    value: size,
    writable: false,
  })

  // Add webkitRelativePath if provided
  if (webkitRelativePath) {
    Object.defineProperty(file, 'webkitRelativePath', {
      value: webkitRelativePath,
      writable: false,
    })
  }

  return file
}

describe('batchConversionService', () => {
  describe('filterPdfFiles', () => {
    it('should filter files by PDF mime type', () => {
      const files = [
        createMockFile('doc.pdf', 1000, 'application/pdf'),
        createMockFile('image.jpg', 500, 'image/jpeg'),
        createMockFile('text.txt', 200, 'text/plain'),
      ]

      const result = filterPdfFiles(files)

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('doc.pdf')
    })

    it('should filter files by .pdf extension (case insensitive)', () => {
      const files = [
        createMockFile('doc.PDF', 1000, 'application/octet-stream'),
        createMockFile('another.Pdf', 500, 'application/octet-stream'),
        createMockFile('text.txt', 200, 'text/plain'),
      ]

      const result = filterPdfFiles(files)

      expect(result).toHaveLength(2)
      expect(result.map(f => f.name)).toEqual(['doc.PDF', 'another.Pdf'])
    })

    it('should handle empty array', () => {
      const result = filterPdfFiles([])
      expect(result).toEqual([])
    })

    it('should return empty array when no PDFs found', () => {
      const files = [
        createMockFile('image.jpg', 500, 'image/jpeg'),
        createMockFile('text.txt', 200, 'text/plain'),
      ]

      const result = filterPdfFiles(files)
      expect(result).toEqual([])
    })
  })

  describe('filterImmediateFolderFiles', () => {
    it('should include files without webkitRelativePath', () => {
      const files = [
        createMockFile('doc1.pdf', 1000),
        createMockFile('doc2.pdf', 1000),
      ]

      const result = filterImmediateFolderFiles(files)

      expect(result).toHaveLength(2)
    })

    it('should include files in immediate folder (one slash)', () => {
      const files = [
        createMockFile('doc1.pdf', 1000, 'application/pdf', 'folder/doc1.pdf'),
        createMockFile('doc2.pdf', 1000, 'application/pdf', 'folder/doc2.pdf'),
      ]

      const result = filterImmediateFolderFiles(files)

      expect(result).toHaveLength(2)
    })

    it('should exclude files in nested folders (multiple slashes)', () => {
      const files = [
        createMockFile('doc1.pdf', 1000, 'application/pdf', 'folder/doc1.pdf'),
        createMockFile('doc2.pdf', 1000, 'application/pdf', 'folder/subfolder/doc2.pdf'),
        createMockFile('doc3.pdf', 1000, 'application/pdf', 'folder/sub1/sub2/doc3.pdf'),
      ]

      const result = filterImmediateFolderFiles(files)

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('doc1.pdf')
    })

    it('should handle mixed files with and without paths', () => {
      const files = [
        createMockFile('doc1.pdf', 1000),
        createMockFile('doc2.pdf', 1000, 'application/pdf', 'folder/doc2.pdf'),
        createMockFile('doc3.pdf', 1000, 'application/pdf', 'folder/subfolder/doc3.pdf'),
      ]

      const result = filterImmediateFolderFiles(files)

      expect(result).toHaveLength(2)
      expect(result.map(f => f.name)).toEqual(['doc1.pdf', 'doc2.pdf'])
    })
  })

  describe('getFolderName', () => {
    it('should return null for files without webkitRelativePath', () => {
      const file = createMockFile('doc.pdf', 1000)
      const result = getFolderName(file)
      expect(result).toBeNull()
    })

    it('should extract folder name from path', () => {
      const file = createMockFile('doc.pdf', 1000, 'application/pdf', 'my-folder/doc.pdf')
      const result = getFolderName(file)
      expect(result).toBe('my-folder')
    })

    it('should extract folder name from nested path', () => {
      const file = createMockFile('doc.pdf', 1000, 'application/pdf', 'my-folder/subfolder/doc.pdf')
      const result = getFolderName(file)
      expect(result).toBe('my-folder')
    })

    it('should return null for path without slash', () => {
      const file = createMockFile('doc.pdf', 1000, 'application/pdf', 'doc.pdf')
      const result = getFolderName(file)
      expect(result).toBeNull()
    })
  })

  describe('convertBatchPdfToMarkdown', () => {
    let mockConvertPdfToMarkdown: ReturnType<typeof vi.fn>

    beforeEach(() => {
      mockConvertPdfToMarkdown = vi.mocked(convertPdfToMarkdown)
      mockConvertPdfToMarkdown.mockClear()
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('should convert single file successfully', async () => {
      const file = createMockFile('doc.pdf', 1000)
      const options: BatchConversionOptions = {
        apiKey: 'test-api-key-12345678901234567890',
        markerOptions: {},
      }

      // Mock successful conversion
      mockConvertPdfToMarkdown.mockResolvedValue({
        success: true,
        markdown: '# Test',
      })

      const result = await convertBatchPdfToMarkdown([file], options)

      expect(result.success).toBe(true)
      expect(result.completed).toHaveLength(1)
      expect(result.failed).toHaveLength(0)
      expect(result.completed[0].status).toBe('complete')
      expect(result.completed[0].markdown).toBe('# Test')
      expect(result.zipBlob).toBeDefined()
    })

    it('should handle conversion failure with retries', async () => {
      const file = createMockFile('doc.pdf', 1000)
      const options: BatchConversionOptions = {
        apiKey: 'test-api-key-12345678901234567890',
        markerOptions: {},
        maxRetries: 2,
      }

      // Mock failed conversions
      mockConvertPdfToMarkdown.mockResolvedValue({
        success: false,
        error: 'Conversion failed',
      })

      const result = await convertBatchPdfToMarkdown([file], options)

      // Should attempt 3 times (initial + 2 retries)
      expect(mockConvertPdfToMarkdown).toHaveBeenCalledTimes(3)

      expect(result.success).toBe(false)
      expect(result.completed).toHaveLength(0)
      expect(result.failed).toHaveLength(1)
      expect(result.failed[0].status).toBe('failed')
      expect(result.failed[0].attempts).toBe(3)
      expect(result.error).toBe('All conversions failed. Errors: Conversion failed')
    })

    it('should respect concurrency limit', async () => {
      const files = Array.from({ length: 10 }, (_, i) =>
        createMockFile(`doc${i}.pdf`, 1000)
      )

      const options: BatchConversionOptions = {
        apiKey: 'test-api-key-12345678901234567890',
        markerOptions: {},
        maxConcurrent: 3,
      }

      let concurrentCount = 0
      let maxConcurrent = 0

      mockConvertPdfToMarkdown.mockImplementation(async () => {
        concurrentCount++
        maxConcurrent = Math.max(maxConcurrent, concurrentCount)

        // Simulate async work without real delays
        await Promise.resolve()

        concurrentCount--

        return {
          success: true,
          markdown: '# Test',
        }
      })

      await convertBatchPdfToMarkdown(files, options)

      // Should never exceed concurrency limit
      expect(maxConcurrent).toBeLessThanOrEqual(3)
    })

    it('should call progress callback with updates', async () => {
      const files = [
        createMockFile('doc1.pdf', 1000),
        createMockFile('doc2.pdf', 1000),
      ]

      const progressUpdates: BatchProgress[] = []
      const onProgress = vi.fn((progress: BatchProgress) => {
        progressUpdates.push({ ...progress })
      })

      const options: BatchConversionOptions = {
        apiKey: 'test-api-key-12345678901234567890',
        markerOptions: {},
        onProgress,
      }

      mockConvertPdfToMarkdown.mockResolvedValue({
        success: true,
        markdown: '# Test',
      })

      await convertBatchPdfToMarkdown(files, options)

      // Should have progress updates
      expect(onProgress).toHaveBeenCalled()
      expect(progressUpdates.length).toBeGreaterThan(0)

      // Check progress structure
      const lastUpdate = progressUpdates[progressUpdates.length - 1]
      expect(lastUpdate.total).toBe(2)
      expect(lastUpdate.completed).toBe(2)
      expect(lastUpdate.failed).toBe(0)
      expect(lastUpdate.inProgress).toBe(0)
    })

    it('should handle cancellation via AbortSignal', async () => {
      const files = [
        createMockFile('doc1.pdf', 1000),
        createMockFile('doc2.pdf', 1000),
      ]

      const abortController = new AbortController()

      const options: BatchConversionOptions = {
        apiKey: 'test-api-key-12345678901234567890',
        markerOptions: {},
        signal: abortController.signal,
      }

      mockConvertPdfToMarkdown.mockImplementation(async (file, apiKey, markerOptions, onProgress, signal) => {
        // Simulate checking abort signal
        if (signal?.aborted) {
          throw new Error('Conversion cancelled')
        }

        await Promise.resolve()

        if (signal?.aborted) {
          throw new Error('Conversion cancelled')
        }

        return {
          success: true,
          markdown: '# Test',
        }
      })

      const promise = convertBatchPdfToMarkdown(files, options)

      // Cancel immediately (no delays in tests)
      abortController.abort()

      const result = await promise

      // Should have some failed conversions due to cancellation
      expect(result.success).toBe(false)
    })

    it('should retry failed conversions with exponential backoff', async () => {
      const file = createMockFile('doc.pdf', 1000)
      const options: BatchConversionOptions = {
        apiKey: 'test-api-key-12345678901234567890',
        markerOptions: {},
        maxRetries: 2, // Will attempt 3 times total (initial + 2 retries)
      }

      let attemptCount = 0

      // Fail first 2 attempts, succeed on 3rd
      mockConvertPdfToMarkdown.mockImplementation(async () => {
        attemptCount++

        if (attemptCount < 3) {
          return {
            success: false,
            error: 'Retry test',
          }
        }

        return {
          success: true,
          markdown: '# Test',
        }
      })

      const result = await convertBatchPdfToMarkdown([file], options)

      // Should attempt 3 times (initial + 2 retries) and succeed
      expect(attemptCount).toBe(3)
      expect(result.success).toBe(true)
      expect(result.completed).toHaveLength(1)
      expect(result.completed[0].attempts).toBe(3)
    })

    it('should track conversion duration', async () => {
      const file = createMockFile('doc.pdf', 1000)
      const options: BatchConversionOptions = {
        apiKey: 'test-api-key-12345678901234567890',
        markerOptions: {},
      }

      mockConvertPdfToMarkdown.mockImplementation(async () => {
        await Promise.resolve()
        return {
          success: true,
          markdown: '# Test',
        }
      })

      const result = await convertBatchPdfToMarkdown([file], options)

      expect(result.completed[0].duration).toBeDefined()
      expect(result.completed[0].duration).toBeGreaterThanOrEqual(0) // Can be 0 in tests
      expect(result.completed[0].startTime).toBeDefined()
      expect(result.completed[0].endTime).toBeDefined()
    })

    it('should return early when all conversions fail', async () => {
      const files = [
        createMockFile('doc1.pdf', 1000),
        createMockFile('doc2.pdf', 1000),
      ]

      const options: BatchConversionOptions = {
        apiKey: 'test-api-key-12345678901234567890',
        markerOptions: {},
        maxRetries: 0,
      }

      mockConvertPdfToMarkdown.mockResolvedValue({
        success: false,
        error: 'All failed',
      })

      const result = await convertBatchPdfToMarkdown(files, options)

      expect(result.success).toBe(false)
      expect(result.completed).toHaveLength(0)
      expect(result.failed).toHaveLength(2)
      expect(result.error).toBe('All conversions failed. Errors: All failed; All failed')
      expect(result.zipBlob).toBeUndefined()
    })

    it('should handle unexpected errors in conversion', async () => {
      const file = createMockFile('doc.pdf', 1000)
      const options: BatchConversionOptions = {
        apiKey: 'test-api-key-12345678901234567890',
        markerOptions: {},
        maxRetries: 0,
      }

      // Mock throwing an error
      mockConvertPdfToMarkdown.mockRejectedValue(new Error('Unexpected error'))

      const result = await convertBatchPdfToMarkdown([file], options)

      expect(result.success).toBe(false)
      expect(result.failed).toHaveLength(1)
      expect(result.failed[0].error).toBe('Unexpected error')
    })

    it('should track all files in results array', async () => {
      const files = [
        createMockFile('doc1.pdf', 1000),
        createMockFile('doc2.pdf', 1000),
        createMockFile('doc3.pdf', 1000),
      ]

      const progressUpdates: BatchProgress[] = []
      const options: BatchConversionOptions = {
        apiKey: 'test-api-key-12345678901234567890',
        markerOptions: {},
        onProgress: (progress) => progressUpdates.push({ ...progress }),
      }

      mockConvertPdfToMarkdown.mockResolvedValue({
        success: true,
        markdown: '# Test',
      })

      await convertBatchPdfToMarkdown(files, options)

      // Check progress updates include all files
      expect(progressUpdates.length).toBeGreaterThan(0)

      const lastUpdate = progressUpdates[progressUpdates.length - 1]
      expect(lastUpdate.results).toHaveLength(3)
      expect(lastUpdate.total).toBe(3)

      // All files should be either completed or failed by the end
      expect(lastUpdate.results.every(r =>
        r.status === 'complete' || r.status === 'failed'
      )).toBe(true)
    })
  })
})
