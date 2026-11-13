/**
 * Helpers for packaging converted markdown together with its extracted images.
 *
 * Marker writes image links that point at bare file names, for example
 * `![](_page_0_Picture_1.jpeg)`. In a download, each markdown file gets its own
 * image folder next to it (`report_images/`), and the links are rewritten to match,
 * so images from different PDFs can't overwrite each other in a batch ZIP.
 */

import type JSZip from 'jszip'

/** Whether a conversion result has any images */
export function hasImages(images: Record<string, string> | undefined | null): images is Record<string, string> {
  return !!images && Object.keys(images).length > 0
}

/** Make an image name safe to use as a single path segment in a ZIP */
function safeImageName(name: string): string {
  const base = name.split(/[\\/]/).pop() || 'image'
  return base.replace(/^\.+/, '_') || 'image'
}

/**
 * Name of the image folder for a markdown file, e.g. "report.md" -> "report_images"
 */
export function getImageFolderName(markdownFilename: string): string {
  const base = markdownFilename.split('/').pop() || markdownFilename
  const stem = base.replace(/\.(md|markdown)$/i, '')
  return `${stem}_images`
}

/**
 * Point image links in the markdown at `folder/<name>`.
 * Handles both `](name)` and `](name "title")`, and links in HTML `<img src="name">`.
 */
export function rewriteImageLinks(markdown: string, imageNames: string[], folder: string): string {
  let result = markdown
  for (const name of imageNames) {
    const target = `${folder}/${encodeURI(safeImageName(name))}`
    const encodedName = encodeURI(name)
    for (const original of new Set([name, encodedName])) {
      result = result
        .split(`](${original})`).join(`](${target})`)
        .split(`](${original} `).join(`](${target} `)
        .split(`src="${original}"`).join(`src="${target}"`)
    }
  }
  return result
}

/**
 * Add a converted markdown file and its images to a ZIP.
 * @param markdownPath - Path of the markdown file inside the ZIP (may include folders)
 */
export function addConversionToZip(
  zip: JSZip,
  markdownPath: string,
  markdown: string,
  images?: Record<string, string>
): void {
  if (!hasImages(images)) {
    zip.file(markdownPath, markdown)
    return
  }

  const slash = markdownPath.lastIndexOf('/')
  const dir = slash >= 0 ? markdownPath.slice(0, slash + 1) : ''
  const folder = getImageFolderName(markdownPath)

  zip.file(markdownPath, rewriteImageLinks(markdown, Object.keys(images), folder))
  for (const [name, data] of Object.entries(images)) {
    zip.file(`${dir}${folder}/${safeImageName(name)}`, data, { base64: true })
  }
}

/**
 * Build a ZIP with one markdown file and its images (single-file conversions with images)
 */
export async function createMarkdownWithImagesZip(
  markdownFilename: string,
  markdown: string,
  images: Record<string, string>
): Promise<Blob> {
  const JSZipModule = await import('jszip')
  const JSZipCtor = JSZipModule.default || JSZipModule
  const zip = new JSZipCtor()
  addConversionToZip(zip, markdownFilename, markdown, images)
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
}
