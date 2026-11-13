import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'

export const alt = 'iLoveMD - PDF to Markdown converter and Markdown merger'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/**
 * Social preview image (Open Graph and Twitter) for every page.
 * Generated at build time from the site logo.
 */
export default async function OpengraphImage() {
  const logo = await readFile(join(process.cwd(), 'public', 'logo.svg'))
  const logoSrc = `data:image/svg+xml;base64,${logo.toString('base64')}`

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f9fafb',
          fontFamily: 'sans-serif',
        }}
      >
        <img src={logoSrc} width={720} height={198} alt="" />
        <div style={{ marginTop: 48, fontSize: 48, color: '#4b5563' }}>
          PDF to Markdown · Merge Markdown
        </div>
        <div style={{ marginTop: 16, fontSize: 32, color: '#6b7280' }}>
          Free online Markdown tools
        </div>
      </div>
    ),
    size
  )
}
