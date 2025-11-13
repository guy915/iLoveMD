'use client'

import { memo } from 'react'
import { cn } from '@/lib/utils/classNames'
import type { ButtonHTMLAttributes } from 'react'

/**
 * Button component props extending native button attributes
 */
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button content */
  children: React.ReactNode
  /** Whether button is in loading state */
  loading?: boolean
  /** Button variant */
  variant?: 'primary' | 'secondary'
  /** Custom loading text */
  loadingText?: string
}

// Define class constants outside component to avoid recreation on each render
const BASE_CLASSES = "px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
const PRIMARY_CLASSES = "bg-primary-600 text-white hover:bg-primary-700"
const SECONDARY_CLASSES = "bg-gray-200 text-gray-900 hover:bg-gray-300"

/**
 * Button component with variants and loading state
 * Memoized to prevent unnecessary re-renders
 */
const Button = memo(function Button({
  children,
  onClick,
  disabled,
  loading,
  variant = 'primary',
  type = 'button',
  className,
  loadingText = 'Processing...',
  ...rest
}: ButtonProps) {
  const variantClasses = variant === 'primary' ? PRIMARY_CLASSES : SECONDARY_CLASSES

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(BASE_CLASSES, variantClasses, className)}
      aria-busy={loading}
      {...rest}
    >
      {loading ? loadingText : children}
    </button>
  )
})

export default Button
