export default function Button({
  children,
  onClick,
  disabled,
  loading,
  variant = 'primary'
}) {
  const baseClasses = "px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
  const variantClasses = variant === 'primary'
    ? "bg-primary-600 text-white hover:bg-primary-700"
    : "bg-gray-200 text-gray-900 hover:bg-gray-300"

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseClasses} ${variantClasses}`}
    >
      {loading ? 'Processing...' : children}
    </button>
  )
}
