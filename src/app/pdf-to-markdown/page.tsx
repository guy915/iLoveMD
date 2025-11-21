import { Metadata } from 'next'
import PdfToMarkdownClient from './PdfToMarkdownClient'

export const metadata: Metadata = {
  title: 'PDF to Markdown',
  description: 'Convert PDF files to clean Markdown format. Supports batch conversion, OCR, and AI enhancement for high-quality results. Free and secure.',
  alternates: {
    canonical: 'https://ilovemd.vercel.app/pdf-to-markdown',
  },
  openGraph: {
    title: 'PDF to Markdown Converter - Free & AI-Powered',
    description: 'Convert PDF files to clean Markdown format. Supports batch conversion, OCR, and AI enhancement for high-quality results.',
    url: 'https://ilovemd.vercel.app/pdf-to-markdown',
  },
}

export default function PdfToMarkdownPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'iLoveMD PDF to Markdown',
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Any',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    description: 'Convert PDF files to clean Markdown format with AI enhancement.',
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PdfToMarkdownClient />
    </>
  )
}
