import { cn } from '@/lib/utils/classNames'

/**
 * Button component with variants and loading state
 * @param {Object} props
 * @param {React.ReactNode} props.children - Button content
 * @param {Function} props.onClick - Click handler
 * @param {boolean} props.disabled - Whether button is disabled
 * @param {boolean} props.loading - Whether button is in loading state
 * @param {string} props.variant - Button variant ('primary' or 'secondary')
 * @param {string} props.type - Button type ('button', 'submit', or 'reset')
 * @param {string} props.className - Additional CSS classes
 * @param {string} props.loadingText - Custom loading text
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
}) {
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
