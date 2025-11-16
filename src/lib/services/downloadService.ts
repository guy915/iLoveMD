/**
 * Service for handling file downloads
 * Replaces downloadUtils with a proper service implementation
 */

/**
 * Options for downloading files
 */
export interface DownloadOptions {
  /** MIME type of the file */
  mimeType?: string
  /** Whether to use File System Access API if available */
  useFileSystemApi?: boolean
}

/**
 * Service for managing file downloads
 */
export class DownloadService {
  /**
   * Downloads a file using the browser's download mechanism
   * @param content - File content (string or Blob)
   * @param filename - Name for the downloaded file
   * @param options - Download options
   *
   * @example
   * const service = new DownloadService()
   * service.downloadFile('markdown content', 'document.md')
   */
  downloadFile(
    content: string | Blob,
    filename: string,
    options: DownloadOptions = {}
  ): void {
    const { mimeType = 'text/markdown' } = options

    // Create Blob if content is string
    const blob = content instanceof Blob
      ? content
      : new Blob([content], { type: mimeType })

    // Create object URL
    const url = URL.createObjectURL(blob)

    try {
      // Create temporary link and trigger download
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.style.display = 'none'

      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } finally {
      // Clean up object URL after a delay to ensure download starts
      setTimeout(() => URL.revokeObjectURL(url), 100)
    }
  }

  /**
   * Downloads a file using the File System Access API with fallback
   * Provides better UX by allowing user to choose save location
   * @param content - File content (string or Blob)
   * @param filename - Suggested filename
   * @param options - Download options
   * @returns Promise that resolves when download completes
   *
   * @example
   * const service = new DownloadService()
   * await service.downloadWithFileSystemApi(blob, 'output.zip', { mimeType: 'application/zip' })
   */
  async downloadWithFileSystemApi(
    content: string | Blob,
    filename: string,
    options: DownloadOptions = {}
  ): Promise<void> {
    const { mimeType = 'text/markdown' } = options

    // Create Blob if content is string
    const blob = content instanceof Blob
      ? content
      : new Blob([content], { type: mimeType })

    // Check if File System Access API is available
    if ('showSaveFilePicker' in window) {
      try {
        // Determine file extension and description
        const extension = filename.split('.').pop() || 'md'
        const description = this.getFileDescription(extension)

        // Show save file picker
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: filename,
          types: [{
            description,
            accept: { [mimeType]: [`.${extension}`] }
          }]
        })

        // Write file
        const writable = await handle.createWritable()
        await writable.write(blob)
        await writable.close()

        return
      } catch (error) {
        // User cancelled - don't fallback, respect their choice
        if ((error as Error).name === 'AbortError') {
          return
        }
        // API error, fall back to regular download
        console.warn('File System Access API failed, falling back to regular download:', error)
      }
    }

    // Fallback to regular download
    this.downloadFile(content, filename, options)
  }

  /**
   * Gets a human-readable description for a file extension
   * @param extension - File extension (without dot)
   * @returns Description string
   */
  private getFileDescription(extension: string): string {
    const descriptions: Record<string, string> = {
      md: 'Markdown Files',
      markdown: 'Markdown Files',
      zip: 'ZIP Archive',
      json: 'JSON Files',
      txt: 'Text Files',
      html: 'HTML Files',
      pdf: 'PDF Documents'
    }

    return descriptions[extension.toLowerCase()] || 'Files'
  }

  /**
   * Checks if File System Access API is supported
   * @returns True if supported
   */
  isFileSystemApiSupported(): boolean {
    return 'showSaveFilePicker' in window
  }
}

/**
 * Default singleton instance for convenience
 */
export const downloadService = new DownloadService()
