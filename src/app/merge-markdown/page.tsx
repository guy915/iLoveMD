'use client'

import { useState, useRef, useCallback, ChangeEvent, DragEvent } from 'react'
import Button from '@/components/common/Button'
import { useLogs } from '@/contexts/LogContext'
import { FILE_SIZE } from '@/lib/constants'

interface MarkdownFile {
  id: string
  file: File
  content: string
}

// Helper function to format file sizes dynamically
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < FILE_SIZE.BYTES_PER_MB) return `${(bytes / FILE_SIZE.BYTES_PER_KB).toFixed(1)} KB`
  if (bytes < FILE_SIZE.BYTES_PER_GB) return `${(bytes / FILE_SIZE.BYTES_PER_MB).toFixed(1)} MB`
  return `${(bytes / FILE_SIZE.BYTES_PER_GB).toFixed(2)} GB`
}

export default function MergeMarkdownPage() {
  const [files, setFiles] = useState<MarkdownFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { addLog } = useLogs()

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
      setFiles(prev => [...prev, ...validFiles])
      addLog('success', `${validFiles.length} file(s) added successfully`, {
        totalFiles: files.length + validFiles.length,
        totalSize: formatFileSize(cumulativeSize)
      })
    }

    if (errors.length > 0) {
      addLog('error', `${errors.length} file(s) failed validation`, { errors })
    }
  }, [files, addLog])

  // Handle file selection from button or click on empty canvas
  const handleFileSelect = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files
    if (!selectedFiles || selectedFiles.length === 0) {
      addLog('info', 'File selection cancelled')
      return
    }

    await processFiles(selectedFiles)

    // Reset input to allow re-selecting same files
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [processFiles, addLog])

  // Read file as text
  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result as string
        resolve(content || '')
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsText(file)
    })
  }

  // Remove individual file
  const handleRemoveFile = useCallback((id: string) => {
    setFiles(prev => {
      const file = prev.find(f => f.id === id)
      if (file) {
        addLog('info', `Removed file: ${file.file.name}`)
      }
      return prev.filter(f => f.id !== id)
    })
  }, [addLog])

  // Clear all files
  const handleClearAll = useCallback(() => {
    if (files.length === 0) return

    addLog('info', `Cleared all ${files.length} file(s)`)
    setFiles([])
  }, [files.length, addLog])

  // Trigger file input click
  const handleUploadClick = useCallback(() => {
    addLog('info', 'Upload Files button clicked')
    fileInputRef.current?.click()
  }, [addLog])

  // Handle click on empty canvas area
  const handleEmptyCanvasClick = useCallback(() => {
    addLog('info', 'Empty canvas area clicked - opening file browser')
    fileInputRef.current?.click()
  }, [addLog])

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isDragging) {
      setIsDragging(true)
      addLog('info', 'Files dragged over canvas')
    }
  }, [isDragging, addLog])

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    // Check if we're leaving the canvas container entirely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false)
    }
  }, [])

  const handleDrop = useCallback(async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const droppedFiles = e.dataTransfer.files
    if (droppedFiles && droppedFiles.length > 0) {
      addLog('info', `${droppedFiles.length} file(s) dropped on canvas`)
      await processFiles(droppedFiles)
    }
  }, [processFiles, addLog])

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Canvas Area - Left Side */}
      <div
        className="flex-1 overflow-y-auto p-8 relative bg-gray-50"
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drag overlay */}
        {isDragging && (
          <div
            className="absolute inset-0 bg-primary-500 bg-opacity-10 border-4 border-primary-500 border-dashed z-50 flex items-center justify-center pointer-events-none"
            role="status"
            aria-live="polite"
            aria-label="Drop zone active. Drop files here."
          >
            <div className="bg-white rounded-lg shadow-lg p-8 text-center">
              <svg
                className="w-16 h-16 mx-auto mb-4 text-primary-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <p className="text-xl font-semibold text-gray-900">Drop files here</p>
              <p className="text-sm text-gray-500 mt-2">Upload your markdown files</p>
            </div>
          </div>
        )}

        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">Merge Markdown Files</h1>
          <p className="text-gray-600 mb-8">
            Combine multiple markdown files into one document
          </p>

          {/* File Grid */}
          {files.length === 0 ? (
            <div
              className="flex items-center justify-center h-96 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-400 hover:bg-gray-100 transition-colors"
              onClick={handleEmptyCanvasClick}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleEmptyCanvasClick()
                }
              }}
            >
              <div className="text-center">
                <p className="text-gray-500 text-lg mb-2">No files uploaded</p>
                <p className="text-gray-400 text-sm">
                  Click here, drag files, or &quot;Upload Files&quot; to get started
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {files.map((markdownFile) => (
                <div
                  key={markdownFile.id}
                  className="relative bg-white border-2 border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow aspect-[5/7] flex flex-col"
                >
                  {/* Remove button */}
                  <button
                    onClick={() => handleRemoveFile(markdownFile.id)}
                    className="absolute top-2 right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors z-10"
                    aria-label={`Remove ${markdownFile.file.name}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>

                  {/* File preview placeholder */}
                  <div className="flex-1 bg-gray-100 border-b-2 border-gray-200 flex items-center justify-center p-4 rounded-t-lg">
                    <div className="text-center">
                      <svg
                        className="w-16 h-16 mx-auto mb-2 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      <p className="text-xs text-gray-500">Markdown</p>
                    </div>
                  </div>

                  {/* Filename - Fixed height footer */}
                  <div className="p-3 flex-shrink-0">
                    <p className="text-sm font-medium text-gray-900 truncate" title={markdownFile.file.name}>
                      {markdownFile.file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(markdownFile.file.size)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Control Panel - Right Side */}
      <div className="w-80 bg-white border-l border-gray-200 p-6 flex flex-col">
        <div className="space-y-6 flex-1 overflow-y-auto">
          {/* Upload Section */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Upload Files</h2>
            <input
              ref={fileInputRef}
              type="file"
              accept=".md,.markdown"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              onClick={handleUploadClick}
              variant="primary"
              className="w-full"
            >
              Upload Files
            </Button>
            <p className="text-xs text-gray-500 mt-2">
              {files.length} / {FILE_SIZE.MAX_MERGE_FILES} files
            </p>
          </div>

          {/* Sorting Section - Placeholder */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Sort Files</h2>
            <div className="text-sm text-gray-500">
              Coming in next PR
            </div>
          </div>

          {/* Merge Options - Placeholder */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Merge Options</h2>
            <div className="text-sm text-gray-500">
              Coming in next PR
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="space-y-3 pt-6 border-t border-gray-200">
          {/* Merge Button - Placeholder */}
          <Button
            variant="primary"
            disabled={true}
            className="w-full"
          >
            Merge Files
          </Button>

          {/* Clear All Button */}
          <Button
            onClick={handleClearAll}
            variant="secondary"
            disabled={files.length === 0}
            className="w-full"
          >
            Clear All Files
          </Button>
        </div>
      </div>
    </div>
  )
}
