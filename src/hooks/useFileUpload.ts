import { useState, useCallback } from 'react'
import { useLogs } from '@/contexts/LogContext'
import { formatFileSize } from '@/lib/utils/formatUtils'
import { FILE_SIZE } from '@/lib/constants'
import type { MarkdownFile, SortMode } from '@/types/markdown'

interface UseFileUploadReturn {
  files: MarkdownFile[]
  sortMode: SortMode
  setFiles: (files: MarkdownFile[]) => void
  setSortMode: (mode: SortMode) => void
  processFiles: (fileList: FileList | File[]) => Promise<void>
  sortFiles: (filesToSort: MarkdownFile[], mode: SortMode) => MarkdownFile[]
  removeFile: (id: string) => void
  clearAll: () => void
  toggleAlphabetical: () => void
}

/**
 * Custom hook for managing file upload, validation, and sorting.
 * Handles file processing, validation, and state management for markdown files.
 */
export function useFileUpload(): UseFileUploadReturn {
  const [files, setFiles] = useState<MarkdownFile[]>([])
  const [sortMode, setSortMode] = useState<SortMode>('none')
  const { addLog } = useLogs()

  // Sort files based on current sort mode
  const sortFiles = useCallback((filesToSort: MarkdownFile[], mode: SortMode): MarkdownFile[] => {
    if (mode === 'none') {
      // No sorting, keep current order
      return [...filesToSort]
    } else if (mode === 'alphabetical') {
      return [...filesToSort].sort((a, b) =>
        a.file.name.localeCompare(b.file.name, undefined, { sensitivity: 'base' })
      )
    } else if (mode === 'reverseAlphabetical') {
      return [...filesToSort].sort((a, b) =>
        b.file.name.localeCompare(a.file.name, undefined, { sensitivity: 'base' })
      )
    }
    return filesToSort
  }, [])

  // Read file as text with comprehensive error handling
  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      // Check for browser support
      if (typeof FileReader === 'undefined') {
        reject(new Error('FileReader API not supported in this browser'))
        return
      }

      const reader = new FileReader()

      reader.onload = (e) => {
        const content = e.target?.result as string
        if (content === null || content === undefined) {
          reject(new Error('File read resulted in empty content'))
          return
        }
        resolve(content)
      }

      reader.onerror = () => {
        const error = reader.error
        if (error) {
          // Provide specific error messages based on error type
          if (error.name === 'NotFoundError') {
            reject(new Error('File not found or no longer accessible'))
          } else if (error.name === 'SecurityError') {
            reject(new Error('Security error: Cannot read file'))
          } else if (error.name === 'NotReadableError') {
            reject(new Error('File is not readable (may be locked or corrupted)'))
          } else if (error.name === 'AbortError') {
            reject(new Error('File read was aborted'))
          } else {
            reject(new Error(`Failed to read file: ${error.message || 'Unknown error'}`))
          }
        } else {
          reject(new Error('Failed to read file: Unknown error'))
        }
      }

      reader.onabort = () => {
        reject(new Error('File read was aborted'))
      }

      // Attempt to read the file
      try {
        reader.readAsText(file)
      } catch (err) {
        reject(new Error(`Failed to start file read: ${err instanceof Error ? err.message : 'Unknown error'}`))
      }
    })
  }

  // Process files (shared logic for button upload and drag-drop)
  const processFiles = useCallback(async (fileList: FileList | File[]) => {
    const selectedFiles = Array.from(fileList)

    if (selectedFiles.length === 0) {
      return
    }

    addLog('info', `${selectedFiles.length} file(s) selected for upload`)

    const validFiles: MarkdownFile[] = []
    const errors: string[] = []

    // Calculate remaining slots and current total size
    const remainingSlots = FILE_SIZE.MAX_MERGE_FILES - files.length
    const currentTotalSize = files.reduce((sum, f) => sum + f.file.size, 0)

    // Process files in parallel
    const filePromises = selectedFiles.map(async (file, i) => {
      // Check total file count first
      if (i >= remainingSlots) {
        return { error: null } // Skip silently, will report total skipped later
      }

      // Validate file type (extension)
      const validExtensions = ['.md', '.markdown']
      const hasValidExtension = validExtensions.some(ext =>
        file.name.toLowerCase().endsWith(ext)
      )

      if (!hasValidExtension) {
        return { error: `${file.name}: Not a markdown file` }
      }

      // Validate MIME type (if available)
      const validMimeTypes = ['text/markdown', 'text/plain', 'text/x-markdown', '']
      if (file.type && !validMimeTypes.includes(file.type)) {
        return { error: `${file.name}: Invalid file type` }
      }

      // Validate individual file size
      if (file.size > FILE_SIZE.MAX_MERGE_FILE_SIZE) {
        return { error: `${file.name}: File too large (max ${formatFileSize(FILE_SIZE.MAX_MERGE_FILE_SIZE)})` }
      }

      // Read file content
      try {
        const content = await readFileAsText(file)
        return {
          fileData: {
            id: typeof crypto !== 'undefined' && crypto.randomUUID
              ? crypto.randomUUID()
              : `${file.name}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            file,
            content
          }
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        addLog('error', `${file.name}: Failed to read file - ${errorMessage}`)
        return { error: `${file.name}: Failed to read file` }
      }
    })

    const results = await Promise.all(filePromises)

    // Collect valid files and errors
    let cumulativeSize = currentTotalSize
    for (const result of results) {
      if (result.fileData) {
        // Check if adding this file would exceed total size limit
        if (cumulativeSize + result.fileData.file.size > FILE_SIZE.MAX_TOTAL_MERGE_SIZE) {
          errors.push(`${result.fileData.file.name}: Would exceed total size limit of ${formatFileSize(FILE_SIZE.MAX_TOTAL_MERGE_SIZE)}`)
          continue
        }

        validFiles.push(result.fileData)
        cumulativeSize += result.fileData.file.size
      } else if (result.error) {
        errors.push(result.error)
      }
    }

    // Add skipped files message if any
    const skippedCount = selectedFiles.length - remainingSlots
    if (skippedCount > 0) {
      errors.push(`Maximum ${FILE_SIZE.MAX_MERGE_FILES} files allowed. ${skippedCount} file(s) skipped.`)
    }

    if (validFiles.length > 0) {
      setFiles(prev => sortFiles([...prev, ...validFiles], sortMode))
      addLog('success', `${validFiles.length} file(s) added successfully`, {
        totalFiles: files.length + validFiles.length,
        totalSize: formatFileSize(cumulativeSize)
      })
    }

    if (errors.length > 0) {
      addLog('error', `${errors.length} file(s) failed validation`, { errors })
    }
  }, [files, addLog, sortFiles, sortMode])

  // Remove individual file
  const removeFile = useCallback((id: string) => {
    setFiles(prev => {
      const file = prev.find(f => f.id === id)
      if (file) {
        addLog('info', `Removed file: ${file.file.name}`)
      }
      return prev.filter(f => f.id !== id)
    })
  }, [addLog])

  // Clear all files
  const clearAll = useCallback(() => {
    if (files.length === 0) return

    addLog('info', `Cleared all ${files.length} file(s)`)
    setFiles([])
    setSortMode('none')
  }, [files.length, addLog])

  // Toggle alphabetical sorting
  const toggleAlphabetical = useCallback(() => {
    let newMode: SortMode
    if (sortMode === 'none') {
      newMode = 'alphabetical'
    } else if (sortMode === 'alphabetical') {
      newMode = 'reverseAlphabetical'
    } else {
      newMode = 'alphabetical'
    }

    setSortMode(newMode)
    setFiles(prev => sortFiles(prev, newMode))
    addLog('info', `Sort mode changed to: ${newMode}`)
  }, [sortMode, sortFiles, addLog])

  return {
    files,
    sortMode,
    setFiles,
    setSortMode,
    processFiles,
    sortFiles,
    removeFile,
    clearAll,
    toggleAlphabetical
  }
}
