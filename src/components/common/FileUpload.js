'use client'
import { useState, useId, useRef, useMemo, useCallback } from 'react'
import { FILE_SIZE } from '@/lib/constants'

/**
 * FileUpload component with drag-and-drop support
 * @param {Object} props
 * @param {Function} props.onFileSelect - Callback when file is selected
 * @param {string} props.accept - Accepted file types (e.g., ".pdf,.md")
 * @param {number} props.maxSize - Maximum file size in bytes
 * @param {string} props.label - Label text for the upload area
 */
export default function FileUpload({
  onFileSelect,
  accept,
  maxSize = FILE_SIZE.MAX_FILE_SIZE,
  label = "Drop file here or click to browse"
}) {
  const [dragActive, setDragActive] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [error, setError] = useState(null)
  const fileInputId = useId()
  const fileInputRef = useRef(null)

  // Memoize file size calculations to avoid recalculating on every render
  const maxSizeMB = useMemo(() => Math.round(maxSize / FILE_SIZE.BYTES_PER_MB), [maxSize])

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const validateAndSelect = useCallback((file) => {
    setError(null)

    if (!file) return

    if (file.size > maxSize) {
      setError(`File too large. Maximum size: ${maxSizeMB}MB`)
      return
    }

    setSelectedFile(file)
    onFileSelect(file)
  }, [maxSize, maxSizeMB, onFileSelect])

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSelect(e.dataTransfer.files[0])
    }
  }

  const handleChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSelect(e.target.files[0])
    }
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const handleKeyDown = (e) => {
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
