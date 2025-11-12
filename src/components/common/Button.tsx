'use client'

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

/**
 * Button component with variants and loading state
 */
export default function Button({
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
  const baseClasses = "px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
  const variantClasses = variant === 'primary'
    ? "bg-primary-600 text-white hover:bg-primary-700"
    : "bg-gray-200 text-gray-900 hover:bg-gray-300"

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(baseClasses, variantClasses, className)}
      aria-busy={loading}
      {...rest}
    >
      {loading ? loadingText : children}
    </button>
  )
}
