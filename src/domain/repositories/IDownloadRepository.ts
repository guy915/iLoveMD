/**
 * Repository interface for file download operations
 *
 * This interface abstracts file download mechanisms, allowing different
 * implementations (File System Access API, blob download, etc.)
 *
 * Benefits:
 * - Can use File System Access API when available
 * - Falls back to blob download for unsupported browsers
 * - Easy to test with mock implementation
 * - Handles browser compatibility internally
 */

/**
 * Download options
 */
export interface DownloadOptions {
  /**
   * MIME type for the file
   * @default 'text/markdown'
   */
  mimeType?: string

  /**
   * Whether to use File System Access API if available
   * @default true
   */
  useFileSystemAPI?: boolean
}

/**
 * Repository interface for downloading files to user's device
 */
export interface IDownloadRepository {
  /**
   * Download a text file to the user's device
   *
   * Uses File System Access API if available, falls back to blob download.
   *
   * @param content - File content (string or Blob)
   * @param filename - Suggested filename
   * @param options - Download options
   * @returns Promise that resolves when download starts
   * @throws Error if download fails
   */
  downloadFile(
    content: string | Blob,
    filename: string,
    options?: DownloadOptions
  ): Promise<void>

  /**
   * Download multiple files as a ZIP archive
   *
   * @param files - Map of filename to content
   * @param zipFilename - Name for the ZIP file
   * @returns Promise that resolves when download starts
   * @throws Error if ZIP generation or download fails
   */
  downloadAsZip(
    files: Map<string, string | Blob>,
    zipFilename: string
  ): Promise<void>

  /**
   * Check if File System Access API is supported
   *
   * @returns true if the browser supports File System Access API
   */
  supportsFileSystemAPI(): boolean
}
