'use client'

import { Component, ReactNode, ErrorInfo, useCallback } from 'react'
import { useLogs } from '@/contexts/LogContext'

/**
 * ErrorBoundary state interface
 */
interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

/**
 * ErrorBoundary class props
 */
interface ErrorBoundaryClassProps {
  children: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

/**
 * Error Boundary component to catch and handle React errors
 * Prevents entire app from crashing when a component throws an error
 * Integrates with diagnostic logging system
 *
 * Usage:
 * <ErrorBoundary>
 *   <YourComponent />
 * </ErrorBoundary>
 */
class ErrorBoundaryClass extends Component<ErrorBoundaryClassProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryClassProps) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(_error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log to diagnostic panel via callback prop
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    // Log to console for development
    console.error('Error caught by ErrorBoundary:', error, errorInfo)

    this.setState({
      error,
      errorInfo
    })
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold text-red-600 mb-4">
              Something went wrong
            </h2>
            <p className="text-gray-600 mb-4">
              A React component error occurred. The error has been logged to the diagnostic panel.
            </p>

            {this.state.error && (
              <details className="mb-4">
                <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                  Error details
                </summary>
                <pre className="mt-2 text-xs bg-gray-100 p-3 rounded overflow-auto max-h-40">
                  {this.state.error.toString()}
                  {this.state.errorInfo && this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}

            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// Functional wrapper to integrate with LogContext
interface ErrorBoundaryProps {
  children: ReactNode
}

export default function ErrorBoundary({ children }: ErrorBoundaryProps) {
  const { addLog } = useLogs()

  const handleError = useCallback((error: Error, errorInfo: ErrorInfo) => {
    addLog('error', 'React Component Error', {
      error: error?.toString(),
      errorName: error?.name,
      errorMessage: error?.message,
      componentStack: errorInfo?.componentStack?.split('\n').slice(0, 10).join('\n') || 'No component stack',
      stack: error?.stack?.split('\n').slice(0, 8).join('\n') || 'No stack trace',
      url: typeof window !== 'undefined' ? window.location.href : 'Unknown',
      timestamp: new Date().toISOString()
    })
  }, [addLog])

  return (
    <ErrorBoundaryClass onError={handleError}>
      {children}
    </ErrorBoundaryClass>
  )
}
