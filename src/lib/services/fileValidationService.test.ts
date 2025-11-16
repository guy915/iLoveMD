/**
 * Tests for FileValidationService
 */

import { describe, it, expect } from 'vitest'
import {
  filterPdfFiles,
  filterImmediateFolderFiles,
  filterMarkdownFiles,
  validateFileSize,
  validateBatchFileSize,
  validateFilesNotEmpty,
  validateFileType
} from './fileValidationService'

describe('FileValidationService', () => {
  describe('filterPdfFiles', () => {
    it('should filter out non-PDF files', () => {
      const files = [
        new File([], 'document.pdf', { type: 'application/pdf' }),
        new File([], 'image.jpg', { type: 'image/jpeg' }),
        new File([], 'text.txt', { type: 'text/plain' })
      ]

      const result = filterPdfFiles(files)

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('document.pdf')
    })

    it('should accept PDF files by extension', () => {
      const files = [
        new File([], 'document.PDF', { type: '' }),
        new File([], 'file.pdf', { type: '' })
      ]

      const result = filterPdfFiles(files)

      expect(result).toHaveLength(2)
    })

    it('should return empty array if no PDFs', () => {
      const files = [
        new File([], 'image.jpg', { type: 'image/jpeg' }),
        new File([], 'text.txt', { type: 'text/plain' })
      ]

      const result = filterPdfFiles(files)

      expect(result).toHaveLength(0)
    })
  })

  describe('filterImmediateFolderFiles', () => {
    it('should include files in immediate folder', () => {
      const file1 = new File([], 'doc1.pdf')
      Object.defineProperty(file1, 'webkitRelativePath', {
        value: 'Folder/doc1.pdf',
        writable: false
      })

      const file2 = new File([], 'doc2.pdf')
      Object.defineProperty(file2, 'webkitRelativePath', {
        value: 'Folder/doc2.pdf',
        writable: false
      })

      const result = filterImmediateFolderFiles([file1, file2])

      expect(result).toHaveLength(2)
    })

    it('should exclude files in subfolders', () => {
      const file1 = new File([], 'doc1.pdf')
      Object.defineProperty(file1, 'webkitRelativePath', {
        value: 'Folder/doc1.pdf',
        writable: false
      })

      const file2 = new File([], 'doc2.pdf')
      Object.defineProperty(file2, 'webkitRelativePath', {
        value: 'Folder/SubFolder/doc2.pdf',
        writable: false
      })

      const result = filterImmediateFolderFiles([file1, file2])

      expect(result).toHaveLength(1)
      expect(result[0]).toBe(file1)
    })

    it('should include files without webkitRelativePath', () => {
      const file = new File([], 'doc.pdf')

      const result = filterImmediateFolderFiles([file])

      expect(result).toHaveLength(1)
    })
  })

  describe('filterMarkdownFiles', () => {
    it('should filter markdown files by MIME type', () => {
      const files = [
        new File([], 'doc.md', { type: 'text/markdown' }),
        new File([], 'text.txt', { type: 'text/plain' }),
        new File([], 'image.jpg', { type: 'image/jpeg' })
      ]

      const result = filterMarkdownFiles(files)

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('doc.md')
    })

    it('should filter markdown files by extension', () => {
      const files = [
        new File([], 'doc.md', { type: '' }),
        new File([], 'readme.MD', { type: '' }),
        new File([], 'notes.markdown', { type: '' }),
        new File([], 'text.txt', { type: '' })
      ]

      const result = filterMarkdownFiles(files)

      expect(result).toHaveLength(3)
    })
  })

  describe('validateFileSize', () => {
    it('should pass for files under limit', () => {
      const file = new File(['a'.repeat(100)], 'small.pdf')
      const maxSize = 1024 // 1KB

      const result = validateFileSize(file, maxSize)

      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should fail for files over limit', () => {
      const file = new File(['a'.repeat(2000)], 'large.pdf')
      const maxSize = 1024 // 1KB

      const result = validateFileSize(file, maxSize)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('too large')
      expect(result.error).toContain('large.pdf')
    })

    it('should include size information in error', () => {
      const file = new File(['a'.repeat(2 * 1024 * 1024)], 'large.pdf')
      const maxSize = 1024 * 1024 // 1MB

      const result = validateFileSize(file, maxSize)

      expect(result.valid).toBe(false)
      expect(result.error).toMatch(/\d+\.\d+MB/)
    })
  })

  describe('validateBatchFileSize', () => {
    it('should pass for all valid files', () => {
      const files = [
        new File(['a'.repeat(100)], 'file1.pdf'),
        new File(['b'.repeat(100)], 'file2.pdf')
      ]
      const maxSize = 1024

      const result = validateBatchFileSize(files, maxSize)

      expect(result.valid).toBe(true)
      expect(result.files).toEqual(files)
    })

    it('should fail if any file exceeds limit', () => {
      const files = [
        new File(['a'.repeat(100)], 'small.pdf'),
        new File(['b'.repeat(2000)], 'large.pdf')
      ]
      const maxSize = 1024

      const result = validateBatchFileSize(files, maxSize)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('large.pdf')
      expect(result.error).toContain('1 file(s) exceed')
    })

    it('should list all oversized files', () => {
      const files = [
        new File(['a'.repeat(2000)], 'file1.pdf'),
        new File(['b'.repeat(2000)], 'file2.pdf'),
        new File(['c'.repeat(100)], 'file3.pdf')
      ]
      const maxSize = 1024

      const result = validateBatchFileSize(files, maxSize)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('2 file(s) exceed')
      expect(result.error).toContain('file1.pdf')
      expect(result.error).toContain('file2.pdf')
    })
  })

  describe('validateFilesNotEmpty', () => {
    it('should pass for non-empty array', () => {
      const files = [new File([], 'doc.pdf')]

      const result = validateFilesNotEmpty(files)

      expect(result.valid).toBe(true)
    })

    it('should fail for empty array', () => {
      const result = validateFilesNotEmpty([])

      expect(result.valid).toBe(false)
      expect(result.error).toBe('No files selected')
    })
  })

  describe('validateFileType', () => {
    it('should pass for valid MIME type', () => {
      const file = new File([], 'doc.pdf', { type: 'application/pdf' })

      const result = validateFileType(file, ['application/pdf'], ['.pdf'])

      expect(result.valid).toBe(true)
    })

    it('should pass for valid extension', () => {
      const file = new File([], 'doc.pdf', { type: '' })

      const result = validateFileType(file, ['application/pdf'], ['.pdf'])

      expect(result.valid).toBe(true)
    })

    it('should fail for invalid type and extension', () => {
      const file = new File([], 'doc.txt', { type: 'text/plain' })

      const result = validateFileType(file, ['application/pdf'], ['.pdf'])

      expect(result.valid).toBe(false)
      expect(result.error).toContain('not a valid type')
      expect(result.error).toContain('doc.txt')
    })

    it('should handle multiple allowed types', () => {
      const file = new File([], 'doc.md', { type: 'text/markdown' })

      const result = validateFileType(
        file,
        ['text/markdown', 'text/plain'],
        ['.md', '.markdown']
      )

      expect(result.valid).toBe(true)
    })

    it('should be case-insensitive for extensions', () => {
      const file = new File([], 'DOC.PDF', { type: '' })

      const result = validateFileType(file, ['application/pdf'], ['.pdf'])

      expect(result.valid).toBe(true)
    })
  })
})
