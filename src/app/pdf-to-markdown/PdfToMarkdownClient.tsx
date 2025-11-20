'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Button from '@/components/common/Button'
import { downloadFile, replaceExtension } from '@/lib/utils/downloadUtils'
import { formatBytesToMB, formatBytesToKB } from '@/lib/utils/formatUtils'
import { MARKER_CONFIG } from '@/lib/constants'
import { convertPdfToMarkdown, convertPdfToMarkdownLocal } from '@/lib/services/markerApiService'
import { filterPdfFiles, filterImmediateFolderFiles, getFolderName, type BatchProgress } from '@/lib/services/batchConversionService'
import { cleanupPdfMarkdown } from '@/lib/utils/markdownUtils'
import { useLogs } from '@/contexts/LogContext'
import { useConversionMode } from '@/hooks/useConversionMode'
import { useConversionOptions } from '@/hooks/useConversionOptions'
import { useApiKeys } from '@/hooks/useApiKeys'
import { useFullPageDropZone } from '@/hooks/useFullPageDropZone'
import {
    ConversionModeToggle,
    ApiKeyInput,
    FileUploadSection,
    ConversionOptions,
    ConversionStatus,
    FullPageDropOverlay
} from '@/components/pdf-to-markdown'

export default function PdfToMarkdownClient() {
    const { addLog } = useLogs()

    // Use custom hooks for state management
    const { mode, setMode, mounted } = useConversionMode()
    const { apiKey, setApiKey, geminiApiKey, setGeminiApiKey } = useApiKeys()
    const { options, handleOptionChange } = useConversionOptions()

    // File state - supports both single and batch
    const [files, setFiles] = useState<File[]>([])
    const [folderName, setFolderName] = useState<string | null>(null)
    // Map from original file to unique output filename (for handling duplicates)
    const [filenameMap, setFilenameMap] = useState<Map<File, string>>(new Map())

    const [processing, setProcessing] = useState(false)
    const [status, setStatus] = useState('')
    const [error, setError] = useState('')

    // Single file results
    const [convertedMarkdown, setConvertedMarkdown] = useState<string | null>(null)
    const [outputFilename, setOutputFilename] = useState<string | null>(null)

    // Batch results
    const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null)
    const [batchZipBlob, setBatchZipBlob] = useState<Blob | null>(null)
    const [batchZipFilename, setBatchZipFilename] = useState<string | null>(null)

    // Refs for cleanup and memory leak prevention
    const isMountedRef = useRef(true)
    const abortControllerRef = useRef<AbortController | null>(null)
    const statusTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    // Cleanup on unmount to prevent memory leaks
    useEffect(() => {
        isMountedRef.current = true
        return () => {
            isMountedRef.current = false
            // Cancel any ongoing conversion
            if (abortControllerRef.current) {
                abortControllerRef.current.abort()
                abortControllerRef.current = null
            }
            // Clear status timeout
            if (statusTimeoutRef.current) {
                clearTimeout(statusTimeoutRef.current)
                statusTimeoutRef.current = null
            }
        }
    }, [])

    // Cancel ongoing conversions on page unload/refresh/close
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (processing && abortControllerRef.current) {
                // Cancel the ongoing conversion
                abortControllerRef.current.abort()
                addLog('info', 'Conversion cancelled due to page unload/refresh')

                // Show browser confirmation dialog to warn user
                e.preventDefault()
                // Chrome requires returnValue to be set
                e.returnValue = ''
            }
        }

        window.addEventListener('beforeunload', handleBeforeUnload)
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload)
        }
    }, [processing, addLog])

    // Log component mount (once)
    useEffect(() => {
        const keyPresent = apiKey.length > 0
        const keyLength = apiKey.length

        addLog('info', 'PDF to Markdown page loaded', {
            apiKeyPresent: keyPresent,
            apiKeyLength: keyLength
        })
        // Note: We don't log the actual API key value for security
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [addLog]) // Only run once on mount

    // Determine if this is a batch conversion
    const isBatch = files.length > 1

    /**
     * Generate unique output filename for a file, handling duplicates with numerical suffixes
     * Example: "file.pdf" → "file.md", second "file.pdf" → "file (1).md"
     */
    const generateUniqueFilename = useCallback((
        file: File,
        existingMap: Map<File, string>
    ): string => {
        const baseName = file.name.replace(/\.pdf$/i, '')
        let outputName = `${baseName}.md`

        // Check if this exact filename is already used
        const usedNames = new Set(Array.from(existingMap.values()))

        if (!usedNames.has(outputName)) {
            return outputName
        }

        // Find next available number
        let counter = 1
        while (usedNames.has(`${baseName} (${counter}).md`)) {
            counter++
        }

        return `${baseName} (${counter}).md`
    }, [])

    const handleFilesSelect = useCallback((selectedFiles: FileList, fromFolder: boolean = false) => {
        const filesArray = Array.from(selectedFiles)
        let pdfFiles = filterPdfFiles(filesArray)

        // If from folder, only include files in immediate folder (not subfolders)
        if (fromFolder) {
            pdfFiles = filterImmediateFolderFiles(pdfFiles)
        }

        if (pdfFiles.length === 0) {
            setError('No PDF files found in selection')
            addLog('error', 'No PDF files in selection')
            return
        }

        // Check if this is from a folder by looking at webkitRelativePath
        const folderNameDetected = fromFolder ? getFolderName(pdfFiles[0]) : null

        addLog('info', `Adding ${pdfFiles.length} PDF file(s)`, {
            total: filesArray.length,
            pdfs: pdfFiles.length,
            fromFolder,
            folderName: folderNameDetected,
            previousCount: files.length,
            excludedSubfolderFiles: fromFolder ? filesArray.length - pdfFiles.length : 0
        })

        // Accumulate ALL files - allow duplicates by name
        // Generate unique output filenames with numerical suffixes for duplicates
        const allFiles = [...files, ...pdfFiles]
        const newMap = new Map(filenameMap)

        // Generate unique names for new files
        for (const file of pdfFiles) {
            const uniqueName = generateUniqueFilename(file, newMap)
            newMap.set(file, uniqueName)

            // Log if file was renamed (has numerical suffix)
            if (uniqueName !== file.name.replace(/\.pdf$/i, '.md')) {
                addLog('info', `Renamed duplicate file: "${file.name}" → "${uniqueName}"`)
            }
        }

        // Update both states
        setFiles(allFiles)
        setFilenameMap(newMap)

        // Update folder name if this is first selection or if single folder
        if (files.length === 0 && folderNameDetected) {
            setFolderName(folderNameDetected)
        } else if (files.length > 0) {
            setFolderName(null) // Multiple sources, no single folder name
        }

        setError('')
        setConvertedMarkdown(null)
        setOutputFilename(null)
        setBatchProgress(null)
        setBatchZipBlob(null)
        setBatchZipFilename(null)
    }, [addLog, files, filenameMap, generateUniqueFilename])

    const clearInputFiles = useCallback(() => {
        // Only clear input files, keep conversion results intact
        setFiles([])
        setFolderName(null)
        setFilenameMap(new Map())
        addLog('info', 'Cleared uploaded files')
    }, [addLog])

    const handleClearFiles = useCallback(() => {
        setFiles([])
        setFolderName(null)
        setFilenameMap(new Map())
        setError('')
        setConvertedMarkdown(null)
        setOutputFilename(null)
        setBatchProgress(null)
        setBatchZipBlob(null)
        setBatchZipFilename(null)
        addLog('info', 'Cleared all selected files')
    }, [addLog])

    const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        e.stopPropagation()

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            addLog('info', `${e.dataTransfer.files.length} file(s) dropped`)
            handleFilesSelect(e.dataTransfer.files, false)
        }
    }, [handleFilesSelect, addLog])

    // Use full-page drop zone hook
    const { showDropOverlay } = useFullPageDropZone({
        onFilesDropped: (fileList) => handleFilesSelect(fileList, false),
        enabled: true
    })

    const handleConvert = useCallback(async () => {
        // Mode-based validation
        if (mode === 'paid') {
            // Validate Marker API key for paid mode
            if (!apiKey.trim()) {
                setError('Please enter your Marker API key')
                addLog('error', 'Conversion blocked: No Marker API key provided')
                return
            }
        } else if (mode === 'free') {
            // Validate Gemini API key for free mode with LLM
            if (options.use_llm && !geminiApiKey.trim()) {
                setError('Please enter your Gemini API key to use LLM enhancement in free mode')
                addLog('error', 'Conversion blocked: No Gemini API key provided for free LLM mode')
                return
            }
        }

        if (files.length === 0) {
            setError('Please select PDF file(s)')
            addLog('error', 'Conversion blocked: No files selected')
            return
        }


        setProcessing(true)
        setError('')
        setBatchProgress(null)
        setBatchZipBlob(null)
        setBatchZipFilename(null)

        addLog('info', `Starting conversion`, {
            fileCount: files.length,
            isBatch,
            totalSize: formatBytesToMB(files.reduce((sum, f) => sum + f.size, 0)),
            options
        })

        try {
            abortControllerRef.current = new AbortController()

            if (isBatch) {
                // Batch conversion
                if (mode === 'free') {
                    // Free mode: use batch service with parallel processing (up to 10 concurrent)
                    setStatus('Uploading...')
                    const uploadingStartTime = Date.now()
                    const MIN_UPLOADING_DURATION = 300 // ms - minimum time to show "Uploading..." state

                    // Dynamically import batch service with error handling
                    let convertBatchPdfToMarkdownLocal: typeof import('@/lib/services/batchConversionService').convertBatchPdfToMarkdownLocal
                    try {
                        const batchModule = await import('@/lib/services/batchConversionService')
                        convertBatchPdfToMarkdownLocal = batchModule.convertBatchPdfToMarkdownLocal
                    } catch (importError) {
                        addLog('error', 'Failed to load batch conversion module', {
                            error: importError instanceof Error ? importError.message : String(importError)
                        })
                        throw new Error('Failed to load required conversion module. Please refresh and try again.')
                    }

                    const result = await convertBatchPdfToMarkdownLocal(files, {
                        geminiApiKey: options.use_llm ? geminiApiKey : null,
                        markerOptions: options,
                        filenameMap: filenameMap,
                        onProgress: (progress: BatchProgress) => {
                            if (isMountedRef.current) {
                                setBatchProgress(progress)
                                const elapsedTime = Date.now() - uploadingStartTime
                                // Show "Uploading..." until first file completes AND minimum duration has passed
                                if (progress.completed === 0 || elapsedTime < MIN_UPLOADING_DURATION) {
                                    setStatus('Uploading...')
                                } else {
                                    setStatus(`Processing... ${progress.completed}/${progress.total}`)
                                }
                            }
                        },
                        signal: abortControllerRef.current.signal
                    })

                    if (!result.success || !result.zipBlob) {
                        // Check if operation was cancelled by user
                        if (abortControllerRef.current?.signal.aborted) {
                            addLog('info', 'Batch conversion cancelled by user', {
                                completed: result.completed?.length || 0,
                                failed: result.failed?.length || 0,
                                total: files.length
                            })

                            if (isMountedRef.current) {
                                setStatus('Conversion cancelled')
                                setProcessing(false)
                            }
                            return
                        }

                        // Handle actual errors
                        const errorMsg = result.error || 'Batch conversion failed'
                        const failedCount = result.failed?.length || 0
                        const totalCount = files.length

                        if (failedCount > 0 && failedCount < totalCount) {
                            throw new Error(`${errorMsg}. ${result.completed?.length || 0}/${totalCount} files converted successfully.`)
                        } else {
                            throw new Error(errorMsg)
                        }
                    }

                    const zipName = folderName
                        ? `${folderName}_markdown.zip`
                        : `converted_markdowns_${new Date().toISOString().replace(/:/g, '-').split('.')[0]}.zip`

                    addLog('success', `Batch conversion complete!`, {
                        completed: result.completed.length,
                        failed: result.failed.length,
                        zipName
                    })

                    if (isMountedRef.current) {
                        setBatchZipBlob(result.zipBlob)
                        setBatchZipFilename(zipName)
                        setStatus(`Conversion complete! ${result.completed.length}/${files.length} files converted.`)
                        setProcessing(false)
                        // Auto-clear uploaded files after successful batch conversion
                        clearInputFiles()
                    }
                } else {
                    // Paid mode - use batch service
                    setStatus('Uploading...')
                    const uploadingStartTime = Date.now()
                    const MIN_UPLOADING_DURATION = 300 // ms - minimum time to show "Uploading..." state

                    // Dynamically import batch service with error handling
                    let convertBatchPdfToMarkdown: typeof import('@/lib/services/batchConversionService').convertBatchPdfToMarkdown
                    try {
                        const batchModule = await import('@/lib/services/batchConversionService')
                        convertBatchPdfToMarkdown = batchModule.convertBatchPdfToMarkdown
                    } catch (importError) {
                        addLog('error', 'Failed to load batch conversion module', {
                            error: importError instanceof Error ? importError.message : String(importError)
                        })
                        throw new Error('Failed to load required conversion module. Please refresh and try again.')
                    }

                    const result = await convertBatchPdfToMarkdown(files, {
                        apiKey,
                        markerOptions: options,
                        filenameMap: filenameMap,
                        onProgress: (progress: BatchProgress) => {
                            if (isMountedRef.current) {
                                setBatchProgress(progress)
                                const elapsedTime = Date.now() - uploadingStartTime
                                // Show "Uploading..." until first file completes AND minimum duration has passed
                                if (progress.completed === 0 || elapsedTime < MIN_UPLOADING_DURATION) {
                                    setStatus('Uploading...')
                                } else {
                                    setStatus(`Processing... ${progress.completed}/${progress.total}`)
                                }
                            }
                        },
                        signal: abortControllerRef.current.signal
                    })

                    if (!result.success || !result.zipBlob) {
                        // Check if operation was cancelled by user
                        if (abortControllerRef.current?.signal.aborted) {
                            addLog('info', 'Batch conversion cancelled by user', {
                                completed: result.completed?.length || 0,
                                failed: result.failed?.length || 0,
                                total: files.length
                            })

                            if (isMountedRef.current) {
                                setStatus('Conversion cancelled')
                                setProcessing(false)
                            }
                            return
                        }

                        // Handle actual errors
                        const errorMsg = result.error || 'Batch conversion failed'
                        const failedCount = result.failed?.length || 0
                        const totalCount = files.length

                        if (failedCount > 0 && failedCount < totalCount) {
                            throw new Error(`${errorMsg}. ${result.completed?.length || 0}/${totalCount} files converted successfully.`)
                        } else {
                            throw new Error(errorMsg)
                        }
                    }

                    const zipName = folderName
                        ? `${folderName}_markdown.zip`
                        : `converted_markdowns_${new Date().toISOString().replace(/:/g, '-').split('.')[0]}.zip`

                    addLog('success', `Batch conversion complete!`, {
                        completed: result.completed.length,
                        failed: result.failed.length,
                        zipName
                    })

                    if (isMountedRef.current) {
                        setBatchZipBlob(result.zipBlob)
                        setBatchZipFilename(zipName)
                        setStatus(`Conversion complete! ${result.completed.length}/${files.length} files converted.`)
                        setProcessing(false)
                        // Auto-clear uploaded files after successful batch conversion
                        clearInputFiles()
                    }
                }

            } else {
                // Single file conversion
                const file = files[0]
                setStatus('Uploading...')

                const onProgress = (status: string, attemptNumber: number, elapsedSeconds: number) => {
                    if (!isMountedRef.current) return

                    setStatus(`Processing...`)
                }

                // Call appropriate conversion function based on mode
                const result = mode === 'paid'
                    ? await convertPdfToMarkdown(
                        file,
                        apiKey,
                        options,
                        onProgress,
                        abortControllerRef.current.signal
                    )
                    : await convertPdfToMarkdownLocal(
                        file,
                        options.use_llm ? geminiApiKey : null,
                        options,
                        onProgress,
                        abortControllerRef.current.signal
                    )

                if (!result.success || !result.markdown) {
                    // Check if operation was cancelled by user
                    if (abortControllerRef.current?.signal.aborted) {
                        addLog('info', 'Conversion cancelled by user')

                        if (isMountedRef.current) {
                            setStatus('Conversion cancelled')
                            setProcessing(false)
                        }
                        return
                    }

                    // Handle actual errors
                    throw new Error(result.error || 'Conversion failed')
                }

                // Clean up markdown based on page format option
                const pageFormat = options.paginate
                    ? (options.pageFormat || 'separators_only')
                    : 'none'

                const cleanedMarkdown = cleanupPdfMarkdown(result.markdown, pageFormat)

                const filename = replaceExtension(file.name, 'md')

                addLog('success', `Conversion complete!`, {
                    contentSize: formatBytesToKB(cleanedMarkdown.length),
                    filename,
                    mode
                })

                if (isMountedRef.current) {
                    setConvertedMarkdown(cleanedMarkdown)
                    setOutputFilename(filename)
                    setStatus('Conversion complete!')
                    setProcessing(false)
                    // Auto-clear uploaded files after successful conversion
                    clearInputFiles()
                }
            }

        } catch (err) {
            const error = err as Error
            addLog('error', `Conversion failed: ${error.message}`)

            if (isMountedRef.current) {
                setError(error.message || 'An error occurred during conversion')
                setProcessing(false)
                setStatus('')
            }
        } finally {
            abortControllerRef.current = null
        }
    }, [apiKey, geminiApiKey, files, options, isBatch, folderName, mode, filenameMap, addLog, clearInputFiles])

    const handleDownload = useCallback(async () => {
        if (!convertedMarkdown || !outputFilename) return

        try {
            addLog('info', 'Download button clicked', {
                filename: outputFilename,
                contentSize: formatBytesToKB(convertedMarkdown.length)
            })

            // Check if File System Access API is available (Chrome/Edge)
            if ('showSaveFilePicker' in window) {
                try {
                    addLog('info', 'Using File System Access API for save dialog')

                    const handle = await (window as any).showSaveFilePicker({
                        suggestedName: outputFilename,
                        types: [{
                            description: 'Markdown files',
                            accept: { 'text/markdown': ['.md'] }
                        }]
                    })

                    const writable = await handle.createWritable()

                    // Write with error handling for large files/memory issues
                    try {
                        await writable.write(convertedMarkdown)
                        await writable.close()
                    } catch (writeError) {
                        // Attempt to close writable even if write failed
                        try {
                            await writable.close()
                        } catch {
                            // Ignore close errors
                        }
                        throw writeError
                    }

                    addLog('success', 'File saved successfully via File System Access API', {
                        filename: outputFilename
                    })

                    setStatus('File saved successfully!')

                } catch (apiError: any) {
                    // User cancelled or API error
                    if (apiError.name === 'AbortError') {
                        addLog('info', 'User cancelled save dialog')
                        return
                    }
                    // Check for quota/space errors
                    if (apiError.name === 'QuotaExceededError' || apiError.message?.toLowerCase().includes('quota')) {
                        addLog('error', 'Insufficient disk space to save file')
                        throw new Error('Insufficient disk space. Please free up space and try again.')
                    }
                    throw apiError
                }
            } else {
                // Fallback to traditional download for browsers without File System Access API
                addLog('info', 'Using traditional download method (File System Access API not available)')

                // Wrap download in try-catch to handle out-of-memory errors
                try {
                    downloadFile(convertedMarkdown, outputFilename, 'text/markdown')
                    addLog('success', 'File download triggered', {
                        filename: outputFilename
                    })
                    setStatus('File saved successfully!')
                } catch (downloadError) {
                    // Check if it's an out-of-memory error
                    if (downloadError instanceof Error &&
                        (downloadError.message?.toLowerCase().includes('memory') || downloadError.message?.toLowerCase().includes('allocation'))) {
                        addLog('error', 'Out of memory while creating download')
                        throw new Error('File too large for browser memory. Try using a different browser or splitting the PDF.')
                    }
                    throw downloadError
                }
            }

        } catch (err) {
            const error = err as Error
            addLog('error', `Download failed: ${error.message}`, {
                error: error.message,
                filename: outputFilename
            })
            setError(`Failed to download file: ${error.message}`)
        }
    }, [convertedMarkdown, outputFilename, addLog])

    const handleDownloadBatch = useCallback(async () => {
        if (!batchZipBlob || !batchZipFilename) return

        try {
            addLog('info', 'Batch ZIP download clicked', { filename: batchZipFilename })

            // Check if File System Access API is available
            if ('showSaveFilePicker' in window) {
                try {
                    addLog('info', 'Using File System Access API for ZIP save')

                    const handle = await (window as any).showSaveFilePicker({
                        suggestedName: batchZipFilename,
                        types: [{
                            description: 'ZIP files',
                            accept: { 'application/zip': ['.zip'] }
                        }]
                    })

                    const writable = await handle.createWritable()

                    // Write with error handling for large files/memory issues
                    try {
                        await writable.write(batchZipBlob)
                        await writable.close()
                    } catch (writeError) {
                        // Attempt to close writable even if write failed
                        try {
                            await writable.close()
                        } catch {
                            // Ignore close errors
                        }
                        throw writeError
                    }

                    addLog('success', 'ZIP saved successfully', { filename: batchZipFilename })
                    setStatus('ZIP saved successfully!')

                } catch (apiError: any) {
                    if (apiError.name === 'AbortError') {
                        addLog('info', 'User cancelled save dialog')
                        return
                    }
                    // Check for quota/space errors
                    if (apiError.name === 'QuotaExceededError' || apiError.message?.toLowerCase().includes('quota')) {
                        addLog('error', 'Insufficient disk space to save ZIP')
                        throw new Error('Insufficient disk space. Please free up space and try again.')
                    }
                    throw apiError
                }
            } else {
                addLog('info', 'Using traditional download for ZIP')

                // Wrap download in try-catch to handle out-of-memory errors
                try {
                    downloadFile(batchZipBlob, batchZipFilename, 'application/zip')
                    addLog('success', 'ZIP download triggered', { filename: batchZipFilename })
                    setStatus('ZIP download started!')
                } catch (downloadError) {
                    // Check if it's an out-of-memory error
                    if (downloadError instanceof Error &&
                        (downloadError.message?.toLowerCase().includes('memory') || downloadError.message?.toLowerCase().includes('allocation'))) {
                        addLog('error', 'Out of memory while creating ZIP download')
                        throw new Error('ZIP file too large for browser memory. Try downloading fewer files at once.')
                    }
                    throw downloadError
                }
            }

        } catch (err) {
            const error = err as Error
            addLog('error', `ZIP download failed: ${error.message}`)
            setError(`Failed to download ZIP: ${error.message}`)
        }
    }, [batchZipBlob, batchZipFilename, addLog])

    const handleCancel = useCallback(() => {
        if (abortControllerRef.current) {
            addLog('info', 'User clicked cancel button', {
                filesInProgress: batchProgress?.inProgress || 0,
                filesCompleted: batchProgress?.completed || 0,
                filesFailed: batchProgress?.failed || 0
            })
            abortControllerRef.current.abort()
            setStatus('Cancelling...')
            // Don't set processing(false) here - let the conversion promise complete
            // The catch/finally blocks will handle cleanup properly
        }
    }, [addLog, batchProgress])

    return (
        <>
            {/* Full-page drop overlay */}
            <FullPageDropOverlay show={showDropOverlay} />

            {/* Page content */}
            <div className="relative max-w-4xl mx-auto px-4 py-12">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-gray-900 mb-4">
                        PDF to Markdown
                    </h1>
                    <p className="text-lg text-gray-600">
                        Convert PDF files into clean Markdown
                    </p>
                </div>

                {/* Mode Toggle Section - Only show after mounted to prevent flicker */}
                {mounted && (
                    <>
                        <ConversionModeToggle
                            mode={mode}
                            setMode={setMode}
                            disabled={processing}
                        />

                        <ApiKeyInput
                            mode={mode}
                            apiKey={apiKey}
                            setApiKey={setApiKey}
                            geminiApiKey={geminiApiKey}
                            setGeminiApiKey={setGeminiApiKey}
                            useLlm={options.use_llm}
                            disabled={processing}
                        />
                    </>
                )}

                {/* File Upload Section */}
                <FileUploadSection
                    files={files}
                    folderName={folderName}
                    onFilesSelect={handleFilesSelect}
                    onClearFiles={handleClearFiles}
                    onDrop={handleDrop}
                />

                {/* Options Section */}
                <ConversionOptions
                    mode={mode}
                    options={options}
                    onOptionChange={handleOptionChange}
                    disabled={processing}
                />

                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                        <p className="text-red-800">{error}</p>
                    </div>
                )}

                {/* Status Display */}
                <ConversionStatus
                    isBatch={isBatch}
                    processing={processing}
                    status={status}
                    batchProgress={batchProgress}
                    onCancel={handleCancel}
                />

                {/* Action Buttons */}
                <div className="flex justify-center gap-4">
                    {/* Convert Button - show when no conversion result */}
                    {!convertedMarkdown && !batchZipBlob && (
                        <Button
                            onClick={handleConvert}
                            disabled={
                                processing ||
                                files.length === 0 ||
                                (mode === 'paid' && !apiKey.trim()) ||
                                (mode === 'free' && options.use_llm && !geminiApiKey.trim())
                            }
                            loading={processing}
                            loadingText="Converting..."
                            variant="primary"
                        >
                            Convert to Markdown
                        </Button>
                    )}

                    {/* Download Button - single file */}
                    {convertedMarkdown && (
                        <Button
                            onClick={handleDownload}
                            variant="primary"
                        >
                            Download
                        </Button>
                    )}

                    {/* Download Button - batch ZIP */}
                    {batchZipBlob && (
                        <Button
                            onClick={handleDownloadBatch}
                            variant="primary"
                        >
                            Download ZIP
                        </Button>
                    )}
                </div>
            </div>
        </>
    )
}
