import { useState, useRef, useCallback, DragEvent } from 'react'
import { useLogs } from '@/contexts/LogContext'
import type { MarkdownFile } from '@/types/markdown'

interface UseFileDragAndDropReturn {
  draggedFileId: string | null
  dragOverFileId: string | null
  handleFileDragStart: (e: DragEvent<HTMLDivElement>, fileId: string, files: MarkdownFile[]) => void
  handleFileDragOver: (e: DragEvent<HTMLDivElement>, fileId: string, files: MarkdownFile[], onReorder: (newFiles: MarkdownFile[]) => void) => void
  handleFileDragEnter: (e: DragEvent<HTMLDivElement>, fileId: string) => void
  handleFileDragLeave: (e: DragEvent<HTMLDivElement>) => void
  handleFileDrop: (e: DragEvent<HTMLDivElement>, dropTargetId: string, files: MarkdownFile[]) => void
  handleFileDragEnd: () => void
}

/**
 * Custom hook for managing file drag-and-drop reordering.
 * Handles drag state, visual feedback, and reordering logic.
 */
export function useFileDragAndDrop(): UseFileDragAndDropReturn {
  const [draggedFileId, setDraggedFileId] = useState<string | null>(null)
  const [dragOverFileId, setDragOverFileId] = useState<string | null>(null)
  const draggedIndexRef = useRef<number | null>(null)
  const { addLog } = useLogs()

  const handleFileDragStart = useCallback((e: DragEvent<HTMLDivElement>, fileId: string, files: MarkdownFile[]) => {
    const draggedIndex = files.findIndex(f => f.id === fileId)
    draggedIndexRef.current = draggedIndex
    setDraggedFileId(fileId)
    e.dataTransfer.effectAllowed = 'move'
    // Set a custom data type to differentiate from file upload drags
    e.dataTransfer.setData('application/x-file-reorder', fileId)
    addLog('info', 'Started dragging file for reordering', {
      fileName: files[draggedIndex]?.file.name
    })
  }, [addLog])

  const handleFileDragOver = useCallback((
    e: DragEvent<HTMLDivElement>,
    fileId: string,
    files: MarkdownFile[],
    onReorder: (newFiles: MarkdownFile[]) => void
  ) => {
    // Only allow drop if we're reordering (not uploading files)
    if (e.dataTransfer.types.includes('application/x-file-reorder')) {
      e.preventDefault()
      e.stopPropagation()

      if (!draggedFileId || draggedFileId === fileId) return

      // Reorder in real-time for smooth shuffling animation
      const draggedIndex = files.findIndex(f => f.id === draggedFileId)
      const targetIndex = files.findIndex(f => f.id === fileId)

      if (draggedIndex === -1 || targetIndex === -1) return
      if (draggedIndex === targetIndex) return

      // Only reorder if we're moving to a new position
      const newFiles = [...files]
      const [draggedFile] = newFiles.splice(draggedIndex, 1)
      newFiles.splice(targetIndex, 0, draggedFile)

      onReorder(newFiles)
      setDragOverFileId(fileId)
    }
  }, [draggedFileId])

  const handleFileDragEnter = useCallback((e: DragEvent<HTMLDivElement>, fileId: string) => {
    if (e.dataTransfer.types.includes('application/x-file-reorder')) {
      setDragOverFileId(fileId)
    }
  }, [])

  const handleFileDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    // Only clear if we're leaving the card entirely, not moving to a child element
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverFileId(null)
    }
  }, [])

  const handleFileDrop = useCallback((e: DragEvent<HTMLDivElement>, dropTargetId: string, files: MarkdownFile[]) => {
    e.preventDefault()
    e.stopPropagation()

    if (draggedFileId && draggedIndexRef.current !== null) {
      const finalIndex = files.findIndex(f => f.id === draggedFileId)
      const draggedFile = files[finalIndex]

      // Log the final reorder (only if position actually changed)
      if (draggedIndexRef.current !== finalIndex && draggedFile) {
        addLog('info', 'Reordered files', {
          from: draggedFile.file.name,
          fromPosition: draggedIndexRef.current + 1,
          toPosition: finalIndex + 1
        })
      }
    }

    // Clean up
    setDraggedFileId(null)
    setDragOverFileId(null)
    draggedIndexRef.current = null
  }, [draggedFileId, addLog])

  const handleFileDragEnd = useCallback(() => {
    setDraggedFileId(null)
    setDragOverFileId(null)
    draggedIndexRef.current = null
  }, [])

  return {
    draggedFileId,
    dragOverFileId,
    handleFileDragStart,
    handleFileDragOver,
    handleFileDragEnter,
    handleFileDragLeave,
    handleFileDrop,
    handleFileDragEnd
  }
}
