'use client'

import { useState, useId, useRef, useMemo, useCallback, DragEvent, ChangeEvent, KeyboardEvent } from 'react'
import { FILE_SIZE } from '@/lib/constants'
import { useLogs } from '@/contexts/LogContext'

/**
 * FileUpload component props
 */
interface FileUploadProps {
  /** Callback when file(s) are selected */
  onFileSelect?: (file: File) => void
  /** Callback when multiple files are selected */
  onFilesSelect?: (files: File[]) => void
  /** Accepted file types (e.g., ".pdf,.md") */
  accept: string
  /** Maximum file size in bytes per file */
  maxSize?: number
  /** Label text for the upload area */
  label?: string
  /** Allow multiple files */
  multiple?: boolean
  /** Allow folder selection */
  allowFolder?: boolean
}

/**
 * FileUpload component with drag-and-drop support
 */
export default function FileUpload({
  onFileSelect,
  onFilesSelect,
  accept,
  maxSize = FILE_SIZE.MAX_FILE_SIZE,
  label = "Drop file here or click to browse",
  multiple = false,
  allowFolder = false
}: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const fileInputId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { addLog } = useLogs()

  // Memoize file size calculations to avoid recalculating on every render
  const maxSizeMB = useMemo(() => Math.round(maxSize / FILE_SIZE.BYTES_PER_MB), [maxSize])

  const handleDrag = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
      if (e.type === "dragenter") {
        addLog('info', 'File drag detected')
      }
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }, [addLog])

  const validateAndSelect = useCallback((files: FileList | File[]) => {
    setError(null)

    const fileArray = Array.from(files)
    if (fileArray.length === 0) return

    // For single file mode, only take the first file
    if (!multiple) {
      const file = fileArray[0]
      addLog('info', 'File selected for validation', {
        name: file.name,
        size: `${(file.size / FILE_SIZE.BYTES_PER_MB).toFixed(2)}MB`,
        type: file.type
      })

      if (file.size > maxSize) {
        const errorMsg = `File too large. Maximum size: ${maxSizeMB}MB`
        setError(errorMsg)
        addLog('error', 'File validation failed: File too large', {
          fileName: file.name,
          fileSize: `${(file.size / FILE_SIZE.BYTES_PER_MB).toFixed(2)}MB`,
          maxSize: `${maxSizeMB}MB`
        })
        return
      }

      setSelectedFiles([file])
      onFileSelect?.(file)
      addLog('success', 'File validated and selected successfully', { fileName: file.name })
    } else {
      // Multiple files mode
      addLog('info', `${fileArray.length} files selected for validation`, {
        count: fileArray.length,
        totalSize: `${(fileArray.reduce((sum, f) => sum + f.size, 0) / FILE_SIZE.BYTES_PER_MB).toFixed(2)}MB`
      })

      setSelectedFiles(fileArray)
      onFilesSelect?.(fileArray)
      addLog('success', `${fileArray.length} files selected successfully`)
    }
  }, [maxSize, maxSizeMB, multiple, onFileSelect, onFilesSelect, addLog])

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addLog('info', `${e.dataTransfer.files.length} file(s) dropped in drop zone`)
      validateAndSelect(e.dataTransfer.files)
    }
  }, [addLog, validateAndSelect])

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addLog('info', `${e.target.files.length} file(s) selected via file browser`)
      validateAndSelect(e.target.files)
      // Reset input value to allow selecting the same file(s) again
      e.target.value = ''
    } else {
      // User cancelled file selection
      addLog('info', 'File selection cancelled')
    }
  }, [addLog, validateAndSelect])

  const handleClick = useCallback(() => {
    addLog('info', 'File upload area clicked - Opening file browser')
    fileInputRef.current?.click()
  }, [addLog])

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      fileInputRef.current?.click()
    }
  }, [])

  const displayText = useMemo(() => {
    if (selectedFiles.length === 0) return null
    if (selectedFiles.length === 1) {
      return `Selected: ${selectedFiles[0].name}`
    }
    return `Selected: ${selectedFiles.length} files`
  }, [selectedFiles])

  return (
    <div>
      <div
        className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
          dragActive
            ? 'border-primary-500 bg-primary-50'
            : 'border-gray-300 hover:border-primary-400'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-label={label}
      >
        <input
          ref={fileInputRef}
          id={fileInputId}
          type="file"
          accept={accept}
          multiple={multiple}
          // @ts-ignore - webkitdirectory is not in TypeScript definitions
          webkitdirectory={allowFolder ? "true" : undefined}
          onChange={handleChange}
          className="hidden"
          aria-label={label}
        />
        <p className="text-lg mb-2 font-medium">{label}</p>
        {displayText && (
          <p className="text-sm text-primary-600 font-medium">
            {displayText}
          </p>
        )}
        <p className="text-sm text-gray-500 mt-2">
          {multiple
            ? `Supported: ${accept}, up to ${maxSizeMB}MB per file`
            : `Supported: ${accept}, up to ${maxSizeMB}MB`}
        </p>
      </div>
      {error && (
        <p className="text-red-600 text-sm mt-2">{error}</p>
      )}
    </div>
  )
}
