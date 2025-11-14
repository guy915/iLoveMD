/**
 * Tests for formatUtils - File size and duration formatting utilities
 *
 * Tests cover:
 * - formatFileSize: All units (Bytes, KB, MB, GB), edge cases, boundaries
 * - formatBytesToMB: Precision, negative values, zero
 * - formatBytesToKB: Precision, negative values, zero
 * - formatDuration: Various durations, negative values, precision
 */

import { describe, it, expect } from 'vitest'
import {
  formatFileSize,
  formatBytesToMB,
  formatBytesToKB,
  formatDuration,
} from './formatUtils'
import { FILE_SIZE } from '@/lib/constants'

describe('formatFileSize', () => {
  describe('edge cases', () => {
    it('should format 0 bytes', () => {
      expect(formatFileSize(0)).toBe('0 Bytes')
    })

    it('should handle negative values', () => {
      expect(formatFileSize(-1)).toBe('Invalid size')
      expect(formatFileSize(-1024)).toBe('Invalid size')
      expect(formatFileSize(-1048576)).toBe('Invalid size')
    })
  })

  describe('bytes (< 1 KB)', () => {
    it('should format 1 byte', () => {
      expect(formatFileSize(1)).toBe('1 Bytes')
    })

    it('should format small byte values', () => {
      expect(formatFileSize(512)).toBe('512 Bytes')
      expect(formatFileSize(1023)).toBe('1023 Bytes')
    })
  })

  describe('kilobytes (1 KB - 1 MB)', () => {
    it('should format exactly 1 KB', () => {
      expect(formatFileSize(FILE_SIZE.BYTES_PER_KB)).toBe('1.00 KB')
    })

    it('should format KB values with default 2 decimal places', () => {
      expect(formatFileSize(1536)).toBe('1.50 KB')
      expect(formatFileSize(2048)).toBe('2.00 KB')
      expect(formatFileSize(52428)).toBe('51.20 KB')
    })

    it('should format KB with custom decimal places', () => {
      expect(formatFileSize(1536, 0)).toBe('2 KB')
      expect(formatFileSize(1536, 1)).toBe('1.5 KB')
      expect(formatFileSize(1536, 3)).toBe('1.500 KB')
    })

    it('should format just below 1 MB threshold', () => {
      expect(formatFileSize(FILE_SIZE.BYTES_PER_MB - 1)).toBe('1024.00 KB')
    })
  })

  describe('megabytes (1 MB - 1 GB)', () => {
    it('should format exactly 1 MB', () => {
      expect(formatFileSize(FILE_SIZE.BYTES_PER_MB)).toBe('1.00 MB')
    })

    it('should format MB values with default 2 decimal places', () => {
      expect(formatFileSize(1048576)).toBe('1.00 MB')
      expect(formatFileSize(52428800)).toBe('50.00 MB')
      expect(formatFileSize(157286400)).toBe('150.00 MB')
    })

    it('should format MB with custom decimal places', () => {
      expect(formatFileSize(1572864, 0)).toBe('2 MB')
      expect(formatFileSize(1572864, 1)).toBe('1.5 MB')
      expect(formatFileSize(1572864, 3)).toBe('1.500 MB')
    })

    it('should format just below 1 GB threshold', () => {
      expect(formatFileSize(FILE_SIZE.BYTES_PER_GB - 1)).toBe('1024.00 MB')
    })

    it('should format common PDF sizes', () => {
      // 200MB - Marker API limit
      expect(formatFileSize(200 * FILE_SIZE.BYTES_PER_MB)).toBe('200.00 MB')
    })
  })

  describe('gigabytes (>= 1 GB)', () => {
    it('should format exactly 1 GB', () => {
      expect(formatFileSize(FILE_SIZE.BYTES_PER_GB)).toBe('1.00 GB')
    })

    it('should format GB values with default 2 decimal places', () => {
      expect(formatFileSize(FILE_SIZE.BYTES_PER_GB * 2)).toBe('2.00 GB')
      expect(formatFileSize(FILE_SIZE.BYTES_PER_GB * 10)).toBe('10.00 GB')
      expect(formatFileSize(FILE_SIZE.BYTES_PER_GB * 100)).toBe('100.00 GB')
    })

    it('should format GB with custom decimal places', () => {
      const onePointFiveGB = FILE_SIZE.BYTES_PER_GB + FILE_SIZE.BYTES_PER_GB / 2
      expect(formatFileSize(onePointFiveGB, 0)).toBe('2 GB')
      expect(formatFileSize(onePointFiveGB, 1)).toBe('1.5 GB')
      expect(formatFileSize(onePointFiveGB, 3)).toBe('1.500 GB')
    })

    it('should format large batch sizes', () => {
      // 100GB - batch limit
      expect(formatFileSize(100 * FILE_SIZE.BYTES_PER_GB)).toBe('100.00 GB')
    })
  })

  describe('boundary testing', () => {
    it('should correctly format values at unit boundaries', () => {
      // Just below KB threshold
      expect(formatFileSize(FILE_SIZE.BYTES_PER_KB - 1)).toBe('1023 Bytes')
      // At KB threshold
      expect(formatFileSize(FILE_SIZE.BYTES_PER_KB)).toBe('1.00 KB')
      // Just above KB threshold
      expect(formatFileSize(FILE_SIZE.BYTES_PER_KB + 1)).toBe('1.00 KB')

      // Just below MB threshold
      expect(formatFileSize(FILE_SIZE.BYTES_PER_MB - 1)).toBe('1024.00 KB')
      // At MB threshold
      expect(formatFileSize(FILE_SIZE.BYTES_PER_MB)).toBe('1.00 MB')
      // Just above MB threshold
      expect(formatFileSize(FILE_SIZE.BYTES_PER_MB + 1)).toBe('1.00 MB')

      // Just below GB threshold
      expect(formatFileSize(FILE_SIZE.BYTES_PER_GB - 1)).toBe('1024.00 MB')
      // At GB threshold
      expect(formatFileSize(FILE_SIZE.BYTES_PER_GB)).toBe('1.00 GB')
      // Just above GB threshold
      expect(formatFileSize(FILE_SIZE.BYTES_PER_GB + 1)).toBe('1.00 GB')
    })
  })
})

