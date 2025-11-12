/**
 * Shared TypeScript type definitions for AI Doc Prep
 */

// ===== Diagnostic Logging Types =====

/**
 * Log entry type/severity
 */
export type LogType = 'info' | 'success' | 'error'

/**
 * Individual log entry in the diagnostic logging system
 */
export interface LogEntry {
  /** Unique sequential ID (persists across navigation) */
  id: number
  /** Human-readable timestamp (HH:MM:SS format) */
  timestamp: string
  /** Log type/severity */
  type: LogType
  /** Descriptive message of what happened */
  message: string
  /** Optional structured data with additional context */
  data?: Record<string, unknown> | null
}

/**
 * Logging context API
 */
export interface LogContextValue {
  /** Array of all log entries */
  logs: LogEntry[]
  /** Add a new log entry */
  addLog: (type: LogType, message: string, data?: Record<string, unknown> | null) => void
  /** Clear all logs */
  clearLogs: () => void
}

// ===== Marker API Types =====

/**
 * Marker API submission response (POST /api/marker)
 */
export interface MarkerSubmitResponse {
  success: boolean
  /** Request ID for tracking */
  request_id?: string
  /** URL to poll for status updates */
  request_check_url?: string
  /** Error message if submission failed */
  error?: string
  /** Additional error details */
  details?: Record<string, unknown>
}

/**
 * Marker API status values during polling
 */
export type MarkerStatus = 'pending' | 'processing' | 'complete' | 'error'

/**
 * Marker API poll response (GET /api/marker)
 */
export interface MarkerPollResponse {
  success: boolean
  /** Current processing status */
  status?: MarkerStatus
  /** Converted markdown content (when status is 'complete') */
  markdown?: string
  /** Error message if processing failed */
  error?: string
  /** Processing progress percentage (0-100) */
  progress?: number
}

/**
 * Marker API request options
 */
export interface MarkerOptions {
  /** Output format */
  output_format?: 'markdown' | 'json' | 'html' | 'chunks'
  /** Languages to detect (comma-separated) */
  langs?: string
  /** Add pagination markers */
  paginate?: boolean
  /** Use LLM for better extraction */
  use_llm?: boolean
  /** Force OCR even for digital PDFs */
  force_ocr?: boolean
  /** Processing mode */
  mode?: 'fast' | 'accurate'
  /** Page range to process (e.g., "1-5") */
  page_range?: string
  /** Maximum pages to process */
  max_pages?: number
}

// ===== Navigation & Constants =====

/**
 * Navigation link definition
 */
export interface NavLink {
  /** Link URL */
  href: string
  /** Full label text */
  label: string
  /** Abbreviated label for mobile */
  shortLabel: string
}

/**
 * Tool card definition for homepage
 */
export interface ToolCard {
  /** Tool title */
  title: string
  /** Tool description */
  description: string
  /** Link to tool page */
  href: string
}

// ===== File & Download Types =====

/**
 * File metadata for logging
 */
export interface FileMetadata {
  /** File name */
  name: string
  /** File size in bytes */
  size: number
  /** File MIME type */
  type: string
  /** Last modified timestamp */
  lastModified?: number
}

/**
 * Download options
 */
export interface DownloadOptions {
  /** File content */
  content: string
  /** Output filename */
  filename: string
  /** MIME type */
  mimeType?: string
}

// ===== Error Types =====

/**
 * API error response
 */
export interface ApiError {
  /** Success flag (always false for errors) */
  success: false
  /** Error message */
  error: string
  /** Additional error details */
  details?: Record<string, unknown>
  /** HTTP status code */
  status?: number
}

/**
 * Type guard to check if response is an error
 */
export function isApiError(response: unknown): response is ApiError {
  return (
    typeof response === 'object' &&
    response !== null &&
    'success' in response &&
    response.success === false &&
    'error' in response
  )
}
