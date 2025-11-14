import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  convertBatchPdfToMarkdown,
  filterPdfFiles,
  filterImmediateFolderFiles,
  getFolderName,
  validateBatchFiles,
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

  describe('validateBatchFiles', () => {
    it('should return error for empty array', () => {
      const result = validateBatchFiles([])
      expect(result.valid).toBe(false)
      expect(result.error).toBe('No files selected')
    })

    it('should return error for null/undefined', () => {
      const result = validateBatchFiles(null as any)
      expect(result.valid).toBe(false)
      expect(result.error).toBe('No files selected')
    })

    it('should return error when too many files', () => {
      const files = Array.from({ length: FILE_SIZE.MAX_BATCH_FILES + 1 }, (_, i) =>
        createMockFile(`doc${i}.pdf`, 1000)
      )

      const result = validateBatchFiles(files)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('Too many files')
      expect(result.error).toContain(`${FILE_SIZE.MAX_BATCH_FILES}`)
    })

    it('should return error when no PDF files found', () => {
      const files = [
        createMockFile('image.jpg', 500, 'image/jpeg'),
        createMockFile('text.txt', 200, 'text/plain'),
      ]

      const result = validateBatchFiles(files)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('No PDF files found in selection')
    })

    it('should return error for oversized individual files', () => {
      const files = [
        createMockFile('small.pdf', 1000),
        createMockFile('large1.pdf', FILE_SIZE.MAX_PDF_FILE_SIZE + 1),
        createMockFile('large2.pdf', FILE_SIZE.MAX_PDF_FILE_SIZE + 1),
      ]

      const result = validateBatchFiles(files)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('exceed 200MB limit')
      expect(result.error).toContain('large1.pdf')
    })

    it('should list up to 3 oversized files', () => {
      const files = [
        createMockFile('large1.pdf', FILE_SIZE.MAX_PDF_FILE_SIZE + 1),
        createMockFile('large2.pdf', FILE_SIZE.MAX_PDF_FILE_SIZE + 1),
        createMockFile('large3.pdf', FILE_SIZE.MAX_PDF_FILE_SIZE + 1),
        createMockFile('large4.pdf', FILE_SIZE.MAX_PDF_FILE_SIZE + 1),
        createMockFile('large5.pdf', FILE_SIZE.MAX_PDF_FILE_SIZE + 1),
      ]

      const result = validateBatchFiles(files)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('large1.pdf, large2.pdf, large3.pdf')
      expect(result.error).toContain('and 2 more')
    })

    it('should return error when total batch size exceeds limit', () => {
      // Create files that individually are OK but collectively exceed limit
      // MAX_BATCH_TOTAL_SIZE is 100GB, so create files totaling 101GB
      const fileSize = FILE_SIZE.MAX_PDF_FILE_SIZE // 200MB each
      const fileCount = 550 // 550 * 200MB = 110GB > 100GB limit
      const files = Array.from({ length: fileCount }, (_, i) =>
        createMockFile(`doc${i}.pdf`, fileSize)
      )

      const result = validateBatchFiles(files)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('Total batch size')
      expect(result.error).toContain('exceeds maximum')
    })

    it('should accept valid batch', () => {
      const files = [
        createMockFile('doc1.pdf', 10 * FILE_SIZE.BYTES_PER_MB),
        createMockFile('doc2.pdf', 20 * FILE_SIZE.BYTES_PER_MB),
        createMockFile('doc3.pdf', 30 * FILE_SIZE.BYTES_PER_MB),
      ]

      const result = validateBatchFiles(files)

      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should filter non-PDF files before validation', () => {
      const files = [
        createMockFile('doc1.pdf', 10 * FILE_SIZE.BYTES_PER_MB),
        createMockFile('image.jpg', 500, 'image/jpeg'),
        createMockFile('doc2.pdf', 20 * FILE_SIZE.BYTES_PER_MB),
      ]

      const result = validateBatchFiles(files)

      expect(result.valid).toBe(true)
    })
  })

  describe('convertBatchPdfToMarkdown', () => {
    let mockConvertPdfToMarkdown: ReturnType<typeof vi.fn>

    beforeEach(() => {
      vi.useFakeTimers()
      mockConvertPdfToMarkdown = vi.mocked(convertPdfToMarkdown)
      mockConvertPdfToMarkdown.mockClear()
    })

    afterEach(() => {
      vi.restoreAllMocks()
      vi.useRealTimers()
    })

    it('should convert single file successfully', async () => {
      const file = createMockFile('doc.pdf', 1000)
      const options: BatchConversionOptions = {
        apiKey: 'test-key',
        markerOptions: {},
      }

      // Mock successful conversion
      mockConvertPdfToMarkdown.mockResolvedValue({
        success: true,
        markdown: '# Test',
      })

      // Mock JSZip
      const mockZipFile = vi.fn()
      const mockGenerateAsync = vi.fn().mockResolvedValue(new Blob(['zip content']))
      vi.doMock('jszip', () => ({
        default: vi.fn(() => ({
          file: mockZipFile,
          generateAsync: mockGenerateAsync,
        })),
      }))

      const promise = convertBatchPdfToMarkdown([file], options)

      // Run all pending timers
      await vi.runAllTimersAsync()

      const result = await promise

      expect(result.success).toBe(true)
      expect(result.completed).toHaveLength(1)
      expect(result.failed).toHaveLength(0)
      expect(result.completed[0].status).toBe('complete')
      expect(result.completed[0].markdown).toBe('# Test')
    })

    it('should handle conversion failure with retries', async () => {
      const file = createMockFile('doc.pdf', 1000)
      const options: BatchConversionOptions = {
        apiKey: 'test-key',
        markerOptions: {},
        maxRetries: 2,
      }

      // Mock failed conversions
      mockConvertPdfToMarkdown.mockResolvedValue({
        success: false,
        error: 'Conversion failed',
      })

      const promise = convertBatchPdfToMarkdown([file], options)

      // Run all timers (including retry delays)
      await vi.runAllTimersAsync()

      const result = await promise

      // Should attempt 3 times (initial + 2 retries)
      expect(mockConvertPdfToMarkdown).toHaveBeenCalledTimes(3)

      expect(result.success).toBe(false)
      expect(result.completed).toHaveLength(0)
      expect(result.failed).toHaveLength(1)
      expect(result.failed[0].status).toBe('failed')
      expect(result.failed[0].attempts).toBe(3)
      expect(result.error).toBe('All conversions failed')
    })

    it('should respect concurrency limit', async () => {
      const files = Array.from({ length: 10 }, (_, i) =>
        createMockFile(`doc${i}.pdf`, 1000)
      )

      const options: BatchConversionOptions = {
        apiKey: 'test-key',
        markerOptions: {},
        maxConcurrent: 3,
      }

      let concurrentCount = 0
      let maxConcurrent = 0

      mockConvertPdfToMarkdown.mockImplementation(async () => {
        concurrentCount++
        maxConcurrent = Math.max(maxConcurrent, concurrentCount)

        // Simulate async work
        await new Promise(resolve => setTimeout(resolve, 100))

        concurrentCount--

        return {
          success: true,
          markdown: '# Test',
        }
      })

      const promise = convertBatchPdfToMarkdown(files, options)
      await vi.runAllTimersAsync()
      await promise

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
        apiKey: 'test-key',
        markerOptions: {},
        onProgress,
      }

      mockConvertPdfToMarkdown.mockResolvedValue({
        success: true,
        markdown: '# Test',
      })

      const promise = convertBatchPdfToMarkdown(files, options)
      await vi.runAllTimersAsync()
      await promise

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
        apiKey: 'test-key',
        markerOptions: {},
        signal: abortController.signal,
      }

      mockConvertPdfToMarkdown.mockImplementation(async (file, apiKey, markerOptions, onProgress, signal) => {
        // Simulate checking abort signal
        if (signal?.aborted) {
          throw new Error('Conversion cancelled')
        }

        await new Promise(resolve => setTimeout(resolve, 100))

        if (signal?.aborted) {
          throw new Error('Conversion cancelled')
        }

        return {
          success: true,
          markdown: '# Test',
        }
      })

      const promise = convertBatchPdfToMarkdown(files, options)

      // Cancel after a short delay
      setTimeout(() => {
        abortController.abort()
      }, 50)

      await vi.runAllTimersAsync()
      const result = await promise

      // Should have some failed conversions due to cancellation
      expect(result.success).toBe(false)
    })

    it('should calculate retry delays with exponential backoff', async () => {
      const file = createMockFile('doc.pdf', 1000)
      const options: BatchConversionOptions = {
        apiKey: 'test-key',
        markerOptions: {},
        maxRetries: 3,
      }

      let attemptCount = 0
      const attemptTimestamps: number[] = []

      mockConvertPdfToMarkdown.mockImplementation(async () => {
        attemptTimestamps.push(Date.now())
        attemptCount++

        if (attemptCount < 4) {
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

      const promise = convertBatchPdfToMarkdown([file], options)
      await vi.runAllTimersAsync()
      await promise

      expect(attemptCount).toBe(4) // Initial + 3 retries

      // Check delays between attempts (should be exponential)
      if (attemptTimestamps.length >= 2) {
        const delay1 = attemptTimestamps[1] - attemptTimestamps[0]
        const delay2 = attemptTimestamps[2] - attemptTimestamps[1]

        // First delay should be ~1000ms (2^0 * 1000)
        expect(delay1).toBeGreaterThanOrEqual(MARKER_CONFIG.BATCH.RETRY_DELAY_BASE_MS)

        // Second delay should be ~2000ms (2^1 * 1000)
        expect(delay2).toBeGreaterThanOrEqual(delay1 * 1.5) // Allow some margin
      }
    })

    it('should track conversion duration', async () => {
      const file = createMockFile('doc.pdf', 1000)
      const options: BatchConversionOptions = {
        apiKey: 'test-key',
        markerOptions: {},
      }

      mockConvertPdfToMarkdown.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 500))
        return {
          success: true,
          markdown: '# Test',
        }
      })

      const promise = convertBatchPdfToMarkdown([file], options)
      await vi.runAllTimersAsync()
      const result = await promise

      expect(result.completed[0].duration).toBeDefined()
      expect(result.completed[0].duration).toBeGreaterThan(0)
      expect(result.completed[0].startTime).toBeDefined()
      expect(result.completed[0].endTime).toBeDefined()
    })

    it('should return early when all conversions fail', async () => {
      const files = [
        createMockFile('doc1.pdf', 1000),
        createMockFile('doc2.pdf', 1000),
      ]

      const options: BatchConversionOptions = {
        apiKey: 'test-key',
        markerOptions: {},
        maxRetries: 0,
      }

      mockConvertPdfToMarkdown.mockResolvedValue({
        success: false,
        error: 'All failed',
      })

      const promise = convertBatchPdfToMarkdown(files, options)
      await vi.runAllTimersAsync()
      const result = await promise

      expect(result.success).toBe(false)
      expect(result.completed).toHaveLength(0)
      expect(result.failed).toHaveLength(2)
      expect(result.error).toBe('All conversions failed')
      expect(result.zipBlob).toBeUndefined()
    })

    it('should handle unexpected errors in conversion', async () => {
      const file = createMockFile('doc.pdf', 1000)
      const options: BatchConversionOptions = {
        apiKey: 'test-key',
        markerOptions: {},
        maxRetries: 0,
      }

      // Mock throwing an error
      mockConvertPdfToMarkdown.mockRejectedValue(new Error('Unexpected error'))

      const promise = convertBatchPdfToMarkdown([file], options)
      await vi.runAllTimersAsync()
      const result = await promise

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
        apiKey: 'test-key',
        markerOptions: {},
        onProgress: (progress) => progressUpdates.push({ ...progress }),
      }

      mockConvertPdfToMarkdown.mockResolvedValue({
        success: true,
        markdown: '# Test',
      })

      const promise = convertBatchPdfToMarkdown(files, options)
      await vi.runAllTimersAsync()
      await promise

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
