import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Button from './Button'

describe('Button', () => {
  describe('rendering', () => {
    it('should render with children text', () => {
      render(<Button>Click me</Button>)
      expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
    })

    it('should render as primary variant by default', () => {
      render(<Button>Click me</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('bg-primary-600')
      expect(button).toHaveClass('text-white')
    })

    it('should render as secondary variant when specified', () => {
      render(<Button variant="secondary">Click me</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('bg-gray-200')
      expect(button).toHaveClass('text-gray-900')
    })

    it('should render with custom className', () => {
      render(<Button className="custom-class">Click me</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('custom-class')
      expect(button).toHaveClass('px-6') // Should still have base classes
    })

    it('should render with type button by default', () => {
      render(<Button>Click me</Button>)
      expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
    })

    it('should render with custom type', () => {
      render(<Button type="submit">Submit</Button>)
      expect(screen.getByRole('button')).toHaveAttribute('type', 'submit')
    })

    it('should forward additional props to button element', () => {
      render(<Button data-testid="test-button" aria-label="Custom label">Click me</Button>)
      const button = screen.getByTestId('test-button')
      expect(button).toHaveAttribute('aria-label', 'Custom label')
    })
  })

  describe('loading state', () => {
    it('should display loading text when loading', () => {
      render(<Button loading>Click me</Button>)
      expect(screen.getByRole('button', { name: 'Processing...' })).toBeInTheDocument()
      expect(screen.queryByText('Click me')).not.toBeInTheDocument()
    })

    it('should display custom loading text', () => {
      render(<Button loading loadingText="Saving...">Click me</Button>)
      expect(screen.getByRole('button', { name: 'Saving...' })).toBeInTheDocument()
    })

    it('should be disabled when loading', () => {
      render(<Button loading>Click me</Button>)
      expect(screen.getByRole('button')).toBeDisabled()
    })

    it('should have aria-busy attribute when loading', () => {
      render(<Button loading>Click me</Button>)
      expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true')
    })

    it('should not have aria-busy=true when not loading', () => {
      render(<Button>Click me</Button>)
      const button = screen.getByRole('button')
      // When loading is not set or false, aria-busy should be false
      expect(button).not.toHaveAttribute('aria-busy', 'true')
    })
  })

  describe('disabled state', () => {
    it('should be disabled when disabled prop is true', () => {
      render(<Button disabled>Click me</Button>)
      expect(screen.getByRole('button')).toBeDisabled()
    })

    it('should have disabled opacity class when disabled', () => {
      render(<Button disabled>Click me</Button>)
      expect(screen.getByRole('button')).toHaveClass('disabled:opacity-50')
    })

    it('should have disabled cursor class when disabled', () => {
      render(<Button disabled>Click me</Button>)
      expect(screen.getByRole('button')).toHaveClass('disabled:cursor-not-allowed')
    })

    it('should be disabled when both disabled and loading are true', () => {
      render(<Button disabled loading>Click me</Button>)
      expect(screen.getByRole('button')).toBeDisabled()
    })
  })

  describe('interactions', () => {
    it('should call onClick when clicked', async () => {
      const user = userEvent.setup()
      const onClick = vi.fn()
      render(<Button onClick={onClick}>Click me</Button>)

      await user.click(screen.getByRole('button'))

      expect(onClick).toHaveBeenCalledTimes(1)
    })

    it('should not call onClick when disabled', async () => {
      const user = userEvent.setup()
      const onClick = vi.fn()
      render(<Button onClick={onClick} disabled>Click me</Button>)

      await user.click(screen.getByRole('button'))

      expect(onClick).not.toHaveBeenCalled()
    })

    it('should not call onClick when loading', async () => {
      const user = userEvent.setup()
      const onClick = vi.fn()
      render(<Button onClick={onClick} loading>Click me</Button>)

      await user.click(screen.getByRole('button'))

      expect(onClick).not.toHaveBeenCalled()
    })

    it('should be clickable with keyboard', async () => {
      const user = userEvent.setup()
      const onClick = vi.fn()
      render(<Button onClick={onClick}>Click me</Button>)

      const button = screen.getByRole('button')
      button.focus()
      await user.keyboard('{Enter}')

      expect(onClick).toHaveBeenCalledTimes(1)
    })
  })

  describe('variants', () => {
    it('should apply primary variant classes', () => {
      render(<Button variant="primary">Primary</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('bg-primary-600')
      expect(button).toHaveClass('hover:bg-primary-700')
    })

    it('should apply secondary variant classes', () => {
      render(<Button variant="secondary">Secondary</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('bg-gray-200')
      expect(button).toHaveClass('hover:bg-gray-300')
    })
  })

  describe('base styles', () => {
    it('should always have base classes', () => {
      render(<Button>Click me</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('px-6')
      expect(button).toHaveClass('py-3')
      expect(button).toHaveClass('rounded-lg')
      expect(button).toHaveClass('font-medium')
      expect(button).toHaveClass('transition-colors')
    })
  })

  describe('memoization', () => {
    it('should render correctly after re-render with same props', () => {
      const { rerender } = render(<Button>Click me</Button>)
      expect(screen.getByRole('button')).toBeInTheDocument()

      rerender(<Button>Click me</Button>)
      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('should update when props change', () => {
      const { rerender } = render(<Button>Original</Button>)
      expect(screen.getByRole('button', { name: 'Original' })).toBeInTheDocument()

      rerender(<Button>Updated</Button>)
      expect(screen.getByRole('button', { name: 'Updated' })).toBeInTheDocument()
    })

    it('should update loading state', () => {
      const { rerender } = render(<Button loading={false}>Click me</Button>)
      expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()

      rerender(<Button loading={true}>Click me</Button>)
      expect(screen.getByRole('button', { name: 'Processing...' })).toBeInTheDocument()
    })
  })
})
