import { useState, useEffect, useRef, useCallback } from 'react'
import { useLogs } from '@/contexts/LogContext'

interface UseFullPageDropZoneReturn {
  showDropOverlay: boolean
  handleFileDrop: (files: FileList) => void
}

interface UseFullPageDropZoneOptions {
  onFilesDropped: (files: FileList) => void
  enabled?: boolean
}

/**
 * Custom hook for managing full-page drag & drop overlay.
 * Uses document-level events to track drag state across the entire page.
 *
 * @param onFilesDropped - Callback when files are dropped on the page
 * @param enabled - Whether the drop zone is enabled (default: true)
 */
export function useFullPageDropZone({
  onFilesDropped,
  enabled = true
}: UseFullPageDropZoneOptions): UseFullPageDropZoneReturn {
  const [showDropOverlay, setShowDropOverlay] = useState(false)
  const dragCounterRef = useRef(0)
  const { addLog } = useLogs()

  const handleFileDrop = useCallback((files: FileList) => {
    onFilesDropped(files)
  }, [onFilesDropped])

  // Full-page drag handlers using document-level events
  useEffect(() => {
    if (!enabled) return

    const handlePageDragEnter = (e: DragEvent) => {
      e.preventDefault()
      dragCounterRef.current++
      if (dragCounterRef.current === 1) {
        setShowDropOverlay(true)
        addLog('info', 'Files dragged over page - showing drop overlay')
      }
    }

    const handlePageDragLeave = (e: DragEvent) => {
      e.preventDefault()
      dragCounterRef.current--
      if (dragCounterRef.current === 0) {
        setShowDropOverlay(false)
      }
    }

    const handlePageDragOver = (e: DragEvent) => {
      e.preventDefault()
    }

    const handlePageDrop = (e: DragEvent) => {
      e.preventDefault()
      dragCounterRef.current = 0
      setShowDropOverlay(false)

      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        addLog('info', `${e.dataTransfer.files.length} file(s) dropped on page`)
        handleFileDrop(e.dataTransfer.files)
      }
    }

    // Add document-level listeners
    document.addEventListener('dragenter', handlePageDragEnter)
    document.addEventListener('dragleave', handlePageDragLeave)
    document.addEventListener('dragover', handlePageDragOver)
    document.addEventListener('drop', handlePageDrop)

    return () => {
      document.removeEventListener('dragenter', handlePageDragEnter)
      document.removeEventListener('dragleave', handlePageDragLeave)
      document.removeEventListener('dragover', handlePageDragOver)
      document.removeEventListener('drop', handlePageDrop)
    }
  }, [enabled, handleFileDrop, addLog])

  return { showDropOverlay, handleFileDrop }
}
