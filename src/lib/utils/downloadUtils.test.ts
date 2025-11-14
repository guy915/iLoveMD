/**
 * Tests for downloadUtils - File download and filename utilities
 *
 * Tests cover:
 * - replaceExtension: Edge cases documented in source (dotfiles, multiple dots, no extension)
 * - downloadFile: Blob creation, DOM manipulation, cleanup, error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { downloadFile, replaceExtension } from './downloadUtils'

describe('replaceExtension', () => {
  describe('normal files with extensions', () => {
    it('should replace simple extension', () => {
      expect(replaceExtension('document.pdf', 'md')).toBe('document.md')
      expect(replaceExtension('file.txt', 'pdf')).toBe('file.pdf')
      expect(replaceExtension('image.png', 'jpg')).toBe('image.jpg')
    })

    it('should replace multi-part extensions', () => {
      expect(replaceExtension('archive.tar.gz', 'zip')).toBe('archive.tar.zip')
      expect(replaceExtension('backup.tar.bz2', 'gz')).toBe('backup.tar.gz')
    })

    it('should handle files with multiple dots in name', () => {
      expect(replaceExtension('my.file.name.pdf', 'md')).toBe('my.file.name.md')
      expect(replaceExtension('test.v2.final.docx', 'pdf')).toBe('test.v2.final.pdf')
    })
  })

  describe('dotfiles (hidden files)', () => {
    it('should append extension to single dotfile', () => {
      expect(replaceExtension('.config', 'md')).toBe('.config.md')
      expect(replaceExtension('.gitignore', 'bak')).toBe('.gitignore.bak')
      expect(replaceExtension('.env', 'local')).toBe('.env.local')
    })

    it('should append extension to double-dot prefix', () => {
      expect(replaceExtension('..config', 'md')).toBe('..config.md')
      expect(replaceExtension('...hidden', 'md')).toBe('...hidden.md')
    })

    it('should replace extension in dotfile with extension', () => {
      expect(replaceExtension('.bashrc.backup', 'old')).toBe('.bashrc.old')
      expect(replaceExtension('.vimrc.swp', 'bak')).toBe('.vimrc.bak')
    })
  })

  describe('files without extensions', () => {
    it('should append extension to filename without extension', () => {
      expect(replaceExtension('README', 'md')).toBe('README.md')
      expect(replaceExtension('Makefile', 'bak')).toBe('Makefile.bak')
      expect(replaceExtension('LICENSE', 'txt')).toBe('LICENSE.txt')
    })
  })

  describe('edge cases', () => {
    it('should handle empty string', () => {
      expect(replaceExtension('', 'md')).toBe('.md')
    })

    it('should handle single dot', () => {
      expect(replaceExtension('.', 'md')).toBe('..md')
    })

    it('should handle multiple dots only', () => {
      expect(replaceExtension('..', 'md')).toBe('...md')
      expect(replaceExtension('...', 'md')).toBe('....md')
    })

    it('should handle filename ending with dot', () => {
      expect(replaceExtension('file.', 'md')).toBe('file.md')
    })

    it('should handle very long extensions', () => {
      expect(replaceExtension('file.verylongextension', 'md')).toBe('file.md')
    })
  })

  describe('real-world scenarios', () => {
    it('should convert PDF to markdown', () => {
      expect(replaceExtension('research-paper.pdf', 'md')).toBe('research-paper.md')
      expect(replaceExtension('2023-Q4-Report.pdf', 'md')).toBe('2023-Q4-Report.md')
    })

    it('should handle versioned files', () => {
      expect(replaceExtension('doc-v1.0.pdf', 'md')).toBe('doc-v1.0.md')
      expect(replaceExtension('app-2.1.5.tar.gz', 'zip')).toBe('app-2.1.5.tar.zip')
    })

    it('should handle dates in filenames', () => {
      expect(replaceExtension('report-2024-01-15.pdf', 'md')).toBe('report-2024-01-15.md')
    })
  })
})

describe('downloadFile', () => {
  let mockLink: HTMLAnchorElement
  let createElementSpy: ReturnType<typeof vi.spyOn>
  let appendChildSpy: ReturnType<typeof vi.spyOn>
  let removeChildSpy: ReturnType<typeof vi.spyOn>
  let clickSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    // Create a real anchor element (jsdom provides it)
    mockLink = document.createElement('a')
    clickSpy = vi.spyOn(mockLink, 'click')

    createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockLink)
    appendChildSpy = vi.spyOn(document.body, 'appendChild')
    removeChildSpy = vi.spyOn(document.body, 'removeChild')

    // URL.createObjectURL and revokeObjectURL are already mocked in test setup
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('successful downloads', () => {
    it('should create blob and trigger download with string content', () => {
      const content = '# Test Markdown'
      const filename = 'test.md'

      downloadFile(content, filename)

      expect(createElementSpy).toHaveBeenCalledWith('a')
      // jsdom converts href to full URL, just check it contains the mock URL
      expect(mockLink.href).toContain('mock-object-url')
      expect(mockLink.download).toBe(filename)
      expect(appendChildSpy).toHaveBeenCalledWith(mockLink)
      expect(clickSpy).toHaveBeenCalled()
      expect(removeChildSpy).toHaveBeenCalledWith(mockLink)
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('mock-object-url')
    })

    it('should handle blob content directly', () => {
      const blob = new Blob(['content'], { type: 'text/plain' })
      const filename = 'test.txt'

      downloadFile(blob, filename)

      expect(mockLink.download).toBe(filename)
      expect(clickSpy).toHaveBeenCalled()
    })

    it('should use custom MIME type', () => {
      const content = '{"key": "value"}'
      const filename = 'data.json'

      downloadFile(content, filename, 'application/json')

      expect(clickSpy).toHaveBeenCalled()
    })

    it('should use default MIME type for markdown', () => {
      downloadFile('# Content', 'file.md')
      expect(clickSpy).toHaveBeenCalled()
    })
  })

  describe('validation errors', () => {
    it('should throw error for empty content', () => {
      expect(() => downloadFile('', 'file.md')).toThrow('Cannot download empty content')
    })

    it('should throw error for empty filename', () => {
      expect(() => downloadFile('content', '')).toThrow('Invalid filename provided')
      expect(() => downloadFile('content', '   ')).toThrow('Invalid filename provided')
    })

    it('should include filename in error message', () => {
      expect(() => downloadFile('', 'test.md')).toThrow('test.md')
    })
  })

  describe('cleanup on error', () => {
    it('should cleanup resources even if click fails', () => {
      clickSpy.mockImplementation(() => {
        throw new Error('Click failed')
      })

      expect(() => downloadFile('content', 'file.md')).toThrow()

      // Verify cleanup still happened
      expect(removeChildSpy).toHaveBeenCalled()
      expect(URL.revokeObjectURL).toHaveBeenCalled()
    })

    it('should cleanup resources even if appendChild fails', () => {
      appendChildSpy.mockImplementation(() => {
        throw new Error('DOM operation failed')
      })

      expect(() => downloadFile('content', 'file.md')).toThrow()

      // Verify revokeObjectURL still called
      expect(URL.revokeObjectURL).toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should handle blob creation errors', () => {
      // Mock Blob constructor to throw
      const OriginalBlob = global.Blob
      global.Blob = function () {
        throw new Error('Out of memory')
      } as any

      expect(() => downloadFile('large content', 'file.md')).toThrow('Out of memory')

      global.Blob = OriginalBlob
    })

    it('should handle URL.createObjectURL errors', () => {
      const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
        throw new Error('Too many URLs created')
      })

      expect(() => downloadFile('content', 'file.md')).toThrow('Too many URLs created')

      createObjectURLSpy.mockRestore()
    })

    it('should include filename in error messages', () => {
      appendChildSpy.mockImplementation(() => {
        throw new Error('DOM error')
      })

      try {
        downloadFile('content', 'important-file.md')
      } catch (error) {
        expect((error as Error).message).toContain('important-file.md')
      }
    })
  })

  describe('real-world scenarios', () => {
    it('should handle large markdown files', () => {
      const largeContent = 'x'.repeat(10 * 1024 * 1024) // 10MB
      const filename = 'large-document.md'

      downloadFile(largeContent, filename)

      expect(clickSpy).toHaveBeenCalled()
    })

    it('should handle special characters in filename', () => {
      downloadFile('content', 'file with spaces & special-chars.md')
      expect(mockLink.download).toBe('file with spaces & special-chars.md')
    })

    it('should handle unicode content', () => {
      const unicodeContent = '# 测试文档\n\nこんにちは世界 🌍'
      downloadFile(unicodeContent, 'unicode.md')
      expect(clickSpy).toHaveBeenCalled()
    })
  })
})
