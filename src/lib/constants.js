/**
 * Shared constants for AI Doc Prep application
 */

// File size constants
export const FILE_SIZE = {
  BYTES_PER_KB: 1024,
  BYTES_PER_MB: 1024 * 1024,
  BYTES_PER_GB: 1024 * 1024 * 1024,

  // Default limits
  MAX_FILE_SIZE: 1024 * 1024 * 1024, // 1GB
  MAX_MERGE_FILES: 50,
  MAX_TOTAL_MERGE_SIZE: 1024 * 1024 * 1024, // 1GB total
}

// Navigation links for header
export const NAV_LINKS = [
  { href: '/pdf-to-markdown', label: 'PDF to Markdown' },
  { href: '/html-to-markdown', label: 'HTML to Markdown' },
  { href: '/merge-markdown', label: 'Merge Markdown' },
  { href: '/help', label: 'Help' },
  { href: '/about', label: 'About' },
]

// Tool cards for homepage
export const TOOL_CARDS = [
  {
    title: 'PDF to Markdown',
    description: 'Convert PDF documents to clean, LLM-optimized markdown using Marker AI. Supports complex layouts, tables, equations, and optional OCR for scanned documents.',
    href: '/pdf-to-markdown',
  },
  {
    title: 'HTML to Markdown',
    description: 'Convert HTML files or web pages to markdown. Upload files or paste URLs for instant conversion, all processed in your browser for privacy.',
    href: '/html-to-markdown',
  },
  {
    title: 'Merge Markdown',
    description: 'Combine multiple markdown files into one. Drag to reorder, customize separators, and optionally generate a table of contents.',
    href: '/merge-markdown',
  },
]

// API endpoints
export const API_ENDPOINTS = {
  MARKER: '/api/marker',
  FETCH_URL: '/api/fetch-url',
}

// LocalStorage keys
export const STORAGE_KEYS = {
  MARKER_API_KEY: 'markerApiKey',
  PDF_OPTIONS: 'pdfOptions',
  HTML_OPTIONS: 'htmlOptions',
  MERGE_OPTIONS: 'mergeOptions',
}

// Error messages
export const ERROR_MESSAGES = {
  FILE_TOO_LARGE: (maxSizeMB) => `File too large. Maximum size: ${maxSizeMB}MB`,
  INVALID_FILE_TYPE: (acceptedTypes) => `Invalid file type. Accepted: ${acceptedTypes}`,
  NO_FILE_SELECTED: 'Please select a file',
  API_KEY_REQUIRED: 'API key is required',
  NETWORK_ERROR: 'Network error. Please check your connection and try again.',
  PROCESSING_ERROR: 'An error occurred during processing. Please try again.',
}

// Success messages
export const SUCCESS_MESSAGES = {
  FILE_CONVERTED: 'File converted successfully',
  FILES_MERGED: 'Files merged successfully',
  SETTINGS_SAVED: 'Settings saved',
}

/**
 * Format bytes to human-readable size
 * @param {number} bytes - Number of bytes
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted size string
 */
export function formatFileSize(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes'

  const k = FILE_SIZE.BYTES_PER_KB
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}
