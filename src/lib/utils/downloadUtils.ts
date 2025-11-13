/**
 * Triggers a file download in the browser
 * @param content - The file content
 * @param filename - The filename to save as
 * @param mimeType - The MIME type of the file
 * @throws Error if download fails (Blob creation, URL creation, or DOM operations fail)
 */
export function downloadFile(content: string, filename: string, mimeType: string = 'text/markdown'): void {
  let url: string | null = null
  let link: HTMLAnchorElement | null = null

  try {
    // Validate inputs
    if (!content) {
      throw new Error('Cannot download empty content')
    }
    if (!filename || filename.trim().length === 0) {
      throw new Error('Invalid filename provided')
    }

    // Create Blob (might fail if out of memory)
    const blob = new Blob([content], { type: mimeType })

    // Create object URL (might fail if too many URLs created)
    url = URL.createObjectURL(blob)

    // Create and trigger download link
    link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()

  } catch (error) {
    // Re-throw with more context
    const errorMessage = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to download file "${filename}": ${errorMessage}`)

  } finally {
    // Cleanup: Always try to cleanup even if error occurred
    try {
      if (link && document.body.contains(link)) {
        document.body.removeChild(link)
      }
      if (url) {
        URL.revokeObjectURL(url)
      }
    } catch (cleanupError) {
      // Log cleanup errors but don't throw
      console.warn('Error during download cleanup:', cleanupError)
    }
  }
}

/**
 * Replaces file extension with a new one
 * @param filename - The original filename
 * @param newExtension - The new extension (without dot)
 * @returns The filename with new extension
 * @example
 * replaceExtension('document.pdf', 'md') // 'document.md'
 * replaceExtension('.config', 'md') // '.config.md'
 * replaceExtension('..config', 'md') // '..config.md'
 * replaceExtension('...config', 'md') // '...config.md'
 * replaceExtension('file.tar.gz', 'md') // 'file.tar.md'
 */
export function replaceExtension(filename: string, newExtension: string): string {
  const lastDotIndex = filename.lastIndexOf('.')

  // No dot, or dot at start (single dotfile like .config) - append
  if (lastDotIndex <= 0) {
    return `${filename}.${newExtension}`
  }

  // Check if everything before the last dot is just dots (e.g., ..config, ...config)
  const beforeLastDot = filename.substring(0, lastDotIndex)
  if (/^\.+$/.test(beforeLastDot)) {
    // Multiple leading dots followed by name - append extension
    return `${filename}.${newExtension}`
  }

  // Normal file with extension - replace
  return filename.substring(0, lastDotIndex) + '.' + newExtension
}
