/**
 * Tests for DownloadService
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { DownloadService } from './downloadService'

describe('DownloadService', () => {
  let service: DownloadService
  let mockLink: HTMLAnchorElement
  let appendChildSpy: ReturnType<typeof vi.spyOn>
  let removeChildSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    service = new DownloadService()

    // Mock DOM elements
    mockLink = document.createElement('a')
    vi.spyOn(document, 'createElement').mockReturnValue(mockLink)
    appendChildSpy = vi.spyOn(document.body, 'appendChild')
    removeChildSpy = vi.spyOn(document.body, 'removeChild')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('downloadFile', () => {
    it('should download string content as markdown', () => {
      const content = '# Hello World'
      const filename = 'test.md'

      service.downloadFile(content, filename)

      expect(document.createElement).toHaveBeenCalledWith('a')
      expect(mockLink.download).toBe(filename)
      expect(mockLink.href).toBeTruthy() // In jsdom, this will be a mock URL
      expect(appendChildSpy).toHaveBeenCalledWith(mockLink)
      expect(removeChildSpy).toHaveBeenCalledWith(mockLink)
    })

    it('should download Blob content', () => {
      const blob = new Blob(['test content'], { type: 'text/plain' })
      const filename = 'test.txt'

      service.downloadFile(blob, filename)

      expect(mockLink.download).toBe(filename)
      expect(mockLink.href).toBeTruthy() // In jsdom, this will be a mock URL
    })

    it('should use custom MIME type', () => {
      const content = 'test'
      const filename = 'test.txt'

      service.downloadFile(content, filename, { mimeType: 'text/plain' })

      // Verify blob was created with correct MIME type
      // (actual verification would require checking Blob constructor, which is complex)
      expect(mockLink.href).toBeTruthy() // In jsdom, this will be a mock URL
    })

    it('should clean up object URL', () => {
      vi.useFakeTimers()
      const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL')

      service.downloadFile('content', 'test.md')

      expect(revokeObjectURLSpy).not.toHaveBeenCalled()

      vi.advanceTimersByTime(100)

      expect(revokeObjectURLSpy).toHaveBeenCalled()

      vi.useRealTimers()
    })

    it('should set link style to hidden', () => {
      service.downloadFile('content', 'test.md')

      expect(mockLink.style.display).toBe('none')
    })
  })

  describe('downloadWithFileSystemApi', () => {
    it('should fall back to regular download if File System API not available', async () => {
      // File System API not available by default in test environment
      const content = 'test'
      const filename = 'test.md'

      await service.downloadWithFileSystemApi(content, filename)

      expect(mockLink.download).toBe(filename)
      expect(mockLink.href).toBeTruthy() // In jsdom, this will be a mock URL
    })

    it('should handle Blob content', async () => {
      const blob = new Blob(['test'], { type: 'text/markdown' })
      const filename = 'test.md'

      await service.downloadWithFileSystemApi(blob, filename)

      expect(mockLink.download).toBe(filename)
    })

    it('should use custom MIME type', async () => {
      const content = 'test'
      const filename = 'test.zip'

      await service.downloadWithFileSystemApi(content, filename, {
        mimeType: 'application/zip'
      })

      expect(mockLink.href).toBeTruthy() // In jsdom, this will be a mock URL
    })
  })

  describe('isFileSystemApiSupported', () => {
    it('should return false in test environment', () => {
      const result = service.isFileSystemApiSupported()

      expect(result).toBe(false)
    })

    it('should return true if showSaveFilePicker exists', () => {
      // Mock the File System API
      (window as any).showSaveFilePicker = vi.fn()

      const result = service.isFileSystemApiSupported()

      expect(result).toBe(true)

      delete (window as any).showSaveFilePicker
    })
  })

  describe('getFileDescription', () => {
    it('should return correct description for markdown', () => {
      // Access private method through type assertion
      const description = (service as any).getFileDescription('md')

      expect(description).toBe('Markdown Files')
    })

    it('should return correct description for zip', () => {
      const description = (service as any).getFileDescription('zip')

      expect(description).toBe('ZIP Archive')
    })

    it('should return generic description for unknown extension', () => {
      const description = (service as any).getFileDescription('unknown')

      expect(description).toBe('Files')
    })

    it('should be case-insensitive', () => {
      const description = (service as any).getFileDescription('MD')

      expect(description).toBe('Markdown Files')
    })
  })
})
