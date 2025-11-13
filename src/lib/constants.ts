import type { NavLink, ToolCard, MarkerOptions } from '@/types'

/**
 * Shared constants for AI Doc Prep application
 */

// File size constants - calculated once and reused
const KB = 1024
const MB = KB * 1024
const GB = MB * 1024

export const FILE_SIZE = {
  BYTES_PER_KB: KB,
  BYTES_PER_MB: MB,
  BYTES_PER_GB: GB,

  // Default limits
  MAX_FILE_SIZE: GB, // 1GB
  MAX_PDF_FILE_SIZE: 200 * MB, // 200MB - Marker API limit
  MAX_MERGE_FILES: 50,
  MAX_TOTAL_MERGE_SIZE: GB, // 1GB total
} as const

// Marker API Configuration
export const MARKER_CONFIG = {
  // Polling settings for async conversion status checks
  POLL_INTERVAL_MS: 2000, // Poll every 2 seconds
  MAX_POLL_ATTEMPTS: 150, // 5 minutes max (150 * 2 seconds = 300 seconds)

  // API URLs
  SIGN_UP_URL: 'https://www.datalab.to/app/keys',

  // Default conversion options
  DEFAULT_OPTIONS: {
    paginate: false,
    format_lines: false,
    use_llm: false,
    disable_image_extraction: false,
    output_format: 'markdown',
    langs: 'English'
  } as MarkerOptions,
} as const

// Navigation links for header
export const NAV_LINKS: readonly NavLink[] = [
  { href: '/pdf-to-markdown', label: 'PDF to Markdown', shortLabel: 'PDF' },
  { href: '/html-to-markdown', label: 'HTML to Markdown', shortLabel: 'HTML' },
  { href: '/merge-markdown', label: 'Merge Markdown', shortLabel: 'Markdown' },
  { href: '/help', label: 'Help', shortLabel: 'Help' },
  { href: '/about', label: 'About', shortLabel: 'About' },
] as const

// Tool cards for homepage
export const TOOL_CARDS: readonly ToolCard[] = [
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
] as const

// API endpoints
export const API_ENDPOINTS = {
  MARKER: '/api/marker',
} as const

// LocalStorage keys
export const STORAGE_KEYS = {
  MARKER_API_KEY: 'markerApiKey',
} as const
