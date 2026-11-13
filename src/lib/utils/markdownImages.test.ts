import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'
import { addConversionToZip, getImageFolderName, rewriteImageLinks, hasImages } from './markdownImages'

describe('markdownImages', () => {
  it('names the image folder after the markdown file', () => {
    expect(getImageFolderName('report.md')).toBe('report_images')
    expect(getImageFolderName('docs/My File.md')).toBe('My File_images')
  })

  it('rewrites markdown and HTML image links', () => {
    const md = '![](_page_0_Picture_1.jpeg)\n![alt](_page_0_Picture_1.jpeg "t")\n<img src="_page_1_Figure_2.png">'
    expect(rewriteImageLinks(md, ['_page_0_Picture_1.jpeg', '_page_1_Figure_2.png'], 'report_images')).toBe(
      '![](report_images/_page_0_Picture_1.jpeg)\n![alt](report_images/_page_0_Picture_1.jpeg "t")\n<img src="report_images/_page_1_Figure_2.png">'
    )
  })

  it('adds markdown and images to a ZIP', async () => {
    const zip = new JSZip()
    addConversionToZip(zip, 'a.md', '![](x.png)', { 'x.png': btoa('PNGDATA') })
    addConversionToZip(zip, 'b.md', '# no images')

    expect(await zip.file('a.md')!.async('string')).toBe('![](a_images/x.png)')
    expect(await zip.file('a_images/x.png')!.async('string')).toBe('PNGDATA')
    expect(await zip.file('b.md')!.async('string')).toBe('# no images')
  })

  it('keeps image names inside their folder', async () => {
    const zip = new JSZip()
    addConversionToZip(zip, 'a.md', '![](../evil.png)', { '../evil.png': btoa('x') })
    expect(zip.file('a_images/evil.png')).not.toBeNull()
    expect(Object.keys(zip.files).some(name => name.includes('..'))).toBe(false)
  })

  it('detects empty image sets', () => {
    expect(hasImages(undefined)).toBe(false)
    expect(hasImages({})).toBe(false)
    expect(hasImages({ a: 'b' })).toBe(true)
  })
})
