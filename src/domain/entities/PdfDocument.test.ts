/**
 * Tests for PdfDocument entity
 */

import { describe, it, expect } from 'vitest'
import { PdfDocument } from './PdfDocument'

describe('PdfDocument', () => {
  const createMockFile = (name: string, size: number, type: string = 'application/pdf'): File => {
    // Create a File with specified size using Object.defineProperty to avoid creating huge strings
    const file = new File(['content'], name, { type })
    Object.defineProperty(file, 'size', { value: size, writable: false })
    return file
  }

  describe('constructor and getters', () => {
    it('should create a PdfDocument from a File', () => {
      const file = createMockFile('test.pdf', 1024)
      const pdf = new PdfDocument(file)

      expect(pdf.getName()).toBe('test.pdf')
      expect(pdf.getSize()).toBe(1024)
      expect(pdf.getMimeType()).toBe('application/pdf')
      expect(pdf.getFile()).toBe(file)
    })

    it('should calculate size in MB', () => {
      const file = createMockFile('test.pdf', 10 * 1024 * 1024) // 10 MB
      const pdf = new PdfDocument(file)

      expect(pdf.getSizeInMB()).toBe(10)
    })
  })

  describe('validation checks', () => {
    it('should identify PDF MIME type', () => {
      const pdf = new PdfDocument(createMockFile('test.pdf', 1024))
      expect(pdf.isPdfMimeType()).toBe(true)
    })

    it('should identify non-PDF MIME type', () => {
      const pdf = new PdfDocument(createMockFile('test.txt', 1024, 'text/plain'))
      expect(pdf.isPdfMimeType()).toBe(false)
    })

    it('should identify PDF extension', () => {
      const pdf = new PdfDocument(createMockFile('test.pdf', 1024))
      expect(pdf.hasPdfExtension()).toBe(true)
    })

    it('should identify non-PDF extension', () => {
      const pdf = new PdfDocument(createMockFile('test.txt', 1024))
      expect(pdf.hasPdfExtension()).toBe(false)
    })

    it('should check if file is within size limit (default 200MB)', () => {
      const smallPdf = new PdfDocument(createMockFile('small.pdf', 100 * 1024 * 1024))
      expect(smallPdf.isWithinSizeLimit()).toBe(true)

      const largePdf = new PdfDocument(createMockFile('large.pdf', 250 * 1024 * 1024))
      expect(largePdf.isWithinSizeLimit()).toBe(false)
    })

    it('should check if file is within custom size limit', () => {
      const pdf = new PdfDocument(createMockFile('test.pdf', 50 * 1024 * 1024))
      expect(pdf.isWithinSizeLimit(100 * 1024 * 1024)).toBe(true)
      expect(pdf.isWithinSizeLimit(10 * 1024 * 1024)).toBe(false)
    })

    it('should check if file is not empty', () => {
      const pdf = new PdfDocument(createMockFile('test.pdf', 1024))
      expect(pdf.isNotEmpty()).toBe(true)

      const emptyPdf = new PdfDocument(createMockFile('empty.pdf', 0))
      expect(emptyPdf.isNotEmpty()).toBe(false)
    })
  })

  describe('validation result', () => {
    it('should start without validation', () => {
      const pdf = new PdfDocument(createMockFile('test.pdf', 1024))
      expect(pdf.hasBeenValidated()).toBe(false)
    })

    it('should throw error if checking validity before validation', () => {
      const pdf = new PdfDocument(createMockFile('test.pdf', 1024))
      expect(() => pdf.isValid()).toThrow('Document has not been validated yet')
    })

    it('should store valid validation result', () => {
      const pdf = new PdfDocument(createMockFile('test.pdf', 1024))
      pdf.setValidationResult({ valid: true, errors: [] })

      expect(pdf.hasBeenValidated()).toBe(true)
      expect(pdf.isValid()).toBe(true)
      expect(pdf.getValidationErrors()).toEqual([])
    })

    it('should store invalid validation result with errors', () => {
      const pdf = new PdfDocument(createMockFile('test.pdf', 0))
      const errors = [
        { code: 'FILE_EMPTY', message: 'File is empty', severity: 'error' as const },
      ]
      pdf.setValidationResult({ valid: false, errors })

      expect(pdf.hasBeenValidated()).toBe(true)
      expect(pdf.isValid()).toBe(false)
      expect(pdf.getValidationErrors()).toEqual(errors)
    })
  })

  describe('metadata', () => {
    it('should return a copy of metadata', () => {
      const pdf = new PdfDocument(createMockFile('test.pdf', 1024))
      const metadata1 = pdf.getMetadata()
      const metadata2 = pdf.getMetadata()

      expect(metadata1).toEqual(metadata2)
      expect(metadata1).not.toBe(metadata2) // Different references
    })
  })
})
