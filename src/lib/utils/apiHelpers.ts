// Shared helper functions for API route handlers

// Network error types for better error messaging
export type NetworkErrorType = 'timeout' | 'connection' | 'dns' | 'unknown'

/**
 * Identifies the type of network error for better error messaging
 * @param error - The error object to analyze
 * @returns The type of network error
 */
export function getNetworkErrorType(error: unknown): NetworkErrorType {
  // First check error instance and properties (more reliable than string matching)
  if (error && typeof error === 'object') {
    const err = error as any

    // Check for AbortError (fetch timeout)
    if (err.name === 'AbortError') {
      return 'timeout'
    }

    // Check for error codes (Node.js-style errors)
    if (typeof err.code === 'string') {
      const code = err.code.toUpperCase()
      if (code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT') {
        return 'timeout'
      }
      if (code === 'ECONNREFUSED') {
        return 'connection'
      }
      if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
        return 'dns'
      }
    }
  }

  // Fallback to string matching (less reliable but still useful)
  const errorMessage = String(error).toLowerCase()
  if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
    return 'timeout'
  }
  if (errorMessage.includes('econnrefused') || errorMessage.includes('connection refused')) {
    return 'connection'
  }
  if (errorMessage.includes('enotfound') || errorMessage.includes('dns')) {
    return 'dns'
  }
  return 'unknown'
}

/**
 * Gets a user-friendly error message based on network error type
 * @param errorType - The type of network error
 * @param isLocal - Whether this is for a local Marker instance (default: false)
 * @returns User-friendly error message
 */
export function getNetworkErrorMessage(errorType: NetworkErrorType, isLocal: boolean = false): string {
  const service = isLocal ? 'local Marker instance' : 'Marker API'

  switch (errorType) {
    case 'timeout':
      return `Request timed out. The ${service} is taking too long to respond. Please try again.`
    case 'connection':
      return isLocal
        ? 'Unable to connect to local Marker instance. Please ensure Docker is running and Marker is started on http://localhost:8000'
        : 'Unable to connect to Marker API. The service may be temporarily unavailable.'
    case 'dns':
      return `Unable to resolve ${service} hostname. Please check your ${isLocal ? 'configuration' : 'internet connection'}.`
    default:
      return `Network error occurred. Please check ${isLocal ? 'that Docker and Marker are running' : 'your internet connection'} and try again.`
  }
}

/**
 * Validates Marker API submit response structure
 * @param data - The response data to validate
 * @returns True if the data has the expected submit response structure
 */
export function isValidMarkerSubmitResponse(data: unknown): data is {
  error?: string
  message?: string
  request_id?: string
  request_check_url?: string
} {
  if (!data || typeof data !== 'object') return false
  const obj = data as Record<string, unknown>

  // At least one field should be present
  const hasExpectedFields =
    typeof obj.error === 'string' ||
    typeof obj.message === 'string' ||
    typeof obj.request_id === 'string' ||
    typeof obj.request_check_url === 'string'

  return hasExpectedFields
}

/**
 * Validates Marker API poll response structure
 * @param data - The response data to validate
 * @returns True if the data has the expected poll response structure
 */
export function isValidMarkerPollResponse(data: unknown): data is {
  error?: string
  status?: string
  markdown?: string
  progress?: number
} {
  if (!data || typeof data !== 'object') return false
  const obj = data as Record<string, unknown>

  // At least one field should be present
  const hasExpectedFields =
    typeof obj.error === 'string' ||
    typeof obj.status === 'string' ||
    typeof obj.markdown === 'string' ||
    typeof obj.progress === 'number'

  return hasExpectedFields
}

/**
 * Fetch with timeout support
 * @param url - The URL to fetch
 * @param options - Fetch options
 * @param timeoutMs - Timeout in milliseconds (default: 30000)
 * @returns Fetch response
 * @throws Error if request times out
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = 30000
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs / 1000} seconds`)
    }
    throw error
  }
}
