'use client'

import { useState, useCallback, ChangeEvent, DragEvent } from 'react'
import { useLogs } from '@/contexts/LogContext'
import { formatFileSize } from '@/lib/utils/formatUtils'
import { useFileUpload } from '@/hooks/useFileUpload'
import { useFileDragAndDrop } from '@/hooks/useFileDragAndDrop'
import { FileCard, UploadPanel } from '@/components/merge-markdown'

interface MarkdownFile {
  id: string
  file: File
  content: string
}

type SeparatorStyle = 'newline' | 'page-break'

export default function MergeMarkdownPage() {
  const { addLog } = useLogs()
  const [separatorStyle, setSeparatorStyle] = useState<SeparatorStyle>('newline')
  const [addHeaders, setAddHeaders] = useState(true)
  const [isDragging, setIsDragging] = useState(false)

  // Use custom hooks
  const {
    files,
    sortMode,
    setFiles,
    processFiles,
    removeFile,
    clearAll,
    toggleAlphabetical
  } = useFileUpload()

  const {
    draggedFileId,
    dragOverFileId,
    handleFileDragStart,
    handleFileDragOver,
    handleFileDragEnter,
    handleFileDragLeave,
    handleFileDrop,
    handleFileDragEnd
  } = useFileDragAndDrop()

  // Handle file selection from button or click on empty canvas
  const handleFileSelect = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files
    if (!selectedFiles || selectedFiles.length === 0) {
      addLog('info', 'File selection cancelled')
      return
    }

    await processFiles(selectedFiles)

    // Reset input to allow re-selecting same files
    e.target.value = ''
  }, [processFiles, addLog])

  // Handle folder selection - only immediate markdown files, no subdirectories
  const handleFolderSelect = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files
    if (!selectedFiles || selectedFiles.length === 0) {
      addLog('info', 'Folder selection cancelled')
      return
    }

    // Filter to only markdown files in the immediate directory (no subdirectories)
    const filesArray = Array.from(selectedFiles)
    const immediateFiles = filesArray.filter(file => {
      const pathParts = file.webkitRelativePath.split('/')
      // Only include files that are in the immediate folder (2 parts: folder/file.md)
      return pathParts.length === 2 && (file.name.endsWith('.md') || file.name.endsWith('.markdown'))
    })

    if (immediateFiles.length === 0) {
      addLog('error', 'No markdown files found in the immediate folder')
      return
    }

    addLog('info', `Found ${immediateFiles.length} markdown file(s) in folder`)
    await processFiles(immediateFiles)

    // Reset input to allow re-selecting same folder
    e.target.value = ''
  }, [processFiles, addLog])

  // Handle click on empty canvas area
  const handleEmptyCanvasClick = useCallback(() => {
    addLog('info', 'Empty canvas area clicked - opening file browser')
    // This will be handled by the UploadPanel component
  }, [addLog])

  // Drag and drop handlers for canvas
  const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    // Only show drop zone if we're uploading files, not reordering
    if (!e.dataTransfer.types.includes('application/x-file-reorder')) {
      if (!isDragging) {
        setIsDragging(true)
        addLog('info', 'Files dragged over canvas')
      }
    }
  }, [isDragging, addLog])

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    // Only set dropEffect if we're uploading files
    if (!e.dataTransfer.types.includes('application/x-file-reorder')) {
      e.dataTransfer.dropEffect = 'copy'
    }
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

    // Check if items contain folders using DataTransferItem API
    const items = e.dataTransfer.items
    if (items && items.length > 0) {
      const hasFolder = Array.from(items).some(item => item.webkitGetAsEntry?.()?.isDirectory)

      if (hasFolder) {
        // Handle folder drop
        const allFiles: File[] = []
        const folderPromises: Promise<void>[] = []

        for (let i = 0; i < items.length; i++) {
          const item = items[i]
          const entry = item.webkitGetAsEntry()

          if (entry?.isDirectory) {
            folderPromises.push(
              new Promise<void>((resolve) => {
                const dirReader = (entry as FileSystemDirectoryEntry).createReader()
                dirReader.readEntries((entries) => {
                  // Only process immediate files, not subdirectories
                  const filePromises = entries
                    .filter(entry => entry.isFile && (entry.name.endsWith('.md') || entry.name.endsWith('.markdown')))
                    .map(entry =>
                      new Promise<void>((resolveFile) => {
                        (entry as FileSystemFileEntry).file((file) => {
                          allFiles.push(file)
                          resolveFile()
                        })
                      })
                    )

                  Promise.all(filePromises).then(() => resolve())
                })
              })
            )
          }
        }

        await Promise.all(folderPromises)

        if (allFiles.length > 0) {
          addLog('info', `${allFiles.length} markdown file(s) from folder(s) dropped`)
          await processFiles(allFiles)
        } else {
          addLog('error', 'No markdown files found in dropped folder(s)')
        }
        return
      }
    }

    // Handle regular file drop
    const droppedFiles = e.dataTransfer.files
    if (droppedFiles && droppedFiles.length > 0) {
      addLog('info', `${droppedFiles.length} file(s) dropped on canvas`)
      await processFiles(droppedFiles)
    }
  }, [processFiles, addLog])

  // Merge files into single markdown
  const mergeMarkdownFiles = useCallback((): string => {
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
        // Remove .md or .markdown extension from filename
        const nameWithoutExt = markdownFile.file.name.replace(/\.(md|markdown)$/i, '')
        parts.push(`# ${nameWithoutExt}\n\n`)
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

  // Download merged markdown with comprehensive error handling
  const handleMergeAndDownload = useCallback(() => {
    if (files.length === 0) {
      addLog('error', 'No files to merge')
      return
    }

    try {
      const mergedContent = mergeMarkdownFiles()

      // Check for browser APIs
      if (typeof Blob === 'undefined') {
        throw new Error('Blob API not supported in this browser')
      }

      let blob: Blob
      try {
        blob = new Blob([mergedContent], { type: 'text/markdown' })
      } catch (blobError) {
        // Blob creation can fail due to memory constraints
        if (blobError instanceof Error && (blobError.message?.toLowerCase().includes('memory') || blobError.message?.toLowerCase().includes('allocation'))) {
          addLog('error', 'Out of memory while creating merged file')
          throw new Error('Merged file too large for browser memory. Try merging fewer files at once.')
        }
        throw blobError
      }

      let url: string
      try {
        url = URL.createObjectURL(blob)
      } catch (urlError) {
        if (urlError instanceof Error && urlError.message?.toLowerCase().includes('quota')) {
          addLog('error', 'Too many blob URLs created')
          throw new Error('Browser URL quota exceeded. Please refresh the page and try again.')
        }
        throw urlError
      }

      try {
        const link = document.createElement('a')
        link.href = url
        link.download = 'merged.md'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        addLog('success', 'Merged file downloaded', { filename: 'merged.md' })
      } finally {
        // Always clean up URL to prevent memory leaks
        try {
          URL.revokeObjectURL(url)
        } catch (revokeError) {
          // Ignore revoke errors but log them
          console.warn('Failed to revoke object URL:', revokeError)
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      addLog('error', `Failed to merge and download: ${errorMessage}`)
      // Note: We don't set an error state in this component, just log it
    }
  }, [files.length, mergeMarkdownFiles, addLog])

  return (
    <>
      {/* Hide footer on this page only */}
      <style dangerouslySetInnerHTML={{ __html: `
        footer {
          display: none;
        }
      `}} />

      <div className="flex overflow-hidden" style={{ height: 'calc(100vh - 64px)' }}>
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

        <div className="max-w-6xl mx-auto h-full flex flex-col">
          <h1 className="text-3xl font-bold mb-2">Merge Markdown Files</h1>
          <p className="text-gray-600 mb-8">
            Combine multiple Markdown files into one document
          </p>

          {/* File Grid */}
          {files.length === 0 ? (
            <div
              className="flex items-center justify-center flex-1 min-h-[550px] border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-400 hover:bg-gray-100 transition-colors"
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 pb-8">
              {files.map((markdownFile) => {
                const isDraggedCard = draggedFileId === markdownFile.id
                const isDropTarget = dragOverFileId === markdownFile.id

                // Simplified for now - could be enhanced later
                const hasMovedPosition = false

                return (
                <FileCard
                  key={markdownFile.id}
                  markdownFile={markdownFile}
                  isDraggedCard={isDraggedCard}
                  isDropTarget={isDropTarget}
                  hasMovedPosition={hasMovedPosition}
                  onRemove={removeFile}
                  onDragStart={(e) => handleFileDragStart(e, markdownFile.id, files)}
                  onDragOver={(e) => handleFileDragOver(e, markdownFile.id, files, setFiles)}
                  onDragEnter={(e) => handleFileDragEnter(e, markdownFile.id)}
                  onDragLeave={handleFileDragLeave}
                  onDrop={(e) => handleFileDrop(e, markdownFile.id, files)}
                  onDragEnd={handleFileDragEnd}
                />
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Control Panel - Right Side */}
      <UploadPanel
        files={files}
        sortMode={sortMode}
        separatorStyle={separatorStyle}
        addHeaders={addHeaders}
        onFileSelect={handleFileSelect}
        onFolderSelect={handleFolderSelect}
        onToggleAlphabetical={toggleAlphabetical}
        onSeparatorChange={setSeparatorStyle}
        onHeadersChange={setAddHeaders}
        onMergeAndDownload={handleMergeAndDownload}
        onClearAll={clearAll}
      />
    </div>
    </>
  )
}
