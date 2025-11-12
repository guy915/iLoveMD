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
 * Replaces file extension with a new one
 * @param {string} filename - The original filename
 * @param {string} newExtension - The new extension (without dot)
 * @returns {string} The filename with new extension
 */
export function replaceExtension(filename, newExtension) {
  const parts = filename.split('.')

  // Handle dotfiles (files starting with .) - they should get extension appended
  if (parts.length > 1 && parts[0] !== '') {
    parts[parts.length - 1] = newExtension
    return parts.join('.')
  }

  // No extension or dotfile - append new extension
  return `${filename}.${newExtension}`
}
