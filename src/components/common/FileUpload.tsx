'use client'

import { useState, useId, useRef, useMemo, useCallback, DragEvent, ChangeEvent, KeyboardEvent } from 'react'
import { FILE_SIZE } from '@/lib/constants'
import { useLogs } from '@/contexts/LogContext'

/**
 * FileUpload component props
 */
interface FileUploadProps {
  /** Callback when file is selected */
  onFileSelect: (file: File) => void
  /** Accepted file types (e.g., ".pdf,.md") */
  accept: string
  /** Maximum file size in bytes */
  maxSize?: number
  /** Label text for the upload area */
  label?: string
}

/**
 * FileUpload component with drag-and-drop support
 */
export default function FileUpload({
  onFileSelect,
  accept,
  maxSize = FILE_SIZE.MAX_FILE_SIZE,
  label = "Drop file here or click to browse"
}: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { addLog } = useLogs()

  // Memoize file size calculations to avoid recalculating on every render
  const maxSizeMB = useMemo(() => Math.round(maxSize / FILE_SIZE.BYTES_PER_MB), [maxSize])

  const handleDrag = (e: DragEvent<HTMLDivElement>) => {
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
  }

  const validateAndSelect = useCallback((file: File) => {
    setError(null)

    if (!file) return

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

    setSelectedFile(file)
    onFileSelect(file)
    addLog('success', 'File validated and selected successfully', { fileName: file.name })
  }, [maxSize, maxSizeMB, onFileSelect, addLog])

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      addLog('info', 'File dropped in drop zone')
      validateAndSelect(e.dataTransfer.files[0])
    }
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      addLog('info', 'File selected via file browser')
      validateAndSelect(e.target.files[0])
    }
  }

  const handleClick = () => {
    addLog('info', 'File upload area clicked - Opening file browser')
    fileInputRef.current?.click()
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      fileInputRef.current?.click()
    }
  }

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
          onChange={handleChange}
          className="hidden"
          aria-label={label}
        />
        <p className="text-lg mb-2 font-medium">{label}</p>
        {selectedFile && (
          <p className="text-sm text-primary-600 font-medium">
            Selected: {selectedFile.name}
          </p>
        )}
        <p className="text-sm text-gray-500 mt-2">
          Supported: {accept}, up to {maxSizeMB}MB
        </p>
      </div>
      {error && (
        <p className="text-red-600 text-sm mt-2">{error}</p>
      )}
    </div>
  )
}
