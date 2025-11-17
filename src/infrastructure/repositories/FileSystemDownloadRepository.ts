/**
 * FileSystemDownloadRepository
 *
 * Concrete implementation of IDownloadRepository that uses the File System Access API
 * when available, with fallback to blob downloads.
 *
 * Wraps the existing downloadService to provide a repository interface.
 */

import type { IDownloadRepository, DownloadOptions } from '@/domain/repositories'
import { downloadService } from '@/lib/services/downloadService'
import JSZip from 'jszip'

/**
 * Repository implementation for file downloads
 */
export class FileSystemDownloadRepository implements IDownloadRepository {
  /**
   * Download a text file to the user's device
   */
  async downloadFile(
    content: string | Blob,
    filename: string,
    options?: DownloadOptions
  ): Promise<void> {
    const mimeType = options?.mimeType ?? 'text/markdown'
    const useFileSystemAPI = options?.useFileSystemAPI ?? true

    // Convert string to Blob if needed
    const blob = typeof content === 'string'
      ? new Blob([content], { type: mimeType })
      : content

    // Use the existing downloadService (synchronous operation)
    // Note: The existing service automatically uses File System Access API if available
    downloadService.downloadFile(blob, filename, { useFileSystemApi: useFileSystemAPI })
    return Promise.resolve()
  }

  /**
   * Download multiple files as a ZIP archive
   */
  async downloadAsZip(
    files: Map<string, string | Blob>,
    zipFilename: string
  ): Promise<void> {
    const zip = new JSZip()

    // Add all files to the ZIP (JSZip handles both string and Blob)
    for (const [filename, content] of files.entries()) {
      zip.file(filename, content)
    }

    // Generate ZIP blob
    const zipBlob = await zip.generateAsync({ type: 'blob' })

    // Download the ZIP
    await this.downloadFile(zipBlob, zipFilename, {
      mimeType: 'application/zip',
    })
  }

  /**
   * Check if File System Access API is supported
   */
  supportsFileSystemAPI(): boolean {
    return typeof window !== 'undefined' && 'showSaveFilePicker' in window
  }
}
