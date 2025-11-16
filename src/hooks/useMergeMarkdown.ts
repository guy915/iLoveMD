/**
 * Custom hook for managing markdown file merging workflow
 * Extracts merge business logic from components
 */

import { useState, useCallback } from 'react'
import { useLogs } from '@/contexts/LogContext'
import { formatFileSize } from '@/lib/utils/formatUtils'
import { FILE_SIZE } from '@/lib/constants'

export type SeparatorStyle = 'none' | 'page-break'
export type SortMode = 'none' | 'alphabetical' | 'reverseAlphabetical'

export interface MarkdownFile {
  id: string
  file: File
  content: string
}

export interface UseMergeMarkdownOptions {
  /** Initial separator style */
  initialSeparatorStyle?: SeparatorStyle
  /** Whether to add headers initially */
  initialAddHeaders?: boolean
  /** Initial sort mode */
  initialSortMode?: SortMode
}

export interface MergeOptions {
  /** Separator style between files */
  separatorStyle: SeparatorStyle
  /** Whether to add filename headers */
  addHeaders: boolean
}

export interface MergeState {
  /** Selected markdown files */
  files: MarkdownFile[]
  /** Separator style */
  separatorStyle: SeparatorStyle
  /** Whether to add headers */
  addHeaders: boolean
  /** Current sort mode */
  sortMode: SortMode
}

export interface UseMergeMarkdownReturn extends MergeState {
  /** Add files to the list */
  addFiles: (fileList: FileList | File[]) => Promise<{ success: boolean; added: number; errors: string[] }>
  /** Remove a file by ID */
  removeFile: (id: string) => void
  /** Clear all files */
  clearFiles: () => void
  /** Merge files into single markdown string */
  mergeFiles: () => string
  /** Reorder files */
  reorderFiles: (newOrder: MarkdownFile[]) => void
  /** Set separator style */
  setSeparatorStyle: (style: SeparatorStyle) => void
  /** Set add headers option */
  setAddHeaders: (add: boolean) => void
  /** Set sort mode */
  setSortMode: (mode: SortMode) => void
}

/**
 * Reads a file as text
 */
async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}

/**
 * Hook for managing markdown file merging
 *
 * @example
 * const {
 *   files,
 *   addFiles,
 *   mergeFiles,
 *   separatorStyle,
 *   setSeparatorStyle
 * } = useMergeMarkdown({
 *   initialSeparatorStyle: 'page-break',
 *   initialAddHeaders: true
 * })
 */
export function useMergeMarkdown(
  options: UseMergeMarkdownOptions = {}
): UseMergeMarkdownReturn {
  const {
    initialSeparatorStyle = 'none',
    initialAddHeaders = false,
    initialSortMode = 'none'
  } = options

  const { addLog } = useLogs()

  // State
  const [files, setFiles] = useState<MarkdownFile[]>([])
  const [separatorStyle, setSeparatorStyle] = useState<SeparatorStyle>(initialSeparatorStyle)
  const [addHeaders, setAddHeaders] = useState(initialAddHeaders)
  const [sortMode, setSortMode] = useState<SortMode>(initialSortMode)

  /**
   * Sort files based on sort mode
   */
  const sortFiles = useCallback((filesToSort: MarkdownFile[], mode: SortMode): MarkdownFile[] => {
    if (mode === 'none') {
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

  /**
   * Add files to the merge list
   */
  const addFiles = useCallback(async (fileList: FileList | File[]): Promise<{
    success: boolean
    added: number
    errors: string[]
  }> => {
    const selectedFiles = Array.from(fileList)

    if (selectedFiles.length === 0) {
      return { success: false, added: 0, errors: [] }
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
        return {
          error: `${file.name}: File too large (max ${formatFileSize(FILE_SIZE.MAX_MERGE_FILE_SIZE)})`
        }
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
          errors.push(
            `${result.fileData.file.name}: Would exceed total size limit of ${formatFileSize(FILE_SIZE.MAX_TOTAL_MERGE_SIZE)}`
          )
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

    return {
      success: validFiles.length > 0,
      added: validFiles.length,
      errors
    }
  }, [files, sortMode, sortFiles, addLog])

  /**
   * Remove a file by ID
   */
  const removeFile = useCallback((id: string) => {
    const file = files.find(f => f.id === id)
    if (file) {
      addLog('info', `Removed file: ${file.file.name}`)
    }
    setFiles(prev => prev.filter(f => f.id !== id))
  }, [files, addLog])

  /**
   * Clear all files
   */
  const clearFiles = useCallback(() => {
    setFiles([])
    addLog('info', 'Cleared all files')
  }, [addLog])

  /**
   * Merge all files into a single markdown string
   */
  const mergeFiles = useCallback((): string => {
    if (files.length === 0) return ''

    addLog('info', `Merging ${files.length} file(s)`, {
      separator: separatorStyle,
      headers: addHeaders
    })

    const parts: string[] = []

    files.forEach((markdownFile, index) => {
      // Add separator before file (except for first file)
      if (index > 0) {
        if (separatorStyle === 'page-break') {
          parts.push('\n\n---\n\n')
        } else {
          parts.push('\n\n')
        }
      }

      // Add header if enabled
      if (addHeaders) {
        parts.push(`# ${markdownFile.file.name}\n\n`)
      }

      // Add file content
      parts.push(markdownFile.content.trim())
    })

    const merged = parts.join('')
    addLog('success', 'Files merged successfully', {
      totalFiles: files.length,
      outputSize: formatFileSize(new Blob([merged]).size)
    })

    return merged
  }, [files, separatorStyle, addHeaders, addLog])

  /**
   * Reorder files
   */
  const reorderFiles = useCallback((newOrder: MarkdownFile[]) => {
    setFiles(newOrder)
    addLog('info', 'Files reordered')
  }, [addLog])

  /**
   * Update sort mode and re-sort files
   */
  const updateSortMode = useCallback((mode: SortMode) => {
    setSortMode(mode)
    setFiles(prev => sortFiles(prev, mode))
    addLog('info', `Sort mode changed: ${mode}`)
  }, [sortFiles, addLog])

  return {
    files,
    separatorStyle,
    addHeaders,
    sortMode,
    addFiles,
    removeFile,
    clearFiles,
    mergeFiles,
    reorderFiles,
    setSeparatorStyle,
    setAddHeaders,
    setSortMode: updateSortMode
  }
}
