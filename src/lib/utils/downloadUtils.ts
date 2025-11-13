/**
 * Triggers a file download in the browser
 * @param content - The file content
 * @param filename - The filename to save as
 * @param mimeType - The MIME type of the file
 */
export function downloadFile(content: string, filename: string, mimeType: string = 'text/markdown'): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
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
 * replaceExtension('file.tar.gz', 'md') // 'file.tar.md'
 */
export function replaceExtension(filename: string, newExtension: string): string {
  const lastDotIndex = filename.lastIndexOf('.')

  // No extension or dotfile (starts with .) - append extension
  if (lastDotIndex <= 0) {
    return `${filename}.${newExtension}`
  }

  // Replace existing extension
  return filename.substring(0, lastDotIndex) + '.' + newExtension
}
