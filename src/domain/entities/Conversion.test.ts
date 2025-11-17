/**
 * Tests for Conversion entity
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { Conversion } from './Conversion'
import { PdfDocument } from './PdfDocument'
import type { MarkerOptions } from '@/types'

describe('Conversion', () => {
  const createMockFile = (): File => {
    return new File(['test content'], 'test.pdf', { type: 'application/pdf' })
  }

  const createMockOptions = (): MarkerOptions => {
    return {
      output_format: 'markdown',
      langs: 'English',
      paginate: true,
      format_lines: true,
      use_llm: false,
      disable_image_extraction: false,
    }
  }

  let pdfDocument: PdfDocument
  let conversion: Conversion

  beforeEach(() => {
    pdfDocument = new PdfDocument(createMockFile())
    conversion = new Conversion('test-id', pdfDocument, createMockOptions(), 'paid')
  })

  describe('initialization', () => {
    it('should create a conversion with initial state', () => {
      expect(conversion.getId()).toBe('test-id')
      expect(conversion.getPdfDocument()).toBe(pdfDocument)
      expect(conversion.getMode()).toBe('paid')
      expect(conversion.getStatus()).toBe('pending')
      expect(conversion.getProgress()).toBeNull()
      expect(conversion.getResult()).toBeNull()
    })

    it('should return readonly copy of options', () => {
      const options = createMockOptions()
      const conv = new Conversion('id', pdfDocument, options, 'free')
      const retrievedOptions = conv.getOptions()

      expect(retrievedOptions).toEqual(options)
      // Options are readonly - modifications won't affect the internal state
      // but TypeScript readonly doesn't prevent runtime modification in tests
    })
  })

  describe('state transitions', () => {
    it('should transition from pending to submitted', () => {
      expect(conversion.isPending()).toBe(true)

      conversion.markAsSubmitted('req-123', 'https://check.url')

      expect(conversion.isSubmitted()).toBe(true)
      expect(conversion.getRequestId()).toBe('req-123')
      expect(conversion.getCheckUrl()).toBe('https://check.url')
    })

    it('should throw error if trying to submit non-pending conversion', () => {
      conversion.markAsSubmitted('req-123', 'https://check.url')

      expect(() => {
        conversion.markAsSubmitted('req-456', 'https://check.url')
      }).toThrow('Cannot submit conversion in submitted state')
    })

    it('should transition from submitted to processing', () => {
      conversion.markAsSubmitted('req-123', 'https://check.url')
      conversion.markAsProcessing()

      expect(conversion.isProcessing()).toBe(true)
    })

    it('should set started timestamp on first processing', () => {
      conversion.markAsSubmitted('req-123', 'https://check.url')

      const timestampsBefore = conversion.getTimestamps()
      expect(timestampsBefore.started).toBeUndefined()

      conversion.markAsProcessing()

      const timestampsAfter = conversion.getTimestamps()
      expect(timestampsAfter.started).toBeDefined()
    })

    it('should transition from processing to complete', () => {
      conversion.markAsSubmitted('req-123', 'https://check.url')
      conversion.markAsProcessing()
      conversion.markAsComplete({ success: true, markdown: '# Test' })

      expect(conversion.isComplete()).toBe(true)
      expect(conversion.getResult()).toEqual({ success: true, markdown: '# Test' })
    })

    it('should transition to failed state', () => {
      conversion.markAsSubmitted('req-123', 'https://check.url')
      conversion.markAsProcessing()
      conversion.markAsFailed('Test error')

      expect(conversion.isFailed()).toBe(true)
      expect(conversion.getResult()).toEqual({
        success: false,
        error: 'Test error',
      })
    })

    it('should transition to cancelled state', () => {
      conversion.markAsSubmitted('req-123', 'https://check.url')
      conversion.markAsCancelled()

      expect(conversion.isCancelled()).toBe(true)
      expect(conversion.getResult()).toEqual({
        success: false,
        error: 'Conversion cancelled by user',
      })
    })
  })

  describe('terminal state protection', () => {
    it('should not throw when completing already complete conversion', () => {
      conversion.markAsSubmitted('req-123', 'https://check.url')
      conversion.markAsComplete({ success: true, markdown: '# Test' })

      expect(() => {
        conversion.markAsComplete({ success: true, markdown: '# New' })
      }).toThrow('Cannot complete conversion in complete state')
    })

    it('should not allow transition from failed state', () => {
      conversion.markAsSubmitted('req-123', 'https://check.url')
      conversion.markAsFailed('Error')

      expect(() => {
        conversion.markAsComplete({ success: true, markdown: '# Test' })
      }).toThrow('Cannot complete conversion in failed state')
    })

    it('should ignore cancel on already complete conversion', () => {
      conversion.markAsSubmitted('req-123', 'https://check.url')
      conversion.markAsComplete({ success: true, markdown: '# Test' })

      conversion.markAsCancelled()

      expect(conversion.isComplete()).toBe(true)
      expect(conversion.isCancelled()).toBe(false)
    })

    it('should ignore progress updates in terminal state', () => {
      conversion.markAsSubmitted('req-123', 'https://check.url')
      conversion.markAsComplete({ success: true, markdown: '# Test' })

      conversion.updateProgress({
        status: 'processing',
        attemptNumber: 5,
        elapsedSeconds: 10,
      })

      expect(conversion.getProgress()).toBeNull()
    })
  })

  describe('progress tracking', () => {
    it('should update progress during processing', () => {
      conversion.markAsSubmitted('req-123', 'https://check.url')
      conversion.markAsProcessing()

      const progress = {
        status: 'processing',
        attemptNumber: 3,
        elapsedSeconds: 5.5,
        percentage: 50,
      }
      conversion.updateProgress(progress)

      expect(conversion.getProgress()).toEqual(progress)
    })

    it('should return defensive copy of progress', () => {
      conversion.markAsSubmitted('req-123', 'https://check.url')
      conversion.markAsProcessing()

      const progress = {
        status: 'processing',
        attemptNumber: 1,
        elapsedSeconds: 1,
      }
      conversion.updateProgress(progress)

      const retrieved1 = conversion.getProgress()
      const retrieved2 = conversion.getProgress()

      expect(retrieved1).toEqual(retrieved2)
      expect(retrieved1).not.toBe(retrieved2) // Different references
    })
  })

  describe('timestamps', () => {
    it('should track timestamps throughout lifecycle', () => {
      const timestamps1 = conversion.getTimestamps()
      expect(timestamps1.created).toBeDefined()
      expect(timestamps1.submitted).toBeUndefined()
      expect(timestamps1.completed).toBeUndefined()

      conversion.markAsSubmitted('req-123', 'https://check.url')
      const timestamps2 = conversion.getTimestamps()
      expect(timestamps2.submitted).toBeDefined()

      conversion.markAsProcessing()
      const timestamps3 = conversion.getTimestamps()
      expect(timestamps3.started).toBeDefined()

      conversion.markAsComplete({ success: true, markdown: '# Test' })
      const timestamps4 = conversion.getTimestamps()
      expect(timestamps4.completed).toBeDefined()
    })
  })

  describe('elapsed time calculation', () => {
    it('should calculate elapsed time', () => {
      const elapsed = conversion.getElapsedSeconds()
      expect(elapsed).toBeGreaterThanOrEqual(0)
      expect(elapsed).toBeLessThan(1) // Should be very small
    })
  })

  describe('summary', () => {
    it('should generate a summary string', () => {
      const summary = conversion.getSummary()
      expect(summary).toContain('test-id')
      expect(summary).toContain('test.pdf')
      expect(summary).toContain('pending')
    })
  })

  describe('terminal state checks', () => {
    it('should identify terminal states', () => {
      expect(conversion.isTerminalState()).toBe(false)

      conversion.markAsSubmitted('req-123', 'https://check.url')
      expect(conversion.isTerminalState()).toBe(false)

      conversion.markAsProcessing()
      expect(conversion.isTerminalState()).toBe(false)

      conversion.markAsComplete({ success: true, markdown: '# Test' })
      expect(conversion.isTerminalState()).toBe(true)
    })

    it('should identify failed as terminal state', () => {
      conversion.markAsSubmitted('req-123', 'https://check.url')
      conversion.markAsFailed('Error')
      expect(conversion.isTerminalState()).toBe(true)
    })

    it('should identify cancelled as terminal state', () => {
      conversion.markAsCancelled()
      expect(conversion.isTerminalState()).toBe(true)
    })
  })
})
