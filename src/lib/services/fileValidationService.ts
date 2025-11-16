/**
 * Service for file validation and filtering operations
 */

/**
 * Filters out non-PDF files from an array
 * @param files - Array of files to filter
 * @returns Array containing only PDF files
 *
 * @example
 * filterPdfFiles([pdfFile, txtFile, docFile])
 * // Returns: [pdfFile]
 */
export function filterPdfFiles(files: File[]): File[] {
  return files.filter(file =>
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  )
}

/**
 * Filters files to include only those in the immediate folder (not subfolders)
 * Uses webkitRelativePath to determine folder depth
 * @param files - Array of files to filter
 * @returns Array of files only in immediate folder
 *
 * @example
 * filterImmediateFolderFiles(filesFromFolder)
 * // Returns: only files directly in folder, not in subfolders
 */
export function filterImmediateFolderFiles(files: File[]): File[] {
  return files.filter(file => {
    const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath
    if (!path) return true // No path means direct upload, include it

    const parts = path.split('/')
    // Only include files that are directly in the first folder (depth = 2: folder/file.pdf)
    return parts.length === 2
  })
}

/**
 * Filters out markdown files from an array
 * @param files - Array of files to filter
 * @returns Array containing only markdown files
 *
 * @example
 * filterMarkdownFiles([mdFile, txtFile, pdfFile])
 * // Returns: [mdFile]
 */
export function filterMarkdownFiles(files: File[]): File[] {
  return files.filter(file =>
    file.type === 'text/markdown' ||
    file.name.toLowerCase().endsWith('.md') ||
    file.name.toLowerCase().endsWith('.markdown')
  )
}

/**
 * Validates file size against a maximum limit
 * @param file - File to validate
 * @param maxSizeBytes - Maximum allowed file size in bytes
 * @returns Validation result with success flag and error message
 *
 * @example
 * validateFileSize(file, 100 * 1024 * 1024) // 100MB limit
 * // Returns: { valid: true } or { valid: false, error: 'File is too large...' }
 */
export function validateFileSize(
  file: File,
  maxSizeBytes: number
): { valid: boolean; error?: string } {
  if (file.size > maxSizeBytes) {
    const maxSizeMB = (maxSizeBytes / 1024 / 1024).toFixed(0)
    const fileSizeMB = (file.size / 1024 / 1024).toFixed(2)
    return {
      valid: false,
      error: `File "${file.name}" is too large (${fileSizeMB}MB). Maximum size is ${maxSizeMB}MB.`
    }
  }
  return { valid: true }
}

/**
 * Validates multiple files against a maximum size limit
 * @param files - Array of files to validate
 * @param maxSizeBytes - Maximum allowed file size in bytes
 * @returns Validation result with success flag and error message
 *
 * @example
 * validateBatchFileSize([file1, file2], 100 * 1024 * 1024)
 * // Returns: { valid: true, files: [file1, file2] } or { valid: false, error: '...' }
 */
export function validateBatchFileSize(
  files: File[],
  maxSizeBytes: number
): { valid: boolean; files?: File[]; error?: string } {
  const invalidFiles: { file: File; sizeMB: string }[] = []

  for (const file of files) {
    const result = validateFileSize(file, maxSizeBytes)
    if (!result.valid) {
      invalidFiles.push({
        file,
        sizeMB: (file.size / 1024 / 1024).toFixed(2)
      })
    }
  }

  if (invalidFiles.length > 0) {
    const maxSizeMB = (maxSizeBytes / 1024 / 1024).toFixed(0)
    const filesList = invalidFiles
      .map(({ file, sizeMB }) => `  - ${file.name} (${sizeMB}MB)`)
      .join('\n')

    return {
      valid: false,
      error: `${invalidFiles.length} file(s) exceed the ${maxSizeMB}MB size limit:\n${filesList}`
    }
  }

  return { valid: true, files }
}

/**
 * Validates that files array is not empty
 * @param files - Array of files to validate
 * @returns Validation result
 *
 * @example
 * validateFilesNotEmpty([])
 * // Returns: { valid: false, error: 'No files selected' }
 */
export function validateFilesNotEmpty(
  files: File[]
): { valid: boolean; error?: string } {
  if (files.length === 0) {
    return {
      valid: false,
      error: 'No files selected'
    }
  }
  return { valid: true }
}

/**
 * Validates file type matches allowed types
 * @param file - File to validate
 * @param allowedTypes - Array of allowed MIME types
 * @param allowedExtensions - Array of allowed file extensions
 * @returns Validation result
 *
 * @example
 * validateFileType(file, ['application/pdf'], ['.pdf'])
 * // Returns: { valid: true } or { valid: false, error: '...' }
 */
export function validateFileType(
  file: File,
  allowedTypes: string[],
  allowedExtensions: string[]
): { valid: boolean; error?: string } {
  const hasValidType = allowedTypes.includes(file.type)
  const hasValidExtension = allowedExtensions.some(ext =>
    file.name.toLowerCase().endsWith(ext.toLowerCase())
  )

  if (!hasValidType && !hasValidExtension) {
    return {
      valid: false,
      error: `File "${file.name}" is not a valid type. Allowed: ${allowedExtensions.join(', ')}`
    }
  }

  return { valid: true }
}
