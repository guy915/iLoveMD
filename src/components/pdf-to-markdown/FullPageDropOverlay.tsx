interface FullPageDropOverlayProps {
  show: boolean
}

/**
 * Component for full-page drag & drop overlay.
 * Displays when user drags files over the page.
 */
export function FullPageDropOverlay({ show }: FullPageDropOverlayProps) {
  if (!show) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-blue-500 bg-opacity-20 backdrop-blur-sm flex items-center justify-center pointer-events-none"
      role="status"
      aria-live="polite"
      aria-label="Drop zone active"
    >
      <div className="bg-white rounded-2xl shadow-2xl p-12 border-4 border-dashed border-blue-500 pointer-events-none">
        <p className="text-3xl font-bold text-blue-600 mb-2">Drop PDF files here</p>
      </div>
    </div>
  )
}
