import type { NavLink, ToolCard, MarkerOptions } from '@/types'

/**
 * Shared constants for iLoveLLM application
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
  { href: '/pdf-to-markdown', label: 'PDF to Markdown', shortLabel: 'PDF to Markdown' },
  { href: '/merge-markdown', label: 'Merge Markdown', shortLabel: 'Merge Markdowns' },
  { href: 'https://www.ilovepdf.com', label: 'iLovePDF', shortLabel: 'iLovePDF', external: true },
  { href: 'https://www.ilovemarkdown.com', label: 'iLoveMD', shortLabel: 'iLoveMD', external: true },
  { href: 'https://platform.openai.com/tokenizer', label: 'Token Counter', shortLabel: 'Token Counter', external: true },
] as const

// Tool cards for homepage
export const TOOL_CARDS: readonly ToolCard[] = [
  {
    title: 'PDF to Markdown',
    description: 'Convert PDF files into high-quality Markdown',
    href: '/pdf-to-markdown',
    icon: '/pdf-icon.svg',
  },
  {
    title: 'Merge Markdown',
    description: 'Combine multiple Markdown files into a single file',
    href: '/merge-markdown',
    icon: '/merge-icon.svg',
  },
] as const

// API endpoints
export const API_ENDPOINTS = {
  MARKER: '/api/marker',
  MARKER_LOCAL: '/api/marker/local', // Proxies to free Modal serverless function
  MARKER_EXTERNAL: 'https://www.datalab.to/api/v1/marker',
  // Free Marker instance (Modal.com with free GPU - $30/month credits)
  // TODO: Replace with your Modal endpoint URL after deployment
  // Get this from: modal deploy modal_app.py
  LOCAL_MARKER_INSTANCE: 'https://guybarel2006--marker-pdf-converter-create-app.modal.run',
} as const

// LocalStorage keys
export const STORAGE_KEYS = {
  MARKER_OPTIONS: 'markerOptions',
  MARKER_MODE: 'markerMode', // 'free' | 'paid' (was 'local' | 'cloud')
  GEMINI_API_KEY: 'geminiApiKey', // For free mode with LLM enhancement
  MARKER_API_KEY: 'markerApiKey', // For paid mode (Marker API)
} as const

// Marker API configuration
export const MARKER_CONFIG = {
  // Default options for PDF conversion
  DEFAULT_OPTIONS: {
    paginate: false,
    pageFormat: 'separators_only',
    format_lines: false,
    use_llm: false,
    disable_image_extraction: false,
    redo_inline_math: false,
    output_format: 'markdown',
    langs: 'English'
  } as MarkerOptions,

  // Polling configuration
  POLLING: {
    INTERVAL_MS: 2000, // Poll every 2 seconds
    MAX_ATTEMPTS: 3600, // 2 hours max (3600 * 2 seconds = 7200 seconds)
    TIMEOUT_DURATION_MS: 7200000, // 2 hours in milliseconds
    INITIAL_DELAY_MS: 1000, // Wait 1 second before first poll
  },

  // API request timeouts
  TIMEOUTS: {
    SUBMIT_REQUEST_MS: 30000, // 30 seconds for submit requests
    POLL_REQUEST_MS: 30000, // 30 seconds for poll requests
    LOCAL_SUBMIT_REQUEST_MS: 300000, // 5 minutes for local submit (Modal cold starts)
    LOCAL_POLL_REQUEST_MS: 60000, // 60 seconds for local poll requests
  },

  // Batch processing configuration
  BATCH: {
    MAX_CONCURRENT: 200, // Maximum concurrent conversions (Marker API limit)
    MAX_RETRIES: 3, // Number of retry attempts for failed conversions
    RETRY_DELAY_BASE_MS: 1000, // Base delay for exponential backoff (1 second)
    RETRY_DELAY_MAX_MS: 32000, // Maximum retry delay (32 seconds)
    STAGGER_DELAY_MS: 5000, // Delay between batch submissions to avoid rate limits (5 seconds)
    QUEUE_CHECK_INTERVAL_MS: 10, // Interval for checking queue slots (10ms)
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
