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

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i]

      // Validate file type
      if (!file.name.endsWith('.md') && !file.name.endsWith('.markdown')) {
        errors.push(`${file.name}: Not a markdown file`)
        continue
      }

      // Validate file size
      if (file.size > FILE_SIZE.MAX_FILE_SIZE) {
        errors.push(`${file.name}: File too large (max 1GB)`)
        continue
      }

      // Check total file count
      if (files.length + validFiles.length >= FILE_SIZE.MAX_MERGE_FILES) {
        errors.push(`Maximum ${FILE_SIZE.MAX_MERGE_FILES} files allowed`)
        break
      }

      // Read file content
      try {
        const content = await readFileAsText(file)
        validFiles.push({
          id: `${file.name}-${Date.now()}-${i}`,
          file,
          content
        })
      } catch (err) {
        errors.push(`${file.name}: Failed to read file`)
      }
    }

    if (validFiles.length > 0) {
      setFiles(prev => [...prev, ...validFiles])
      addLog('success', `${validFiles.length} file(s) added successfully`)
    }

    if (errors.length > 0) {
      addLog('error', `${errors.length} file(s) failed validation`, { errors })
    }
  }, [files.length, addLog])

  // Handle file selection from button
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

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
    addLog('info', 'Files dragged over canvas')
  }, [addLog])

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    // Only set isDragging to false if we're leaving the canvas entirely
    if (e.currentTarget === e.target) {
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
        className="flex-1 bg-gray-50 overflow-y-auto p-8 relative"
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drag overlay */}
        {isDragging && (
          <div className="absolute inset-0 bg-primary-500 bg-opacity-10 border-4 border-primary-500 border-dashed z-50 flex items-center justify-center pointer-events-none">
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
            <div className="flex items-center justify-center h-96 border-2 border-dashed border-gray-300 rounded-lg">
              <div className="text-center">
                <p className="text-gray-500 text-lg mb-2">No files uploaded</p>
                <p className="text-gray-400 text-sm">
                  Click &quot;Upload Files&quot; or drag files here to get started
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {files.map((markdownFile) => (
                <div
                  key={markdownFile.id}
                  className="relative bg-white border-2 border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow"
                >
                  {/* Remove button */}
                  <button
                    onClick={() => handleRemoveFile(markdownFile.id)}
                    className="absolute top-2 right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-sm font-bold transition-colors z-10"
                    aria-label="Remove file"
                  >
                    ×
                  </button>

                  {/* File preview placeholder (A4 ratio: 1:1.414) */}
                  <div className="aspect-[1/1.414] bg-gray-100 border-b-2 border-gray-200 flex items-center justify-center p-4">
                    <div className="text-center">
                      <svg
                        className="w-12 h-12 mx-auto mb-2 text-gray-400"
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
                      <p className="text-xs text-gray-500">Markdown File</p>
                    </div>
                  </div>

                  {/* Filename */}
                  <div className="p-3">
                    <p className="text-sm font-medium text-gray-900 truncate" title={markdownFile.file.name}>
                      {markdownFile.file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {(markdownFile.file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Control Panel - Right Side */}
      <div className="w-80 bg-white border-l border-gray-200 overflow-y-auto p-6 flex flex-col">
        <div className="space-y-6 flex-1">
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

          {/* Sorting Section - Coming in PR 4 */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Sort Files</h2>
            <div className="text-sm text-gray-500">
              Coming soon: Alphabetical sorting
            </div>
          </div>

          {/* Merge Options - Coming in PR 5 */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Merge Options</h2>
            <div className="text-sm text-gray-500">
              Coming soon: Separator options
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="space-y-3 pt-6 border-t border-gray-200">
          {/* Merge Button - Coming in PR 5 */}
          <Button
            onClick={() => {}}
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
