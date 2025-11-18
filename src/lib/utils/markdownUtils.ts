/**
 * Markdown utility functions for cleaning up and formatting markdown content
 */

import type { PageFormatOption } from '@/types'

/**
 * Clean up markdown from Marker API by trimming whitespace and formatting page markers
 *
 * When paginate option is enabled in Marker API, it produces markers like:
 * {0}------------------------------------------------
 * {1}------------------------------------------------
 * etc.
 *
 * This function:
 * 1. Trims empty lines from beginning and end of entire markdown
 * 2. Removes the first {0}--- marker entirely
 * 3. Replaces subsequent markers based on pageFormat option:
 *    - 'with_numbers': Formats as "Page x\n\n---" (last page gets no separator)
 *    - 'separators_only': Formats as "---" (last page gets no separator)
 *    - 'none': Removes all markers and just trims
 *
 * @param markdown - Raw markdown from Marker API
 * @param pageFormat - How to format page markers
 * @returns Cleaned markdown
 *
 * @example
 * // Input with paginate:
 * // {0}------------------------------------------------
 * // # Title
 * // {1}------------------------------------------------
 * // Content
 * cleanupPdfMarkdown(input, 'with_numbers')
 * // Output:
 * // # Title
 * //
 * // Page 1
 * //
 * // ---
 * //
 * // Content
 */
export function cleanupPdfMarkdown(
  markdown: string,
  pageFormat: PageFormatOption = 'none'
): string {
  if (!markdown) return ''

  // Pattern to match {x}------------------------------------------------ or {x}---...
  const pageMarkerPattern = /\{(\d+)\}[-]+/g

  // If no page format needed, just remove markers and trim
  if (pageFormat === 'none') {
    let withoutMarkers = markdown.replace(pageMarkerPattern, '')
    // Normalize excessive newlines that were left behind by removing markers
    withoutMarkers = withoutMarkers.replace(/\n{3,}/g, '\n\n')
    return trimMarkdown(withoutMarkers)
  }

  // Find all page markers
  const markers: Array<{ pageNum: number; index: number; length: number }> = []
  let match: RegExpExecArray | null

  // Reset regex state
  pageMarkerPattern.lastIndex = 0

  while ((match = pageMarkerPattern.exec(markdown)) !== null) {
    markers.push({
      pageNum: parseInt(match[1], 10),
      index: match.index,
      length: match[0].length
    })
  }

  if (markers.length === 0) {
    // No markers found, just trim
    return trimMarkdown(markdown)
  }

  let result = markdown

  // Process markers in reverse order to avoid index shifting
  for (let i = markers.length - 1; i >= 0; i--) {
    const marker = markers[i]
    const markerText = markdown.substring(marker.index, marker.index + marker.length)

    let replacement = ''

    if (i === 0) {
      // First marker ({0}---): remove entirely
      replacement = ''
    } else {
      // Subsequent markers: replace based on format
      if (pageFormat === 'with_numbers') {
        replacement = `\n\nPage ${marker.pageNum}\n\n---\n\n`
      } else if (pageFormat === 'separators_only') {
        replacement = '\n\n---\n\n'
      }
    }

    result = result.substring(0, marker.index) + replacement + result.substring(marker.index + marker.length)
  }

  // Trim content before each page marker and after
  // This handles excessive whitespace around markers
  result = result.replace(/\n{3,}/g, '\n\n') // Normalize multiple newlines to double

  // Add final page number at the end (if using page numbers)
  // Only add if there are markers beyond {0}
  if (pageFormat === 'with_numbers' && markers.length > 1) {
    const lastPageNum = markers[markers.length - 1].pageNum
    const trimmedResult = result.trim()
    result = `${trimmedResult}\n\nPage ${lastPageNum + 1}`
  }

  return trimMarkdown(result)
}

/**
 * Trim empty lines from the beginning and end of markdown content
 *
 * @param markdown - Markdown content to trim
 * @returns Trimmed markdown
 */
function trimMarkdown(markdown: string): string {
  return markdown
    .replace(/^\s+/, '') // Remove leading whitespace
    .replace(/\s+$/, '') // Remove trailing whitespace
}
