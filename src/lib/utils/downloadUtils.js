/**
 * Triggers a file download in the browser
 * @param {string} content - The file content
 * @param {string} filename - The filename to save as
 * @param {string} mimeType - The MIME type of the file
 */
export function downloadFile(content, filename, mimeType = 'text/markdown') {
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
 * Gets file extension from filename
 * @param {string} filename - The filename
 * @returns {string} The extension without the dot
 */
export function getFileExtension(filename) {
  const parts = filename.split('.')
  return parts.length > 1 ? parts[parts.length - 1] : ''
}

/**
 * Replaces file extension with a new one
 * @param {string} filename - The original filename
 * @param {string} newExtension - The new extension (without dot)
 * @returns {string} The filename with new extension
 */
export function replaceExtension(filename, newExtension) {
  const parts = filename.split('.')
  if (parts.length > 1) {
    parts[parts.length - 1] = newExtension
    return parts.join('.')
  }
  return `${filename}.${newExtension}`
}

/**
 * Formats bytes to human readable format
 * @param {number} bytes - The number of bytes
 * @returns {string} Formatted string like "1.5 MB"
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}
