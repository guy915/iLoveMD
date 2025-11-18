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
    let replacement = ''

    if (i === 0) {
      // First marker ({0}---): remove entirely
      replacement = ''
    } else {
      // Subsequent markers: replace based on format
      if (pageFormat === 'with_numbers') {
        // Format: \n\nPage x\n\n---\n\n (blank line before, blank line after)
        replacement = `\n\nPage ${marker.pageNum}\n\n---\n\n`
      } else if (pageFormat === 'separators_only') {
        // Format: \n\n---\n\n (blank line before, blank line after)
        replacement = '\n\n---\n\n'
      }
    }

    result = result.substring(0, marker.index) + replacement + result.substring(marker.index + marker.length)
  }

  // Normalize excessive whitespace around markers
  // Replace 3+ newlines with exactly 2 newlines (one blank line)
  result = result.replace(/\n{3,}/g, '\n\n')

  // Trim the entire result
  result = result.trim()

  // Add final page number at the end (if using page numbers and we have markers)
  if (pageFormat === 'with_numbers' && markers.length > 0) {
    const lastPageNum = markers[markers.length - 1].pageNum
    result = `${result}\n\nPage ${lastPageNum + 1}`
  }

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
