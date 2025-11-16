/**
 * Service for handling filename generation and conflict resolution
 */

/**
 * Generates a unique filename by adding numerical suffixes if conflicts exist
 * @param file - The file to generate a name for
 * @param existingNames - Set of already used filenames
 * @param extension - The target file extension (default: '.md')
 * @returns A unique filename with numerical suffix if needed
 *
 * @example
 * generateUniqueFilename(file, new Set(['document.md']), '.md')
 * // Returns: 'document (1).md'
 */
export function generateUniqueFilename(
  file: File,
  existingNames: Set<string>,
  extension: string = '.md'
): string {
  const baseName = file.name.replace(/\.[^.]+$/i, '')
  let outputName = `${baseName}${extension}`

  // If name is available, use it
  if (!existingNames.has(outputName)) {
    return outputName
  }

  // Find next available number
  let counter = 1
  while (existingNames.has(`${baseName} (${counter})${extension}`)) {
    counter++
  }

  return `${baseName} (${counter})${extension}`
}

/**
 * Generates unique filenames for a batch of files
 * @param files - Array of files to generate names for
 * @param existingMap - Optional existing filename map to build upon
 * @param extension - The target file extension (default: '.md')
 * @returns Map of File to unique filename
 *
 * @example
 * const map = generateBatchFilenames([file1, file2, file3])
 * map.get(file1) // 'document.md'
 */
export function generateBatchFilenames(
  files: File[],
  existingMap: Map<File, string> = new Map(),
  extension: string = '.md'
): Map<File, string> {
  const newMap = new Map(existingMap)
  const usedNames = new Set(Array.from(existingMap.values()))

  for (const file of files) {
    if (!newMap.has(file)) {
      const uniqueName = generateUniqueFilename(file, usedNames, extension)
      newMap.set(file, uniqueName)
      usedNames.add(uniqueName)
    }
  }

  return newMap
}

/**
 * Checks if a filename was renamed (has numerical suffix)
 * @param originalName - Original filename
 * @param uniqueName - Generated unique filename
 * @returns True if the file was renamed with a numerical suffix
 *
 * @example
 * wasRenamed('document.pdf', 'document (1).md') // true
 * wasRenamed('document.pdf', 'document.md') // false
 */
export function wasRenamed(originalName: string, uniqueName: string): boolean {
  const originalBase = originalName.replace(/\.[^.]+$/i, '')
  const uniqueBase = uniqueName.replace(/\.[^.]+$/i, '')

  // Check if unique name has numerical suffix pattern
  const hasNumericalSuffix = /\s\(\d+\)$/.test(uniqueBase)

  return hasNumericalSuffix && uniqueBase.startsWith(originalBase)
}

/**
 * Gets the folder name from a file's webkitRelativePath
 * @param file - File with webkitRelativePath property
 * @returns Folder name or null if not from a folder
 *
 * @example
 * getFolderName(file) // 'MyFolder'
 */
export function getFolderName(file: File): string | null {
  const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath
  if (!path) return null

  const parts = path.split('/')
  return parts.length > 1 ? parts[0] : null
}
