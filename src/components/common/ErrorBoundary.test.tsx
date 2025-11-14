import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ErrorBoundary from './ErrorBoundary'

// Mock LogContext
const mockAddLog = vi.fn()
vi.mock('@/contexts/LogContext', () => ({
  useLogs: () => ({
    addLog: mockAddLog,
  }),
}))

// Component that throws an error
function ThrowError({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error message')
  }
  return <div>Normal render</div>
}

// Component that throws on mount
function ThrowOnMount() {
  throw new Error('Error on mount')
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    mockAddLog.mockClear()
    // Suppress console.error for cleaner test output
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  describe('normal rendering', () => {
    it('should render children when no error occurs', () => {
      render(
        <ErrorBoundary>
          <div>Test content</div>
        </ErrorBoundary>
      )

      expect(screen.getByText('Test content')).toBeInTheDocument()
    })

    it('should render multiple children', () => {
      render(
        <ErrorBoundary>
          <div>Child 1</div>
          <div>Child 2</div>
        </ErrorBoundary>
      )

      expect(screen.getByText('Child 1')).toBeInTheDocument()
      expect(screen.getByText('Child 2')).toBeInTheDocument()
    })

    it('should not show error UI when no error', () => {
      render(
        <ErrorBoundary>
          <div>Test content</div>
        </ErrorBoundary>
      )

      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
    })
  })

  describe('error catching', () => {
    it('should catch error and display fallback UI', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )

      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
      expect(screen.queryByText('Normal render')).not.toBeInTheDocument()
    })

    it('should display error heading', () => {
      render(
        <ErrorBoundary>
          <ThrowOnMount />
        </ErrorBoundary>
      )

      const heading = screen.getByRole('heading', { name: 'Something went wrong' })
      expect(heading).toBeInTheDocument()
      expect(heading).toHaveClass('text-red-600')
    })

    it('should display error description', () => {
      render(
        <ErrorBoundary>
          <ThrowOnMount />
        </ErrorBoundary>
      )

      expect(screen.getByText(/A React component error occurred/)).toBeInTheDocument()
      expect(screen.getByText(/error has been logged to the diagnostic panel/)).toBeInTheDocument()
    })

    it('should log error to diagnostic panel', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )

      expect(mockAddLog).toHaveBeenCalledWith('error', 'React Component Error', expect.objectContaining({
        error: expect.stringContaining('Test error message'),
        errorName: 'Error',
        errorMessage: 'Test error message',
      }))
    })

    it('should log component stack', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )

      expect(mockAddLog).toHaveBeenCalledWith('error', 'React Component Error', expect.objectContaining({
        componentStack: expect.any(String),
      }))
    })

    it('should log error stack trace', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )

      expect(mockAddLog).toHaveBeenCalledWith('error', 'React Component Error', expect.objectContaining({
        stack: expect.any(String),
      }))
    })

    it('should log timestamp', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )

      expect(mockAddLog).toHaveBeenCalledWith('error', 'React Component Error', expect.objectContaining({
        timestamp: expect.any(String),
      }))
    })
  })

  describe('error details', () => {
    it('should show collapsed error details', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )

      expect(screen.getByText('Error details')).toBeInTheDocument()
    })

    it('should have clickable error details toggle', async () => {
      const user = userEvent.setup()
      const { container } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )

      // Check that details element exists
      const details = container.querySelector('details')
      expect(details).toBeInTheDocument()

      // Check that summary is present and clickable
      const summary = screen.getByText('Error details')
      expect(summary).toBeInTheDocument()

      // Check that error content exists in pre element
      const errorPre = container.querySelector('pre')
      expect(errorPre).toBeInTheDocument()
      expect(errorPre?.textContent).toContain('Test error message')
    })

    it('should display error as string in details', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )

      const details = screen.getByText('Error details').parentElement
      expect(details).toBeInTheDocument()
    })
  })

  describe('action buttons', () => {
    it('should render Try Again button', () => {
      render(
        <ErrorBoundary>
          <ThrowOnMount />
        </ErrorBoundary>
      )

      expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument()
    })

    it('should render Go Home button', () => {
      render(
        <ErrorBoundary>
          <ThrowOnMount />
        </ErrorBoundary>
      )

      expect(screen.getByRole('button', { name: 'Go Home' })).toBeInTheDocument()
    })

    it('should have correct button styles', () => {
      render(
        <ErrorBoundary>
          <ThrowOnMount />
        </ErrorBoundary>
      )

      const tryAgainButton = screen.getByRole('button', { name: 'Try Again' })
      expect(tryAgainButton).toHaveClass('bg-blue-600')
      expect(tryAgainButton).toHaveClass('text-white')

      const goHomeButton = screen.getByRole('button', { name: 'Go Home' })
      expect(goHomeButton).toHaveClass('bg-gray-200')
      expect(goHomeButton).toHaveClass('text-gray-900')
    })
  })

  describe('UI styling', () => {
    it('should center error UI on screen', () => {
      const { container } = render(
        <ErrorBoundary>
          <ThrowOnMount />
        </ErrorBoundary>
      )

      // Check that the error UI is rendered with centering classes
      const mainContainer = container.querySelector('div.min-h-screen')
      expect(mainContainer).toBeInTheDocument()
      expect(mainContainer).toHaveClass('flex')
      expect(mainContainer).toHaveClass('items-center')
      expect(mainContainer).toHaveClass('justify-center')
    })

    it('should display error card with white background', () => {
      const { container } = render(
        <ErrorBoundary>
          <ThrowOnMount />
        </ErrorBoundary>
      )

      // Find the card container
      const errorCard = container.querySelector('div.bg-white')
      expect(errorCard).toBeInTheDocument()
      expect(errorCard).toHaveClass('rounded-lg')
      expect(errorCard).toHaveClass('shadow-lg')
    })

    it('should have proper spacing between elements', () => {
      render(
        <ErrorBoundary>
          <ThrowOnMount />
        </ErrorBoundary>
      )

      const heading = screen.getByRole('heading')
      expect(heading).toHaveClass('mb-4')

      const errorCard = screen.getByText('Something went wrong').parentElement
      expect(errorCard).toHaveClass('p-8')
    })
  })

  describe('nested errors', () => {
    it('should catch errors from deeply nested components', () => {
      function Level1() {
        return <Level2 />
      }

      function Level2() {
        return <Level3 />
      }

      function Level3() {
        throw new Error('Deep error')
      }

      render(
        <ErrorBoundary>
          <Level1 />
        </ErrorBoundary>
      )

      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    })

    it('should log nested component information', () => {
      function Parent() {
        return <Child />
      }

      function Child() {
        throw new Error('Child error')
      }

      render(
        <ErrorBoundary>
          <Parent />
        </ErrorBoundary>
      )

      expect(mockAddLog).toHaveBeenCalledWith('error', 'React Component Error', expect.objectContaining({
        componentStack: expect.stringContaining('Child'),
      }))
    })
  })

  describe('error recovery', () => {
    it('should reset error boundary and allow retry', async () => {
      const user = userEvent.setup()

      // Use a component that can control whether it throws
      let shouldThrow = true
      function ConditionalThrowComponent() {
        if (shouldThrow) {
          throw new Error('Test error')
        }
        return <div>Recovered content</div>
      }

      const { rerender } = render(
        <ErrorBoundary>
          <ConditionalThrowComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText('Something went wrong')).toBeInTheDocument()

      // Now stop throwing
      shouldThrow = false

      // Click Try Again to reset the boundary
      await user.click(screen.getByRole('button', { name: 'Try Again' }))

      // The error boundary should have reset, now render without error
      expect(screen.getByText('Recovered content')).toBeInTheDocument()
      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
    })
  })

  describe('console logging', () => {
    it('should log error to console', () => {
      const consoleSpy = vi.spyOn(console, 'error')

      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error caught by ErrorBoundary:',
        expect.any(Error),
        expect.any(Object)
      )
    })
  })

  describe('edge cases', () => {
    it('should handle error without message', () => {
      function ThrowEmptyError() {
        // eslint-disable-next-line no-throw-literal
        throw new Error()
      }

      render(
        <ErrorBoundary>
          <ThrowEmptyError />
        </ErrorBoundary>
      )

      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    })

    it('should handle string thrown as error', () => {
      function ThrowString() {
        // eslint-disable-next-line no-throw-literal
        throw 'String error'
      }

      render(
        <ErrorBoundary>
          <ThrowString />
        </ErrorBoundary>
      )

      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    })

    it('should log error even without component stack', () => {
      render(
        <ErrorBoundary>
          <ThrowOnMount />
        </ErrorBoundary>
      )

      expect(mockAddLog).toHaveBeenCalledWith('error', 'React Component Error', expect.objectContaining({
        componentStack: expect.any(String),
      }))
    })
  })
})
