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
 */
export function replaceExtension(filename: string, newExtension: string): string {
  const parts = filename.split('.')

  // Handle dotfiles (files starting with .) - they should get extension appended
  if (parts.length > 1 && parts[0] !== '') {
    parts[parts.length - 1] = newExtension
    return parts.join('.')
  }

  // No extension or dotfile - append new extension
  return `${filename}.${newExtension}`
}
