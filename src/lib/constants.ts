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
  MAX_PDF_FILE_SIZE: 200 * MB, // 200MB - Marker API limit per file (applies to both single and batch)

  // Merge markdown limits
  MAX_MERGE_FILE_SIZE: 10 * GB, // 10GB per markdown file
  MAX_MERGE_FILES: 200, // Maximum 200 files
  MAX_TOTAL_MERGE_SIZE: 100 * GB, // 100GB total for all merged files

  // Batch processing limits
  MAX_BATCH_TOTAL_SIZE: 100 * GB, // 100GB total for entire batch
  MAX_BATCH_FILES: 10000, // Maximum 10,000 files in a batch
} as const

// Navigation links for header
export const NAV_LINKS: readonly NavLink[] = [
  { href: '/pdf-to-markdown', label: 'PDF to Markdown', shortLabel: 'PDF' },
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
    title: 'Merge Markdown',
    description: 'Combine multiple markdown files into one. Drag to reorder, customize separators, and optionally generate a table of contents.',
    href: '/merge-markdown',
  },
] as const

// API endpoints
export const API_ENDPOINTS = {
  MARKER: '/api/marker',
  MARKER_EXTERNAL: 'https://www.datalab.to/api/v1/marker',
} as const

// LocalStorage keys
export const STORAGE_KEYS = {
  MARKER_OPTIONS: 'markerOptions',
  MARKER_MODE: 'markerMode', // 'cloud' | 'local'
  GEMINI_API_KEY: 'geminiApiKey', // For local mode with LLM
} as const

// Marker API configuration
export const MARKER_CONFIG = {
  // Default options for PDF conversion
  DEFAULT_OPTIONS: {
    paginate: false,
    format_lines: false,
    use_llm: false,
    disable_image_extraction: false,
    output_format: 'markdown',
    langs: 'English'
  } as MarkerOptions,

  // Polling configuration
  POLLING: {
    INTERVAL_MS: 2000, // Poll every 2 seconds
    MAX_ATTEMPTS: 150, // 5 minutes max (150 * 2 seconds)
    TIMEOUT_DURATION_MS: 300000, // 5 minutes in milliseconds
  },

  // Batch processing configuration
  BATCH: {
    MAX_CONCURRENT: 200, // Maximum concurrent conversions (Marker API limit)
    MAX_RETRIES: 3, // Number of retry attempts for failed conversions
    RETRY_DELAY_BASE_MS: 1000, // Base delay for exponential backoff (1 second)
    RETRY_DELAY_MAX_MS: 32000, // Maximum retry delay (32 seconds)
  },

  // Validation rules
  VALIDATION: {
    MIN_API_KEY_LENGTH: 10,
    ACCEPTED_MIME_TYPES: ['application/pdf'] as const,
    ACCEPTED_EXTENSIONS: ['.pdf'] as const,
  },

  // API URLs
  SIGN_UP_URL: 'https://www.datalab.to/app/keys',
} as const
