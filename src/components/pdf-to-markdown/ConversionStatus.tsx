import type { BatchProgress } from '@/lib/services/batchConversionService'

interface ConversionStatusProps {
  isBatch: boolean
  processing: boolean
  status: string
  batchProgress: BatchProgress | null
  onCancel: () => void
}

/**
 * Component for displaying conversion status and progress.
 * Shows different UI for single file vs batch conversion.
 */
export function ConversionStatus({
  isBatch,
  processing,
  status,
  batchProgress,
  onCancel
}: ConversionStatusProps) {
  // Don't render if no status to show
  if (!processing && !status) {
    return null
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {processing && (
            <span className="text-blue-600 animate-spin text-2xl">⟳</span>
          )}
          <p className="text-base font-semibold text-gray-900">
            {status || 'Converting to Markdown...'}
          </p>
        </div>
        {processing && (
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
      {isBatch && batchProgress && batchProgress.failed > 0 && (
        <p className="text-sm text-red-600 ml-11 mt-2">Failed: {batchProgress.failed}</p>
      )}
    </div>
  )
}
