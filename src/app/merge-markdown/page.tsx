'use client'

import { useState, useRef, useCallback, ChangeEvent, DragEvent } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import Button from '@/components/common/Button'
import { useLogs } from '@/contexts/LogContext'
import { formatFileSize } from '@/lib/utils/formatUtils'
import { FILE_SIZE } from '@/lib/constants'

interface MarkdownFile {
  id: string
  file: File
  content: string
}

type SortMode = 'none' | 'alphabetical' | 'reverseAlphabetical'
type SeparatorStyle = 'newline' | 'page-break'

export default function MergeMarkdownPage() {
  const [files, setFiles] = useState<MarkdownFile[]>([])
  const [sortMode, setSortMode] = useState<SortMode>('none')
  const [separatorStyle, setSeparatorStyle] = useState<SeparatorStyle>('newline')
  const [addHeaders, setAddHeaders] = useState(true)
  const [isDragging, setIsDragging] = useState(false)
  const [draggedFileId, setDraggedFileId] = useState<string | null>(null)
  const [dragOverFileId, setDragOverFileId] = useState<string | null>(null)
  const draggedIndexRef = useRef<number | null>(null)
  const dragStartOrderRef = useRef<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
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
    if (folderInputRef.current) {
      folderInputRef.current.value = ''
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
    setSortMode('none')
  }, [files.length, addLog])

  // Toggle alphabetical sorting
  const handleToggleAlphabetical = useCallback(() => {
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

  // Download merged markdown
  const handleMergeAndDownload = useCallback(() => {
    if (files.length === 0) {
      addLog('error', 'No files to merge')
      return
    }

    try {
      const mergedContent = mergeMarkdownFiles()
      const blob = new Blob([mergedContent], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'merged.md'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      addLog('success', 'Merged file downloaded', { filename: 'merged.md' })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      addLog('error', `Failed to merge and download: ${errorMessage}`)
    }
  }, [files.length, mergeMarkdownFiles, addLog])

  // Trigger file input click
  const handleUploadClick = useCallback(() => {
    addLog('info', 'Upload Files button clicked')
    fileInputRef.current?.click()
  }, [addLog])

  // Trigger folder input click
  const handleFolderUploadClick = useCallback(() => {
    addLog('info', 'Upload Folder button clicked')
    folderInputRef.current?.click()
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

  // File reordering drag handlers
  const handleFileDragStart = useCallback((e: DragEvent<HTMLDivElement>, fileId: string) => {
    const draggedIndex = files.findIndex(f => f.id === fileId)
    draggedIndexRef.current = draggedIndex
    dragStartOrderRef.current = files.map(f => f.id)
    setDraggedFileId(fileId)
    e.dataTransfer.effectAllowed = 'move'
    // Set a custom data type to differentiate from file upload drags
    e.dataTransfer.setData('application/x-file-reorder', fileId)
    addLog('info', 'Started dragging file for reordering', {
      fileName: files[draggedIndex]?.file.name
    })
  }, [files, addLog])

  const handleFileDragOver = useCallback((e: DragEvent<HTMLDivElement>, fileId: string) => {
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

      setFiles(newFiles)
      setDragOverFileId(fileId)
    }
  }, [draggedFileId, files])

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

  const handleFileDrop = useCallback((e: DragEvent<HTMLDivElement>, dropTargetId: string) => {
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
  }, [draggedFileId, files, addLog])

  const handleFileDragEnd = useCallback(() => {
    setDraggedFileId(null)
    setDragOverFileId(null)
    draggedIndexRef.current = null
    dragStartOrderRef.current = []
  }, [])

  return (
    <>
      {/* Hide footer on this page only */}
      <style jsx global>{`
        footer {
          display: none;
        }
      `}</style>

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
            Combine multiple markdown files into one document
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
              {files.map((markdownFile, currentIndex) => {
                const isDraggedCard = draggedFileId === markdownFile.id
                const isDropTarget = dragOverFileId === markdownFile.id

                // Check if card has moved from its starting position
                const startIndex = dragStartOrderRef.current.indexOf(markdownFile.id)
                const hasMovedPosition = draggedFileId && startIndex !== -1 && startIndex !== currentIndex

                return (
                <div
                  key={markdownFile.id}
                  draggable
                  onDragStart={(e) => handleFileDragStart(e, markdownFile.id)}
                  onDragOver={(e) => handleFileDragOver(e, markdownFile.id)}
                  onDragEnter={(e) => handleFileDragEnter(e, markdownFile.id)}
                  onDragLeave={(e) => handleFileDragLeave(e)}
                  onDrop={(e) => handleFileDrop(e, markdownFile.id)}
                  onDragEnd={handleFileDragEnd}
                  className={`relative bg-white border-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-300 ease-in-out aspect-[5/7] flex flex-col ${
                    isDraggedCard
                      ? 'cursor-grabbing opacity-20 border-primary-400'
                      : isDropTarget || hasMovedPosition
                      ? 'border-primary-400 bg-primary-50'
                      : 'cursor-grab border-gray-200'
                  }`}
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

                  {/* Markdown preview */}
                  <div className="flex-1 bg-white border-b-2 border-gray-200 overflow-hidden rounded-t-lg relative">
                    <div className="absolute inset-0 overflow-hidden p-2">
                      <div className="text-[0.35rem] leading-tight">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm, remarkMath]}
                          rehypePlugins={[rehypeKatex]}
                          components={{
                            h1: ({...props}) => <h1 className="text-[0.5rem] font-bold mb-1" {...props} />,
                            h2: ({...props}) => <h2 className="text-[0.45rem] font-bold mb-1" {...props} />,
                            h3: ({...props}) => <h3 className="text-[0.4rem] font-bold mb-0.5" {...props} />,
                            h4: ({...props}) => <h4 className="text-[0.38rem] font-semibold mb-0.5" {...props} />,
                            h5: ({...props}) => <h5 className="text-[0.36rem] font-semibold mb-0.5" {...props} />,
                            h6: ({...props}) => <h6 className="text-[0.35rem] font-semibold mb-0.5" {...props} />,
                            p: ({...props}) => <p className="mb-1" {...props} />,
                            ul: ({...props}) => <ul className="mb-1 ml-2 list-disc" {...props} />,
                            ol: ({...props}) => <ol className="mb-1 ml-2 list-decimal" {...props} />,
                            li: ({...props}) => <li className="mb-0.5" {...props} />,
                            code: ({...props}) => <code className="bg-gray-100 px-0.5 rounded text-[0.32rem]" {...props} />,
                            pre: ({...props}) => <pre className="bg-gray-100 p-1 rounded text-[0.32rem] mb-1 overflow-x-auto" {...props} />,
                            blockquote: ({...props}) => <blockquote className="border-l-2 border-gray-300 pl-1 mb-1 text-gray-600" {...props} />,
                            a: ({href, ...props}) => {
                              // Whitelist approach: only allow safe URL schemes
                              // Block protocol-relative URLs (//) which inherit the page's protocol
                              const isSafe = href && (
                                href.startsWith('http://') ||
                                href.startsWith('https://') ||
                                (href.startsWith('/') && !href.startsWith('//')) || // Allow relative paths but not protocol-relative
                                href.startsWith('#') ||
                                href.startsWith('mailto:')
                              )
                              return isSafe
                                ? <a className="text-blue-600" href={href} rel="noopener noreferrer" {...props} />
                                : <span className="text-blue-600" {...props} />
                            },
                            hr: ({...props}) => <hr className="my-1 border-gray-300" {...props} />,
                            // Don't render images - just show alt text to prevent 404 errors flooding logs
                            img: ({alt}) => <span className="text-gray-500 text-[0.32rem] italic">[Image: {alt || 'no description'}]</span>,
                          }}
                        >
                          {markdownFile.content}
                        </ReactMarkdown>
                      </div>
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
                )
              })}
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
            <input
              ref={folderInputRef}
              type="file"
              /* @ts-ignore - webkitdirectory is not in TypeScript types but works in browsers */
              webkitdirectory=""
              directory=""
              onChange={handleFolderSelect}
              className="hidden"
            />
            <div className="space-y-2">
              <Button
                onClick={handleUploadClick}
                variant="primary"
                className="w-full"
              >
                Upload Files
              </Button>
              <Button
                onClick={handleFolderUploadClick}
                variant="secondary"
                className="w-full"
              >
                Upload Folder
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {files.length} / {FILE_SIZE.MAX_MERGE_FILES} files
            </p>
          </div>

          {/* Sorting Section */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Sort Files</h2>
            <button
              onClick={handleToggleAlphabetical}
              aria-pressed={sortMode !== 'none'}
              className="w-full px-3 py-2 text-sm font-medium rounded transition-colors bg-primary-600 text-white hover:bg-primary-700"
            >
              {sortMode === 'reverseAlphabetical' ? 'Z → A' : 'A → Z'}
            </button>
          </div>

          {/* Merge Options */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Merge Options</h2>
            <div className="space-y-4">
              {/* Add Headers Checkbox */}
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={addHeaders}
                  onChange={(e) => {
                    setAddHeaders(e.target.checked)
                    addLog('info', `File headers ${e.target.checked ? 'enabled' : 'disabled'}`)
                  }}
                  className="w-4 h-4 text-primary-600 focus:ring-primary-500 rounded"
                />
                <span className="text-sm text-gray-700">Add file headers (# filename)</span>
              </label>

              {/* Separator Style */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">
                  Separator
                </label>
                <div className="space-y-2">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="separator"
                      value="newline"
                      checked={separatorStyle === 'newline'}
                      onChange={(e) => {
                        setSeparatorStyle(e.target.value as SeparatorStyle)
                        addLog('info', 'Separator changed to: newlines')
                      }}
                      className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">Newlines only</span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="separator"
                      value="page-break"
                      checked={separatorStyle === 'page-break'}
                      onChange={(e) => {
                        setSeparatorStyle(e.target.value as SeparatorStyle)
                        addLog('info', 'Separator changed to: page breaks')
                      }}
                      className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">Page breaks (---)</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="space-y-3 pt-6 border-t border-gray-200">
          {/* Merge Button */}
          <Button
            onClick={handleMergeAndDownload}
            variant="primary"
            disabled={files.length === 0}
            className="w-full"
          >
            Merge & Download
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
    </>
  )
}
