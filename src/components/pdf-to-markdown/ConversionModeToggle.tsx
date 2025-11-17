import type { ConversionMode } from '@/hooks/useConversionMode'

interface ConversionModeToggleProps {
  mode: ConversionMode
  setMode: (mode: ConversionMode) => void
  disabled?: boolean
}

/**
 * Component for toggling between free and paid conversion modes.
 * Displays mode selection buttons with visual feedback.
 */
export function ConversionModeToggle({ mode, setMode, disabled = false }: ConversionModeToggleProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Conversion Mode</h2>
      <div className="flex items-center gap-4">
        <button
          onClick={() => setMode('free')}
          disabled={disabled}
          className={`flex-1 px-6 py-3 rounded-lg font-medium transition-colors ${
            mode === 'free'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          aria-pressed={mode === 'free'}
        >
          <div className="flex flex-col items-center">
            <span className="font-semibold">Free</span>
            <span className="text-xs opacity-90">(Slow)</span>
          </div>
        </button>
        <button
          onClick={() => setMode('paid')}
          disabled={disabled}
          className={`flex-1 px-6 py-3 rounded-lg font-medium transition-colors ${
            mode === 'paid'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          aria-pressed={mode === 'paid'}
        >
          <div className="flex flex-col items-center">
            <span className="font-semibold">Paid</span>
            <span className="text-xs opacity-90">(Fast)</span>
          </div>
        </button>
      </div>
      <p className="mt-3 text-sm text-gray-600">
        {mode === 'free'
          ? 'Free cloud processing (~a few minutes per PDF)'
          : 'Marker API (~a few seconds per PDF, requires API key)'}
      </p>
    </div>
  )
}