describe('formatBytesToMB', () => {
  it('should always format as MB regardless of size', () => {
    expect(formatBytesToMB(0)).toBe('0.00MB')
    expect(formatBytesToMB(1024)).toBe('0.00MB')
    expect(formatBytesToMB(FILE_SIZE.BYTES_PER_MB)).toBe('1.00MB')
    expect(formatBytesToMB(FILE_SIZE.BYTES_PER_GB)).toBe('1024.00MB')
  })

  it('should format with default 2 decimal places', () => {
    expect(formatBytesToMB(52428800)).toBe('50.00MB')
    expect(formatBytesToMB(157286400)).toBe('150.00MB')
  })

  it('should format with custom decimal places', () => {
    expect(formatBytesToMB(52428800, 0)).toBe('50MB')
    expect(formatBytesToMB(52428800, 1)).toBe('50.0MB')
    expect(formatBytesToMB(52428800, 3)).toBe('50.000MB')
  })

  it('should handle negative values', () => {
    expect(formatBytesToMB(-1)).toBe('Invalid size')
    expect(formatBytesToMB(-1048576)).toBe('Invalid size')
  })

  it('should format common file sizes', () => {
    // 200MB - Marker API limit
    expect(formatBytesToMB(200 * FILE_SIZE.BYTES_PER_MB)).toBe('200.00MB')
    // 1.5MB - small PDF
    expect(formatBytesToMB(1.5 * FILE_SIZE.BYTES_PER_MB)).toBe('1.50MB')
  })
})

describe('formatBytesToKB', () => {
  it('should always format as KB regardless of size', () => {
    expect(formatBytesToKB(0)).toBe('0.00KB')
    expect(formatBytesToKB(512)).toBe('0.50KB')
    expect(formatBytesToKB(FILE_SIZE.BYTES_PER_KB)).toBe('1.00KB')
    expect(formatBytesToKB(FILE_SIZE.BYTES_PER_MB)).toBe('1024.00KB')
    expect(formatBytesToKB(FILE_SIZE.BYTES_PER_GB)).toBe('1048576.00KB')
  })

  it('should format with default 2 decimal places', () => {
    expect(formatBytesToKB(1024)).toBe('1.00KB')
    expect(formatBytesToKB(2048)).toBe('2.00KB')
  })

  it('should format with custom decimal places', () => {
    expect(formatBytesToKB(1536, 0)).toBe('2KB')
    expect(formatBytesToKB(1536, 1)).toBe('1.5KB')
    expect(formatBytesToKB(1536, 3)).toBe('1.500KB')
  })

  it('should handle negative values', () => {
    expect(formatBytesToKB(-1)).toBe('Invalid size')
    expect(formatBytesToKB(-1024)).toBe('Invalid size')
  })
})

describe('formatDuration', () => {
  it('should format milliseconds to seconds', () => {
    expect(formatDuration(1000)).toBe('1.0s')
    expect(formatDuration(2000)).toBe('2.0s')
    expect(formatDuration(10000)).toBe('10.0s')
  })

  it('should format with one decimal place', () => {
    expect(formatDuration(1500)).toBe('1.5s')
    expect(formatDuration(2750)).toBe('2.8s') // Rounds to 2.8
    expect(formatDuration(125300)).toBe('125.3s')
  })

  it('should handle zero duration', () => {
    expect(formatDuration(0)).toBe('0.0s')
  })

  it('should handle very small durations', () => {
    expect(formatDuration(100)).toBe('0.1s')
    expect(formatDuration(50)).toBe('0.1s') // Rounds to 0.1
    expect(formatDuration(1)).toBe('0.0s')
  })

  it('should handle large durations', () => {
    expect(formatDuration(60000)).toBe('60.0s') // 1 minute
    expect(formatDuration(300000)).toBe('300.0s') // 5 minutes (polling timeout)
  })

  it('should handle negative values', () => {
    expect(formatDuration(-1)).toBe('Invalid duration')
    expect(formatDuration(-1000)).toBe('Invalid duration')
  })

  it('should format realistic conversion times', () => {
    // Quick conversion
    expect(formatDuration(5000)).toBe('5.0s')
    // Average conversion
    expect(formatDuration(30000)).toBe('30.0s')
    // Long conversion
    expect(formatDuration(120000)).toBe('120.0s')
  })
})
