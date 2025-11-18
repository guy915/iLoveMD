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
 * 1. Removes the first {0}--- marker entirely
 * 2. Replaces subsequent {x}--- markers based on pageFormat option:
 *    - 'separators_only': Replaces with "---"
 *    - 'with_numbers': Replaces with "Page x\n\n---" and adds final "Page n+1" at end
 *    - 'none': Removes all markers
 * 3. Trims excessive whitespace and normalizes newlines
 *
 * @param markdown - Raw markdown from Marker API
 * @param pageFormat - How to format page markers
 * @returns Cleaned markdown
 *
 * @example
 * // Input: {0}---\n### Title\n\n{1}---\n\nContent
 * // separators_only: ### Title\n\n---\n\nContent
 * // with_numbers: ### Title\n\nPage 1\n\n---\n\nContent\n\nPage 2
 */
export function cleanupPdfMarkdown(
  markdown: string,
  pageFormat: PageFormatOption = 'none'
): string {
  if (!markdown) return ''

  // Pattern: {x} followed by at least 3 dashes
  // Extremely permissive to catch any variation of the marker
  const pageMarkerPattern = /\{(\d+)\}-{3,}/g

  console.log(`[cleanupPdfMarkdown] Called with format: ${pageFormat}`)

  if (pageFormat === 'none') {
    let withoutMarkers = markdown.replace(pageMarkerPattern, '')
    withoutMarkers = withoutMarkers.replace(/\n{3,}/g, '\n\n')
    return trimMarkdown(withoutMarkers)
  }

  // Find all markers
  const markers: Array<{ pageNum: number; index: number; length: number }> = []
  let match: RegExpExecArray | null
  pageMarkerPattern.lastIndex = 0

  while ((match = pageMarkerPattern.exec(markdown)) !== null) {
    markers.push({
      pageNum: parseInt(match[1], 10),
      index: match.index,
      length: match[0].length
    })
  }

  if (markers.length === 0) {
    return trimMarkdown(markdown)
  }

  let result = markdown

  // Process in reverse to avoid index shifting
  for (let i = markers.length - 1; i >= 0; i--) {
    const marker = markers[i]

    if (marker.pageNum === 0) {
      // Remove {0}--- entirely
      result = result.substring(0, marker.index) + result.substring(marker.index + marker.length)
    } else {
      let replacement = ''

      if (pageFormat === 'with_numbers') {
        // Format: \nPage x\n\n---\n
        replacement = `\n\nPage ${marker.pageNum}\n\n---\n\n`
      } else if (pageFormat === 'separators_only') {
        // Format: \n---\n
        replacement = `\n\n---\n\n`
      }

      result = result.substring(0, marker.index) + replacement + result.substring(marker.index + marker.length)
    }
  }

  // Normalize excessive whitespace
  result = result.replace(/\n{3,}/g, '\n\n')
  result = trimMarkdown(result)

  // Add final page number
  if (pageFormat === 'with_numbers' && markers.length > 0) {
    const lastPageNum = markers[markers.length - 1].pageNum
    result = `${result}\n\nPage ${lastPageNum + 1}`
  }

  // DEBUG: Add footer to verify function call
  // result += `\n\n<!-- DEBUG: cleanupPdfMarkdown called with format: ${pageFormat}, markers found: ${markers.length} -->`

  return result
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
