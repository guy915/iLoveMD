/**
 * Shared TypeScript type definitions for iLoveLLM
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
  /**
   * Additional structured error details.
   * Populated when an error occurs (i.e., when `error` is set or `success` is false).
   * Contains diagnostic information such as error type, HTTP status codes, or keys from malformed responses.
   * Used for debugging and providing more informative feedback.
   * Sanitized to avoid exposing sensitive internal implementation details.
   */
  details?: Record<string, unknown>
}

/**
 * Page format options for paginated PDFs
 * - 'none': No page formatting (paginate must be false)
 * - 'separators_only': Add horizontal separators between pages
 * - 'with_numbers': Add page numbers and horizontal separators
 */
export type PageFormatOption = 'none' | 'separators_only' | 'with_numbers'

/**
 * Marker API request options
 */
export interface MarkerOptions {
  /** Output format (always markdown for now) */
  output_format: 'markdown'
  /** Languages to detect (always English for now) */
  langs: 'English'
  /** Add pagination markers */
  paginate: boolean
  /** Page format style (only applies when paginate is true) */
  pageFormat?: PageFormatOption
  /** Apply line formatting */
  format_lines: boolean
  /** Use LLM for better extraction */
  use_llm: boolean
  /** Disable image extraction (requires use_llm) */
  disable_image_extraction: boolean
  /** Redo inline math (Modal mode only) - reprocesses inline mathematical expressions */
  redo_inline_math?: boolean
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
  /** Whether the link is external (opens in new tab) */
  external?: boolean
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
  /** Icon path (SVG file in public folder) */
  icon: string
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
 * Standardized error codes for consistent error handling
 */
export enum ErrorCode {
  // Request/Input Errors (4xx)
  FORM_PARSE_ERROR = 'FORM_PARSE_ERROR',
  URL_PARSE_ERROR = 'URL_PARSE_ERROR',
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  FILE_EMPTY = 'FILE_EMPTY',
  MISSING_PARAMETER = 'MISSING_PARAMETER',
  INVALID_API_KEY = 'INVALID_API_KEY',
  INVALID_OPTIONS = 'INVALID_OPTIONS',

  // Network/External Service Errors (5xx)
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  NETWORK_CONNECTION = 'NETWORK_CONNECTION',
  NETWORK_DNS = 'NETWORK_DNS',
  NETWORK_UNKNOWN = 'NETWORK_UNKNOWN',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  MALFORMED_RESPONSE = 'MALFORMED_RESPONSE',

  // Resource/Memory Errors
  OUT_OF_MEMORY = 'OUT_OF_MEMORY',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  FILE_TOO_LARGE_FOR_MEMORY = 'FILE_TOO_LARGE_FOR_MEMORY',

  // File Operation Errors
  FILE_READ_ERROR = 'FILE_READ_ERROR',
  FILE_WRITE_ERROR = 'FILE_WRITE_ERROR',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_NOT_READABLE = 'FILE_NOT_READABLE',
  FILE_SECURITY_ERROR = 'FILE_SECURITY_ERROR',

  // Module/Import Errors
  MODULE_IMPORT_ERROR = 'MODULE_IMPORT_ERROR',

  // Generic/Unexpected Errors
  UNEXPECTED_ERROR = 'UNEXPECTED_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

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
  /** Standardized error code */
  code?: ErrorCode | string
}

/**
 * Conversion result from PDF to Markdown
 */
export interface ConversionResult {
  /** Whether conversion succeeded */
  success: boolean
  /** Converted markdown content (when successful) */
  markdown?: string
  /** Error message (when failed) */
  error?: string
}
