/**
 * Tests for FilenameService
 */

import { describe, it, expect } from 'vitest'
import {
  generateUniqueFilename,
  generateBatchFilenames,
  wasRenamed,
  getFolderName
} from './filenameService'

describe('FilenameService', () => {
  describe('generateUniqueFilename', () => {
    it('should return original name if no conflicts', () => {
      const file = new File([], 'document.pdf')
      const existingNames = new Set<string>()

      const result = generateUniqueFilename(file, existingNames, '.md')

      expect(result).toBe('document.md')
    })

    it('should add (1) suffix if name exists', () => {
      const file = new File([], 'document.pdf')
      const existingNames = new Set(['document.md'])

      const result = generateUniqueFilename(file, existingNames, '.md')

      expect(result).toBe('document (1).md')
    })

    it('should increment suffix if multiple conflicts', () => {
      const file = new File([], 'document.pdf')
      const existingNames = new Set(['document.md', 'document (1).md', 'document (2).md'])

      const result = generateUniqueFilename(file, existingNames, '.md')

      expect(result).toBe('document (3).md')
    })

    it('should handle files with multiple dots in name', () => {
      const file = new File([], 'my.document.v2.pdf')
      const existingNames = new Set<string>()

      const result = generateUniqueFilename(file, existingNames, '.md')

      expect(result).toBe('my.document.v2.md')
    })

    it('should use custom extension', () => {
      const file = new File([], 'document.pdf')
      const existingNames = new Set<string>()

      const result = generateUniqueFilename(file, existingNames, '.txt')

      expect(result).toBe('document.txt')
    })

    it('should handle files without extension', () => {
      const file = new File([], 'document')
      const existingNames = new Set<string>()

      const result = generateUniqueFilename(file, existingNames, '.md')

      expect(result).toBe('document.md')
    })
  })

  describe('generateBatchFilenames', () => {
    it('should generate unique names for all files', () => {
      const files = [
        new File([], 'doc1.pdf'),
        new File([], 'doc2.pdf'),
        new File([], 'doc3.pdf')
      ]

      const result = generateBatchFilenames(files)

      expect(result.size).toBe(3)
      expect(result.get(files[0])).toBe('doc1.md')
      expect(result.get(files[1])).toBe('doc2.md')
      expect(result.get(files[2])).toBe('doc3.md')
    })

    it('should handle duplicate file names', () => {
      const files = [
        new File([], 'document.pdf'),
        new File([], 'document.pdf'),
        new File([], 'document.pdf')
      ]

      const result = generateBatchFilenames(files)

      expect(result.size).toBe(3)
      expect(result.get(files[0])).toBe('document.md')
      expect(result.get(files[1])).toBe('document (1).md')
      expect(result.get(files[2])).toBe('document (2).md')
    })

    it('should build upon existing map', () => {
      const file1 = new File([], 'doc1.pdf')
      const file2 = new File([], 'doc2.pdf')
      const existingMap = new Map([[file1, 'doc1.md']])

      const result = generateBatchFilenames([file2], existingMap)

      expect(result.size).toBe(2)
      expect(result.get(file1)).toBe('doc1.md')
      expect(result.get(file2)).toBe('doc2.md')
    })

    it('should not regenerate names for files already in map', () => {
      const file1 = new File([], 'document.pdf')
      const file2 = new File([], 'document.pdf')
      const existingMap = new Map([[file1, 'document.md']])

      const result = generateBatchFilenames([file1, file2], existingMap)

      expect(result.size).toBe(2)
      expect(result.get(file1)).toBe('document.md')
      expect(result.get(file2)).toBe('document (1).md')
    })

    it('should use custom extension', () => {
      const files = [new File([], 'document.pdf')]

      const result = generateBatchFilenames(files, new Map(), '.txt')

      expect(result.get(files[0])).toBe('document.txt')
    })
  })

  describe('wasRenamed', () => {
    it('should return true if file has numerical suffix', () => {
      const result = wasRenamed('document.pdf', 'document (1).md')

      expect(result).toBe(true)
    })

    it('should return false if no numerical suffix', () => {
      const result = wasRenamed('document.pdf', 'document.md')

      expect(result).toBe(false)
    })

    it('should return true for higher numbers', () => {
      const result = wasRenamed('document.pdf', 'document (42).md')

      expect(result).toBe(true)
    })

    it('should return false for different base names', () => {
      const result = wasRenamed('document.pdf', 'other (1).md')

      expect(result).toBe(false)
    })

    it('should handle files with dots in name', () => {
      const result = wasRenamed('my.document.pdf', 'my.document (1).md')

      expect(result).toBe(true)
    })
  })

  describe('getFolderName', () => {
    it('should extract folder name from webkitRelativePath', () => {
      const file = new File([], 'document.pdf')
      Object.defineProperty(file, 'webkitRelativePath', {
        value: 'MyFolder/document.pdf',
        writable: false
      })

      const result = getFolderName(file)

      expect(result).toBe('MyFolder')
    })

    it('should return null if no webkitRelativePath', () => {
      const file = new File([], 'document.pdf')

      const result = getFolderName(file)

      expect(result).toBe(null)
    })

    it('should return null if file is at root level', () => {
      const file = new File([], 'document.pdf')
      Object.defineProperty(file, 'webkitRelativePath', {
        value: 'document.pdf',
        writable: false
      })

      const result = getFolderName(file)

      expect(result).toBe(null)
    })

    it('should handle nested paths', () => {
      const file = new File([], 'document.pdf')
      Object.defineProperty(file, 'webkitRelativePath', {
        value: 'ParentFolder/SubFolder/document.pdf',
        writable: false
      })

      const result = getFolderName(file)

      expect(result).toBe('ParentFolder')
    })
  })
})
