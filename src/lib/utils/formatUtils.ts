/**
 * Utility functions for formatting data
 */

import { FILE_SIZE } from '@/lib/constants'

/**
 * Format bytes to a human-readable string with appropriate unit (KB, MB, GB)
 * @param bytes - Number of bytes to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string (e.g., "15.42 MB", "1.2 GB")
 * @example
 * formatFileSize(1536) // "1.50 KB"
 * formatFileSize(1048576) // "1.00 MB"
 * formatFileSize(1073741824, 1) // "1.0 GB"
 */
export function formatFileSize(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes'
  if (bytes < 0) return 'Invalid size'

  if (bytes < FILE_SIZE.BYTES_PER_KB) {
    return `${bytes} Bytes`
  }

  if (bytes < FILE_SIZE.BYTES_PER_MB) {
    return `${(bytes / FILE_SIZE.BYTES_PER_KB).toFixed(decimals)} KB`
  }

  if (bytes < FILE_SIZE.BYTES_PER_GB) {
    return `${(bytes / FILE_SIZE.BYTES_PER_MB).toFixed(decimals)} MB`
  }

  return `${(bytes / FILE_SIZE.BYTES_PER_GB).toFixed(decimals)} GB`
}

/**
 * Format bytes to MB specifically (always shows MB, even for small sizes)
 * @param bytes - Number of bytes to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string (e.g., "15.42MB")
 * @example
 * formatBytesToMB(1048576) // "1.00MB"
 * formatBytesToMB(52428800) // "50.00MB"
 */
export function formatBytesToMB(bytes: number, decimals: number = 2): string {
  return `${(bytes / FILE_SIZE.BYTES_PER_MB).toFixed(decimals)}MB`
}

/**
 * Format bytes to KB specifically (always shows KB)
 * @param bytes - Number of bytes to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string (e.g., "512.00KB")
 * @example
 * formatBytesToKB(1024) // "1.00KB"
 * formatBytesToKB(52428800) // "51200.00KB"
 */
export function formatBytesToKB(bytes: number, decimals: number = 2): string {
  return `${(bytes / FILE_SIZE.BYTES_PER_KB).toFixed(decimals)}KB`
}

/**
 * Format duration in milliseconds to human-readable string
 * @param milliseconds - Duration in milliseconds
 * @returns Formatted string (e.g., "1.5s", "125.3s")
 * @example
 * formatDuration(1500) // "1.5s"
 * formatDuration(125300) // "125.3s"
 */
export function formatDuration(milliseconds: number): string {
  return `${(milliseconds / 1000).toFixed(1)}s`
}
