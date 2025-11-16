/**
 * Custom hook for managing file selection state and operations
 * Extracts file selection business logic from components
 */

import { useState, useCallback } from 'react'
import { useLogs } from '@/contexts/LogContext'
import {
  filterPdfFiles,
  filterImmediateFolderFiles,
  filterMarkdownFiles,
  validateBatchFileSize
} from '@/lib/services/fileValidationService'
import {
  generateBatchFilenames,
  wasRenamed,
  getFolderName
} from '@/lib/services/filenameService'

export type FileType = 'pdf' | 'markdown'

export interface UseFileSelectionOptions {
  /** Type of files to accept */
  fileType: FileType
  /** Maximum file size in bytes */
  maxFileSize?: number
  /** File extension for output files */
  outputExtension?: string
}

export interface FileSelectionState {
  /** Selected files */
  files: File[]
  /** Map of files to their output filenames */
  filenameMap: Map<File, string>
  /** Detected folder name (if from folder upload) */
  folderName: string | null
  /** Error message if any */
  error: string
}

export interface UseFileSelectionReturn extends FileSelectionState {
  /** Handle file selection from FileList */
  handleFilesSelect: (selectedFiles: FileList, fromFolder?: boolean) => void
  /** Clear all selected files */
  handleClearFiles: () => void
  /** Remove a specific file */
  handleRemoveFile: (file: File) => void
  /** Set error message */
  setError: (error: string) => void
  /** Update filename for a file */
  updateFilename: (file: File, newName: string) => void
}

/**
 * Hook for managing file selection with validation and filename generation
 *
 * @example
 * const {
 *   files,
 *   filenameMap,
 *   error,
 *   handleFilesSelect,
 *   handleClearFiles
 * } = useFileSelection({ fileType: 'pdf', maxFileSize: 100 * 1024 * 1024 })
 */
export function useFileSelection(
  options: UseFileSelectionOptions
): UseFileSelectionReturn {
  const { fileType, maxFileSize, outputExtension = '.md' } = options
  const { addLog } = useLogs()

  const [files, setFiles] = useState<File[]>([])
  const [filenameMap, setFilenameMap] = useState<Map<File, string>>(new Map())
  const [folderName, setFolderName] = useState<string | null>(null)
  const [error, setError] = useState('')

  /**
   * Filter files based on type
   */
  const filterFilesByType = useCallback((fileList: File[]): File[] => {
    switch (fileType) {
      case 'pdf':
        return filterPdfFiles(fileList)
      case 'markdown':
        return filterMarkdownFiles(fileList)
      default:
        return fileList
    }
  }, [fileType])

  /**
   * Handle file selection
   */
  const handleFilesSelect = useCallback((
    selectedFiles: FileList,
    fromFolder: boolean = false
  ) => {
    const filesArray = Array.from(selectedFiles)
    let validFiles = filterFilesByType(filesArray)

    // If from folder, only include files in immediate folder (not subfolders)
    if (fromFolder) {
      validFiles = filterImmediateFolderFiles(validFiles)
    }

    if (validFiles.length === 0) {
      const typeLabel = fileType.toUpperCase()
      setError(`No ${typeLabel} files found in selection`)
      addLog('error', `No ${typeLabel} files in selection`)
      return
    }

    // Validate file sizes if limit is set
    if (maxFileSize) {
      const validation = validateBatchFileSize(validFiles, maxFileSize)
      if (!validation.valid) {
        setError(validation.error || 'File size validation failed')
        addLog('error', 'File size validation failed', { error: validation.error })
        return
      }
    }

    // Detect folder name if from folder upload
    const folderNameDetected = fromFolder ? getFolderName(validFiles[0]) : null

    addLog('info', `Adding ${validFiles.length} ${fileType.toUpperCase()} file(s)`, {
      total: filesArray.length,
      validFiles: validFiles.length,
      fromFolder,
      folderName: folderNameDetected,
      previousCount: files.length,
      excludedSubfolderFiles: fromFolder ? filesArray.length - validFiles.length : 0
    })

    // Accumulate all files - allow duplicates by name
    const allFiles = [...files, ...validFiles]

    // Generate unique output filenames
    const newMap = generateBatchFilenames(validFiles, filenameMap, outputExtension)

    // Log renamed files
    for (const file of validFiles) {
      const uniqueName = newMap.get(file)
      if (uniqueName && wasRenamed(file.name, uniqueName)) {
        addLog('info', `Renamed duplicate file: "${file.name}" → "${uniqueName}"`)
      }
    }

    // Update state
    setFiles(allFiles)
    setFilenameMap(newMap)

    // Update folder name
    if (files.length === 0 && folderNameDetected) {
      setFolderName(folderNameDetected)
    } else if (files.length > 0) {
      setFolderName(null) // Multiple sources, no single folder name
    }

    // Clear error
    setError('')
  }, [
    fileType,
    maxFileSize,
    outputExtension,
    files,
    filenameMap,
    filterFilesByType,
    addLog
  ])

  /**
   * Clear all selected files
   */
  const handleClearFiles = useCallback(() => {
    setFiles([])
    setFolderName(null)
    setFilenameMap(new Map())
    setError('')
    addLog('info', 'Cleared all selected files')
  }, [addLog])

  /**
   * Remove a specific file from selection
   */
  const handleRemoveFile = useCallback((file: File) => {
    const newFiles = files.filter(f => f !== file)
    const newMap = new Map(filenameMap)
    newMap.delete(file)

    setFiles(newFiles)
    setFilenameMap(newMap)
    addLog('info', `Removed file: ${file.name}`)

    if (newFiles.length === 0) {
      setFolderName(null)
      setError('')
    }
  }, [files, filenameMap, addLog])

  /**
   * Update filename for a specific file
   */
  const updateFilename = useCallback((file: File, newName: string) => {
    const newMap = new Map(filenameMap)
    newMap.set(file, newName)
    setFilenameMap(newMap)
    addLog('info', `Updated filename: ${file.name} → ${newName}`)
  }, [filenameMap, addLog])

  return {
    files,
    filenameMap,
    folderName,
    error,
    handleFilesSelect,
    handleClearFiles,
    handleRemoveFile,
    setError,
    updateFilename
  }
}
